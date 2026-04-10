package com.wemoov.redis.demo.ttl;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Random;

@Service
public class NoTtlTokenService {

    private static final Logger log = LoggerFactory.getLogger(NoTtlTokenService.class);
    private static final long CLEANUP_THRESHOLD_MS = 5 * 60 * 1000L; // 5 minutes

    private final TokenRepository repo;
    private final Random random = new Random();

    public NoTtlTokenService(TokenRepository repo) {
        this.repo = repo;
    }

    @Transactional
    public TokenDto generate(String email) {
        // Replace any existing token for this email
        repo.deleteByEmail(email);

        String code      = String.format("%06d", random.nextInt(1_000_000));
        Instant now      = Instant.now();
        TokenEntity entity = repo.save(new TokenEntity(email, code, now));

        log.info("[NoTTL-2FA] Token generated — email='{}' code='{}'", email, code);
        return new TokenDto(entity.getId().toString(), email, code, now.toEpochMilli(), null, null);
    }

    public List<TokenDto> getAllTokens() {
        return repo.findAll().stream()
                .map(e -> new TokenDto(
                        e.getId().toString(),
                        e.getEmail(),
                        e.getCode(),
                        e.getCreatedAt().toEpochMilli(),
                        null, null))
                .toList();
    }

    @Transactional
    public int cleanup() {
        Instant threshold = Instant.now().minusMillis(CLEANUP_THRESHOLD_MS);
        List<TokenEntity> expired = repo.findAll().stream()
                .filter(e -> e.getCreatedAt().isBefore(threshold))
                .toList();
        repo.deleteAll(expired);
        log.info("[NoTTL-2FA] Cleanup batch — deleted {} tokens older than 5min", expired.size());
        return expired.size();
    }

    @Transactional
    public void reset() {
        repo.deleteAll();
        log.info("[NoTTL-2FA] All tokens deleted");
    }
}
