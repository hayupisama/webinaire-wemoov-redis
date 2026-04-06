package com.wemoov.redis.demo.gateway;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@CrossOrigin("*")
public class GatewayController {

    private static final Logger log = LoggerFactory.getLogger(GatewayController.class);

    private final RouteService routeService;

    public GatewayController(RouteService routeService) {
        this.routeService = routeService;
    }

    @GetMapping("/health")
    public ResponseEntity<Void> health() {
        return ResponseEntity.ok().build();
    }

    @GetMapping("/api/hello")
    public ResponseEntity<?> hello() {
        long start = System.currentTimeMillis();

        return routeService.getRoute("/api/hello").map(route -> {
            if (route.maintenance()) {
                log.warn("[GW-Redis] GET /api/hello → MAINTENANCE mode");
                return ResponseEntity.status(503)
                        .<Map<String, Object>>body(Map.of("error", "Service en maintenance"));
            }
            try { Thread.sleep(20); } catch (InterruptedException ignored) {}
            long duration = System.currentTimeMillis() - start;
            log.info("[GW-Redis] GET /api/hello → destination='{}' duration={}ms",
                    route.destination(), duration);
            return ResponseEntity.ok(Map.of(
                    "message",       "Hello from " + route.destination(),
                    "targetService", route.destination(),
                    "durationMs",    duration
            ));
        }).orElseGet(() -> {
            log.error("[GW-Redis] GET /api/hello → route NOT FOUND in Redis");
            return ResponseEntity.status(404)
                    .<Map<String, Object>>body(Map.of("error", "Route introuvable"));
        });
    }

    @GetMapping("/api/routes")
    public List<RouteDef> getRoutes() {
        List<RouteDef> routes = routeService.getAllRoutes();
        log.info("[GW-Redis] GET /api/routes → {} routes", routes.size());
        return routes;
    }

    @PostMapping("/api/routes")
    public ResponseEntity<Void> upsertRoute(@RequestBody RouteDef route) {
        routeService.upsert(route);
        log.info("[GW-Redis] POST /api/routes → upserted path='{}' destination='{}' active={} maintenance={}",
                route.path(), route.destination(), route.active(), route.maintenance());
        return ResponseEntity.ok().build();
    }
}
