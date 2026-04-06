package com.wemoov.redis.demo.gateway;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@CrossOrigin("*")
public class GatewayController {

    private static final Logger log = LoggerFactory.getLogger(GatewayController.class);

    private final GatewayProperties props;

    public GatewayController(GatewayProperties props) {
        this.props = props;
    }

    @GetMapping("/health")
    public ResponseEntity<Void> health() {
        return ResponseEntity.ok().build();
    }

    @GetMapping("/api/hello")
    public ResponseEntity<Map<String, Object>> hello() throws InterruptedException {
        long start = System.currentTimeMillis();

        String destination = props.routes().stream()
                .filter(r -> r.path().equals("/api/hello") && r.active())
                .findFirst()
                .map(GatewayProperties.RouteEntry::destination)
                .orElse("unknown");

        Thread.sleep(50); // Simulates YAML config lookup latency

        long duration = System.currentTimeMillis() - start;
        log.info("[GW-NoRedis] GET /api/hello → destination='{}' duration={}ms", destination, duration);
        return ResponseEntity.ok(Map.of(
                "message",       "Hello from " + destination,
                "targetService", destination,
                "durationMs",    duration
        ));
    }
}
