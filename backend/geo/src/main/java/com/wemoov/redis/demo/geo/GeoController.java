package com.wemoov.redis.demo.geo;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@CrossOrigin("*")
public class GeoController {

    private static final Logger log = LoggerFactory.getLogger(GeoController.class);

    private final GeoService service;

    public GeoController(GeoService service) {
        this.service = service;
    }

    /** Health at root — matches frontend: GET /health */
    @GetMapping("/health")
    public ResponseEntity<Void> health() {
        return ResponseEntity.ok().build();
    }

    @GetMapping("/api/cities")
    public List<String> cities() {
        return service.getCities();
    }

    /** Matches frontend: GET /api/geo/search?city=Paris&radius=300 */
    @GetMapping("/api/geo/search")
    public List<GeoResult> search(
            @RequestParam String city,
            @RequestParam(defaultValue = "300") double radius) {
        log.info("[Geo] GET /api/geo/search city='{}' radius={}", city, radius);
        return service.search(city, radius);
    }
}
