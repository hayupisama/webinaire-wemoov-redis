package com.wemoov.redis.demo.ttl;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@CrossOrigin("*")
public class ResetController {

    private static final Logger log = LoggerFactory.getLogger(ResetController.class);

    private final NoTtlService   noTtlService;
    private final WithTtlService withTtlService;

    public ResetController(NoTtlService noTtlService, WithTtlService withTtlService) {
        this.noTtlService   = noTtlService;
        this.withTtlService = withTtlService;
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
}
