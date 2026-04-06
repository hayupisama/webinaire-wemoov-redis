package com.wemoov.redis.demo.locks;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@CrossOrigin("*")
public class AccountController {

    private static final Logger log = LoggerFactory.getLogger(AccountController.class);

    private final SharedAccountService account;
    private final NoLockService        noLock;
    private final WithLockService      withLock;

    public AccountController(SharedAccountService account,
                             NoLockService noLock,
                             WithLockService withLock) {
        this.account  = account;
        this.noLock   = noLock;
        this.withLock = withLock;
    }

    /** Health endpoint at root — matches frontend: GET /health */
    @GetMapping("/health")
    public ResponseEntity<Void> health() {
        return ResponseEntity.ok().build();
    }

    @GetMapping("/api/account/balance")
    public AccountState balance() {
        return new AccountState(account.getBalance(), account.getExpected());
    }

    @PostMapping("/api/account/reset")
    public ResponseEntity<Void> reset() {
        account.reset();
        noLock.reset();
        withLock.reset();
        log.info("[Account] Full reset requested");
        return ResponseEntity.ok().build();
    }
}
