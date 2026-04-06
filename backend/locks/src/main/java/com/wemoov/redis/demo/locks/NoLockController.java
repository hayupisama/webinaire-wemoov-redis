package com.wemoov.redis.demo.locks;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@CrossOrigin("*")
@RequestMapping("/no-lock/api")
public class NoLockController {

    private static final Logger log = LoggerFactory.getLogger(NoLockController.class);

    private final NoLockService service;

    public NoLockController(NoLockService service) {
        this.service = service;
    }

    @PostMapping("/debit/concurrent")
    public ResponseEntity<Void> debitConcurrent() {
        log.info("[NoLock] POST /debit/concurrent — starting race condition demo");
        service.launchConcurrentDebits();
        return ResponseEntity.ok().build(); // 200, not 202 — frontend maps status===200
    }

    @GetMapping("/threads/status")
    public ThreadStatus threadsStatus() {
        return service.getStatus();
    }
}
