package com.wemoov.redis.demo.ratelimit;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@CrossOrigin("*")
@RequestMapping("/api/rate")
public class RateLimitController {

    private final RateLimitService service;

    public RateLimitController(RateLimitService service) {
        this.service = service;
    }

    @GetMapping("/health")
    public ResponseEntity<Void> health() {
        return ResponseEntity.ok().build();
    }

    @GetMapping("/counter")
    public Map<String, Integer> getCounter() {
        return Map.of("count", service.getCounter());
    }

    @PostMapping("/hit")
    public ResponseEntity<Void> hit() {
        int status = service.hit();
        return ResponseEntity.status(status).build();
    }

    @PostMapping("/reset")
    public ResponseEntity<Void> reset() {
        service.reset();
        return ResponseEntity.ok().build();
    }
}
