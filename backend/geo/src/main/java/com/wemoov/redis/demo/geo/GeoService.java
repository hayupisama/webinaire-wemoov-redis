package com.wemoov.redis.demo.geo;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.geo.Distance;
import org.springframework.data.geo.GeoResults;
import org.springframework.data.geo.Metrics;
import org.springframework.data.geo.Point;
import org.springframework.data.redis.connection.RedisGeoCommands;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.domain.geo.GeoReference;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class GeoService {

    private static final Logger log    = LoggerFactory.getLogger(GeoService.class);
    private static final String GEO_KEY = "agencies:geo";

    private final StringRedisTemplate redis;

    private static final Object[][] SEED = {
            { "Paris",        48.8566,  2.3522 },
            { "Lyon",         45.7640,  4.8357 },
            { "Marseille",    43.2965,  5.3698 },
            { "Toulouse",     43.6047,  1.4442 },
            { "Bordeaux",     44.8378, -0.5792 },
            { "Nantes",       47.2184, -1.5536 },
            { "Strasbourg",   48.5734,  7.7521 },
            { "Montpellier",  43.6117,  3.8767 },
            { "Rennes",       48.1173, -1.6778 },
            { "Lille",        50.6292,  3.0573 },
            { "Nice",         43.7102,  7.2620 },
            { "Reims",        49.2583,  4.0317 },
    };

    public GeoService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void seed() {
        Long size = redis.opsForZSet().zCard(GEO_KEY);
        if (size != null && size > 0) {
            log.info("[Geo] GEO key '{}' already has {} entries, skipping seed", GEO_KEY, size);
            return;
        }
        for (Object[] row : SEED) {
            String name = (String) row[0];
            double lat  = (double) row[1];
            double lon  = (double) row[2];
            redis.opsForGeo().add(GEO_KEY, new Point(lon, lat), name);
        }
        log.info("[Geo] Seeded {} cities into '{}'", SEED.length, GEO_KEY);
    }

    public List<GeoResult> search(String city, double radiusKm) {
        long start = System.currentTimeMillis();

        var positions = redis.opsForGeo().position(GEO_KEY, city);
        if (positions == null || positions.isEmpty() || positions.get(0) == null) {
            log.warn("[Geo] City '{}' not found in GEO key", city);
            return List.of();
        }
        Point center = positions.get(0);

        RedisGeoCommands.GeoSearchCommandArgs args = RedisGeoCommands.GeoSearchCommandArgs
                .newGeoSearchArgs()
                .includeDistance()
                .sortAscending();

        GeoResults<RedisGeoCommands.GeoLocation<String>> results =
                redis.opsForGeo().search(
                        GEO_KEY,
                        GeoReference.fromCoordinate(center),
                        new Distance(radiusKm, Metrics.KILOMETERS),
                        args
                );

        if (results == null) return List.of();

        List<GeoResult> found = results.getContent().stream()
                .filter(r -> !r.getContent().getName().equals(city))
                .map(r -> new GeoResult(
                        r.getContent().getName(),
                        r.getDistance().getValue()
                ))
                .toList();

        long elapsed = System.currentTimeMillis() - start;
        log.info("[Geo] GEOSEARCH city='{}' radius={}km → {} results in {}ms",
                city, radiusKm, found.size(), elapsed);

        return found;
    }

    public List<String> getCities() {
        return List.of(
                "Paris", "Lyon", "Marseille", "Toulouse", "Bordeaux",
                "Nantes", "Strasbourg", "Montpellier", "Rennes", "Lille", "Nice", "Reims"
        );
    }
}