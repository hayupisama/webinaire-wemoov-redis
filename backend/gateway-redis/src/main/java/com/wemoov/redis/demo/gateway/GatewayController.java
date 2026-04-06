package com.wemoov.redis.demo.gateway;

import jakarta.servlet.http.HttpServletRequest;
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

    @GetMapping("/api/**")
    public ResponseEntity<?> handleRoute(HttpServletRequest request) {
        long start = System.currentTimeMillis();
        String path = request.getRequestURI();

        return routeService.getRoute(path).map(route -> {
            if (route.maintenance()) {
                log.warn("[GW-Redis] GET {} → MAINTENANCE mode", path);
                return ResponseEntity.status(503)
                        .<Map<String, Object>>body(Map.of("error", "Service en maintenance"));
            }
            try { Thread.sleep(20); } catch (InterruptedException ignored) {}
            long duration = System.currentTimeMillis() - start;
            log.info("[GW-Redis] GET {} → destination='{}' duration={}ms",
                    path, route.destination(), duration);
            return ResponseEntity.ok(Map.of(
                    "message",       "Hello from " + route.destination(),
                    "targetService", route.destination(),
                    "durationMs",    duration
            ));
        }).orElseGet(() -> {
            log.error("[GW-Redis] GET {} → route NOT FOUND in Redis", path);
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
