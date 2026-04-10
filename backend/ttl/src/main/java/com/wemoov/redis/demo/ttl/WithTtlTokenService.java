package com.wemoov.redis.demo.ttl;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Random;
import java.util.Set;

@Service
public class WithTtlTokenService {

    private static final Logger log    = LoggerFactory.getLogger(WithTtlTokenService.class);
    private static final String PREFIX = "2fa:";

    private final StringRedisTemplate redis;
    private final Random random = new Random();

    public WithTtlTokenService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /**
     * Stores a 2FA token in Redis with TTL.
     * Value: "{code}:{initialTtl}" to retrieve initialTtl on reads.
     */
    public TokenDto generate(String email, int ttlSeconds) {
        String key  = PREFIX + email;
        String code = String.format("%06d", random.nextInt(1_000_000));

        redis.opsForValue().set(key, code + ":" + ttlSeconds, Duration.ofSeconds(ttlSeconds));

        log.info("[WithTTL-2FA] Token generated — email='{}' code='{}' ttl={}s (SET {} EX {})",
                email, code, ttlSeconds, key, ttlSeconds);
        return new TokenDto(key, email, code, null, (long) ttlSeconds, (long) ttlSeconds);
    }

    public List<TokenDto> getAllTokens() {
        Set<String> keys = redis.keys(PREFIX + "*");
        if (keys == null || keys.isEmpty()) return List.of();

        return keys.stream()
                .map(key -> {
                    String email    = key.substring(PREFIX.length());
                    String rawValue = redis.opsForValue().get(key);
                    if (rawValue == null) return null;

                    Long ttl = redis.getExpire(key);
                    long remaining = (ttl != null && ttl >= 0) ? ttl : 0L;

                    // Parse "{code}:{initialTtl}"
                    long initialTtl = remaining;
                    String code     = rawValue;
                    int colonIdx    = rawValue.lastIndexOf(':');
                    if (colonIdx > 0) {
                        code = rawValue.substring(0, colonIdx);
                        try {
                            initialTtl = Long.parseLong(rawValue.substring(colonIdx + 1));
                        } catch (NumberFormatException ignored) {}
                    }

                    return new TokenDto(key, email, code, null, remaining, initialTtl);
                })
                .filter(t -> t != null && t.ttlRemaining() > 0)
                .toList();
    }

    public void reset() {
        Set<String> keys = redis.keys(PREFIX + "*");
        if (keys != null && !keys.isEmpty()) {
            redis.delete(keys);
            log.info("[WithTTL-2FA] Deleted {} token keys", keys.size());
        }
    }
}
