package com.wemoov.redis.demo.ttl;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@CrossOrigin("*")
public class ResetController {

    private static final Logger log = LoggerFactory.getLogger(ResetController.class);

    private final NoTtlService        noTtlService;
    private final WithTtlService      withTtlService;
    private final NoTtlTokenService   noTtlTokenService;
    private final WithTtlTokenService withTtlTokenService;

    public ResetController(NoTtlService noTtlService, WithTtlService withTtlService,
                           NoTtlTokenService noTtlTokenService, WithTtlTokenService withTtlTokenService) {
        this.noTtlService        = noTtlService;
        this.withTtlService      = withTtlService;
        this.noTtlTokenService   = noTtlTokenService;
        this.withTtlTokenService = withTtlTokenService;
    }

    /** Health at root — matches frontend: GET /health */
    @GetMapping("/health")
    public ResponseEntity<Void> health() {
        return ResponseEntity.ok().build();
    }

    /** Matches frontend: POST /api/sessions/reset */
    @PostMapping("/api/sessions/reset")
    public ResponseEntity<Void> reset() {
        noTtlService.reset();
        withTtlService.reset();
        log.info("[TTL] Full reset requested");
        return ResponseEntity.ok().build();
    }

    /** Matches frontend: POST /api/2fa/reset */
    @PostMapping("/api/2fa/reset")
    public ResponseEntity<Void> reset2fa() {
        noTtlTokenService.reset();
        withTtlTokenService.reset();
        log.info("[TTL-2FA] Full 2FA reset requested");
        return ResponseEntity.ok().build();
    }
}
