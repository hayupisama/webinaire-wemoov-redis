package com.wemoov.redis.demo.ratelimit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class RateLimitService {

    private static final Logger log = LoggerFactory.getLogger(RateLimitService.class);
    static final int QUOTA = 10;
    private static final String KEY = "rate:global";

    private final StringRedisTemplate redis;

    public RateLimitService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public int getCounter() {
        String val = redis.opsForValue().get(KEY);
        return val == null ? 0 : Integer.parseInt(val);
    }

    /** @return HTTP status: 200 si sous quota, 429 si dépassé */
    public int hit() {
        Long count  = redis.opsForValue().increment(KEY);
        int  status = (count != null && count <= QUOTA) ? 200 : 429;
        if (status == 429) {
            log.warn("[RateLimit-Redis] INCR {} → count={} → 429 QUOTA EXCEEDED (global quota={})",
                    KEY, count, QUOTA);
        } else {
            log.info("[RateLimit-Redis] INCR {} → count={}/{} → 200", KEY, count, QUOTA);
        }
        return status;
    }

    public void reset() {
        redis.delete(KEY);
        log.info("[RateLimit-Redis] Global counter reset (DEL {})", KEY);
    }
}
