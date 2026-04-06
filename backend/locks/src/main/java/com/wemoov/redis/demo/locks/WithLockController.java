package com.wemoov.redis.demo.locks;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@CrossOrigin("*")
@RequestMapping("/with-lock/api")
public class WithLockController {

    private static final Logger log = LoggerFactory.getLogger(WithLockController.class);

    private final WithLockService service;

    public WithLockController(WithLockService service) {
        this.service = service;
    }

    @PostMapping("/debit/concurrent")
    public ResponseEntity<Void> debitConcurrent() {
        log.info("[WithLock] POST /debit/concurrent — starting distributed lock demo");
        service.launchConcurrentDebits();
        return ResponseEntity.ok().build(); // 200, not 202
    }

    @GetMapping("/threads/status")
    public ThreadStatus threadsStatus() {
        return service.getStatus();
    }

    @GetMapping("/lock/status")
    public LockStatus lockStatus() {
        return service.getLockStatus(); // { owner: "Thread-A" | null }
    }
}
