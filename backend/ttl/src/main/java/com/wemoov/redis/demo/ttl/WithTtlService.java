package com.wemoov.redis.demo.ttl;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class WithTtlService {

    private static final Logger log    = LoggerFactory.getLogger(WithTtlService.class);
    private static final String PREFIX = "session:";

    private final StringRedisTemplate redis;

    public WithTtlService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /**
     * Creates a Redis session with TTL.
     * Value stored as "{token}:{initialTtl}" so we can retrieve initialTtl later.
     */
    public SessionDto login(String username, int ttlSeconds) {
        String key   = PREFIX + username;
        String token = UUID.randomUUID().toString().substring(0, 8);

        // Encode initialTtl in the value to retrieve it on subsequent reads
        redis.opsForValue().set(key, token + ":" + ttlSeconds, Duration.ofSeconds(ttlSeconds));

        log.info("[WithTTL] Session created — username='{}' ttl={}s (SET {} EX {})",
                username, ttlSeconds, key, ttlSeconds);
        return new SessionDto(username, username, null, (long) ttlSeconds, (long) ttlSeconds);
    }

    public List<SessionDto> getAllSessions() {
        Set<String> keys = redis.keys(PREFIX + "*");
        if (keys == null || keys.isEmpty()) return List.of();

        return keys.stream()
                .map(key -> {
                    String username  = key.substring(PREFIX.length());
                    String rawValue  = redis.opsForValue().get(key);
                    if (rawValue == null) return null;

                    Long ttl = redis.getExpire(key);
                    long remaining = (ttl != null && ttl >= 0) ? ttl : 0L;

                    // Parse initialTtl from stored value "{token}:{initialTtl}"
                    long initialTtl = remaining; // fallback
                    int colonIdx = rawValue.lastIndexOf(':');
                    if (colonIdx > 0) {
                        try {
                            initialTtl = Long.parseLong(rawValue.substring(colonIdx + 1));
                        } catch (NumberFormatException ignored) {}
                    }

                    return new SessionDto(username, username, null, remaining, initialTtl);
                })
                .filter(s -> s != null && s.ttlRemaining() > 0)
                .toList();
    }

    public void reset() {
        Set<String> keys = redis.keys(PREFIX + "*");
        if (keys != null && !keys.isEmpty()) {
            redis.delete(keys);
            log.info("[WithTTL] Deleted {} session keys", keys.size());
        }
    }
}
