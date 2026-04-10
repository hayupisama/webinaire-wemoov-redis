package com.wemoov.redis.demo.ttl;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@CrossOrigin("*")
@RequestMapping("/no-ttl/api/2fa")
public class NoTtlTokenController {

    private static final Logger log = LoggerFactory.getLogger(NoTtlTokenController.class);

    private final NoTtlTokenService service;

    public NoTtlTokenController(NoTtlTokenService service) {
        this.service = service;
    }

    @PostMapping("/generate")
    public TokenDto generate(@RequestBody Map<String, String> body) {
        String email = body.getOrDefault("email", "").trim();
        log.info("[NoTTL-2FA] POST /generate email='{}'", email);
        return service.generate(email);
    }

    @GetMapping("/tokens")
    public List<TokenDto> getTokens() {
        return service.getAllTokens();
    }

    @PostMapping("/cleanup")
    public ResponseEntity<Map<String, Integer>> cleanup() {
        int deleted = service.cleanup();
        log.info("[NoTTL-2FA] POST /cleanup → deleted={}", deleted);
        return ResponseEntity.ok(Map.of("deleted", deleted));
    }
}
