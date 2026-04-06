package com.wemoov.redis.demo.ttl;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@CrossOrigin("*")
@RequestMapping("/with-ttl/api")
public class WithTtlController {

    private static final Logger log = LoggerFactory.getLogger(WithTtlController.class);

    private final WithTtlService service;

    public WithTtlController(WithTtlService service) {
        this.service = service;
    }

    /** POST /with-ttl/api/sessions with body { username, ttl } — matches frontend createWithTtlSession */
    @PostMapping("/sessions")
    public SessionDto createSession(@RequestBody Map<String, Object> body) {
        String username = (String) body.getOrDefault("username", "");
        int ttl = body.containsKey("ttl") ? ((Number) body.get("ttl")).intValue() : 30;
        log.info("[WithTTL] POST /sessions username='{}' ttl={}s", username, ttl);
        return service.login(username.trim(), ttl);
    }

    @GetMapping("/sessions")
    public List<SessionDto> getSessions() {
        return service.getAllSessions();
    }
}
