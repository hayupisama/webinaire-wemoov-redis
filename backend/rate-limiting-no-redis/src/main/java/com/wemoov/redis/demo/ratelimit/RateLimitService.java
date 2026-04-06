package com.wemoov.redis.demo.ratelimit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class RateLimitService {

    private static final Logger log = LoggerFactory.getLogger(RateLimitService.class);
    static final int QUOTA = 10;

    private final Map<String, AtomicInteger> counters = new ConcurrentHashMap<>(Map.of(
            "A", new AtomicInteger(0),
            "B", new AtomicInteger(0),
            "C", new AtomicInteger(0)
    ));

    public int getCounter(String instance) {
        return counters.getOrDefault(instance, new AtomicInteger(0)).get();
    }

    /** @return HTTP status: 200 si sous quota, 429 si dépassé */
    public int hit(String instance) {
        AtomicInteger counter = counters.computeIfAbsent(instance, k -> new AtomicInteger(0));
        int count = counter.incrementAndGet();
        int status = count <= QUOTA ? 200 : 429;
        if (status == 429) {
            log.warn("[RateLimit-NoRedis] Instance={} count={} → 429 QUOTA EXCEEDED (instance-local quota={})",
                    instance, count, QUOTA);
        } else {
            log.info("[RateLimit-NoRedis] Instance={} count={}/{} → 200", instance, count, QUOTA);
        }
        return status;
    }

    public void reset() {
        counters.values().forEach(c -> c.set(0));
        log.info("[RateLimit-NoRedis] All instance counters reset");
    }
}
