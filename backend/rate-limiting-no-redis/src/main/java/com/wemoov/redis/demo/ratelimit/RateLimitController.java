package com.wemoov.redis.demo.ratelimit;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@CrossOrigin("*")
public class RateLimitController {

    private final RateLimitService service;

    public RateLimitController(RateLimitService service) {
        this.service = service;
    }

    @GetMapping("/health")
    public ResponseEntity<Void> health() {
        return ResponseEntity.ok().build();
    }

    @GetMapping("/api/rate/counter")
    public Map<String, Integer> getCounter(@RequestParam String instance) {
        return Map.of("count", service.getCounter(instance));
    }

    @PostMapping("/api/rate/hit")
    public ResponseEntity<Void> hit(@RequestParam String instance) {
        int status = service.hit(instance);
        return ResponseEntity.status(status).build();
    }

    @PostMapping("/api/rate/reset")
    public ResponseEntity<Void> reset() {
        service.reset();
        return ResponseEntity.ok().build();
    }
}
