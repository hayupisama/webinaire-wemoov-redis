package com.wemoov.redis.demo.gateway;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

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

    @GetMapping("/api/routes")
    public ResponseEntity<List<Map<String, Object>>> getRoutes() {
        List<Map<String, Object>> result = props.routes().stream()
                .map(r -> Map.<String, Object>of(
                        "path", r.path(),
                        "destination", r.destination(),
                        "active", r.active()))
                .collect(Collectors.toList());
        log.info("[GW-NoRedis] GET /api/routes → {} routes", result.size());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/api/**")
    public ResponseEntity<Map<String, Object>> handleRoute(jakarta.servlet.http.HttpServletRequest request) throws InterruptedException {
        long start = System.currentTimeMillis();
        String requestPath = request.getRequestURI();

        String destination = props.routes().stream()
                .filter(r -> r.path().equals(requestPath) && r.active())
                .findFirst()
                .map(GatewayProperties.RouteEntry::destination)
                .orElse("unknown");

        if ("unknown".equals(destination)) {
            return ResponseEntity.status(404).body(Map.of("error", "Route introuvable"));
        }

        Thread.sleep(50); // Simulates YAML config lookup latency

        long duration = System.currentTimeMillis() - start;
        log.info("[GW-NoRedis] GET {} → destination='{}' duration={}ms", requestPath, destination, duration);
        return ResponseEntity.ok(Map.of(
                "message",       "Hello from " + destination,
                "targetService", destination,
                "durationMs",    duration
        ));
    }
}
