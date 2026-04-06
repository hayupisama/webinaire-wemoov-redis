package com.wemoov.redis.demo.ttl;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@CrossOrigin("*")
@RequestMapping("/no-ttl/api")
public class NoTtlController {

    private static final Logger log = LoggerFactory.getLogger(NoTtlController.class);

    private final NoTtlService service;

    public NoTtlController(NoTtlService service) {
        this.service = service;
    }

    /** POST /no-ttl/api/sessions with body { username } — matches frontend createNoTtlSession */
    @PostMapping("/sessions")
    public SessionDto createSession(@RequestBody Map<String, String> body) {
        String username = body.getOrDefault("username", "").trim();
        log.info("[NoTTL] POST /sessions username='{}'", username);
        return service.login(username);
    }

    @GetMapping("/sessions")
    public List<SessionDto> getSessions() {
        return service.getAllSessions();
    }

    /** POST /no-ttl/api/sessions/cleanup — simulates the nightly batch */
    @PostMapping("/sessions/cleanup")
    public ResponseEntity<Map<String, Integer>> cleanup() {
        int deleted = service.cleanup();
        log.info("[NoTTL] POST /sessions/cleanup → deleted={}", deleted);
        return ResponseEntity.ok(Map.of("deleted", deleted));
    }
}
