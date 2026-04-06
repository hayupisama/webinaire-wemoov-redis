package com.wemoov.redis.demo.gateway;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class RouteService {

    private static final Logger log          = LoggerFactory.getLogger(RouteService.class);
    private static final String ROUTE_PREFIX = "route:";

    private final StringRedisTemplate redis;

    public RouteService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void initDefaultRoutes() {
        if (getAllRoutes().isEmpty()) {
            upsert(new RouteDef("/api/hello",  "service-a", true, false));
            upsert(new RouteDef("/api/orders", "service-b", true, false));
            upsert(new RouteDef("/api/users",  "service-c", true, false));
            log.info("[GW-Redis] Seeded 3 default routes into Redis");
        } else {
            log.info("[GW-Redis] Routes already exist in Redis, skipping seed");
        }
    }

    public List<RouteDef> getAllRoutes() {
        Set<String> keys = redis.keys(ROUTE_PREFIX + "*");
        if (keys == null || keys.isEmpty()) return Collections.emptyList();

        return keys.stream().map(key -> {
            Map<Object, Object> h = redis.opsForHash().entries(key);
            return new RouteDef(
                    key.substring(ROUTE_PREFIX.length()),
                    (String) h.getOrDefault("destination", ""),
                    Boolean.parseBoolean((String) h.getOrDefault("active", "true")),
                    Boolean.parseBoolean((String) h.getOrDefault("maintenance", "false"))
            );
        }).sorted(Comparator.comparing(RouteDef::path)).toList();
    }

    public Optional<RouteDef> getRoute(String path) {
        Map<Object, Object> h = redis.opsForHash().entries(ROUTE_PREFIX + path);
        if (h.isEmpty()) return Optional.empty();
        return Optional.of(new RouteDef(
                path,
                (String) h.getOrDefault("destination", ""),
                Boolean.parseBoolean((String) h.getOrDefault("active", "true")),
                Boolean.parseBoolean((String) h.getOrDefault("maintenance", "false"))
        ));
    }

    public void upsert(RouteDef route) {
        String key = ROUTE_PREFIX + route.path();
        redis.opsForHash().put(key, "destination",  route.destination());
        redis.opsForHash().put(key, "active",        String.valueOf(route.active()));
        redis.opsForHash().put(key, "maintenance",   String.valueOf(route.maintenance()));
        log.info("[GW-Redis] HSET {} destination={} active={} maintenance={}",
                key, route.destination(), route.active(), route.maintenance());
    }
}
