package com.wemoov.redis.demo.ttl;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@CrossOrigin("*")
@RequestMapping("/with-ttl/api/2fa")
public class WithTtlTokenController {

    private static final Logger log = LoggerFactory.getLogger(WithTtlTokenController.class);

    private final WithTtlTokenService service;

    public WithTtlTokenController(WithTtlTokenService service) {
        this.service = service;
    }

    @PostMapping("/generate")
    public TokenDto generate(@RequestBody Map<String, Object> body) {
        String email = ((String) body.getOrDefault("email", "")).trim();
        int ttl      = body.containsKey("ttl") ? ((Number) body.get("ttl")).intValue() : 60;
        log.info("[WithTTL-2FA] POST /generate email='{}' ttl={}s", email, ttl);
        return service.generate(email, ttl);
    }

    @GetMapping("/tokens")
    public List<TokenDto> getTokens() {
        return service.getAllTokens();
    }
}
