package com.wemoov.redis.demo.ttl;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class NoTtlService {

    private static final Logger log = LoggerFactory.getLogger(NoTtlService.class);
    private static final long CLEANUP_THRESHOLD_MS = 30_000; // 30 seconds

    private final SessionRepository repo;

    public NoTtlService(SessionRepository repo) {
        this.repo = repo;
    }

    @Transactional
    public SessionDto login(String username) {
        repo.deleteByUsername(username); // Replace existing session

        String token = UUID.randomUUID().toString().substring(0, 8);
        Instant now  = Instant.now();
        repo.save(new SessionEntity(username, token, now, null));

        log.info("[NoTTL] Session created — username='{}' token='{}'", username, token);
        return new SessionDto(username, username, now.toEpochMilli(), null, null);
    }

    public List<SessionDto> getAllSessions() {
        return repo.findAll().stream()
                .map(e -> new SessionDto(
                        e.getUsername(),
                        e.getUsername(),
                        e.getCreatedAt().toEpochMilli(),
                        null, null))
                .toList();
    }

    @Transactional
    public int cleanup() {
        Instant threshold = Instant.now().minusMillis(CLEANUP_THRESHOLD_MS);
        List<SessionEntity> expired = repo.findAll().stream()
                .filter(e -> e.getCreatedAt().isBefore(threshold))
                .toList();
        repo.deleteAll(expired);
        log.info("[NoTTL] Cleanup batch — deleted {} sessions older than 30s", expired.size());
        return expired.size();
    }

    @Transactional
    public void reset() {
        repo.deleteAll();
        log.info("[NoTTL] All sessions deleted");
    }
}
