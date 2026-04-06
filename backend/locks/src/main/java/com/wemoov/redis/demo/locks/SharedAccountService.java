package com.wemoov.redis.demo.locks;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.concurrent.atomic.AtomicInteger;

/**
 * Single source of truth for the shared bank account balance.
 * Both NoLockService and WithLockService operate on this.
 */
@Service
public class SharedAccountService {

    private static final Logger log = LoggerFactory.getLogger(SharedAccountService.class);
    private static final int INITIAL_BALANCE = 1000;
    static final int DEBIT_AMOUNT = 500;

    /** Actual balance — intentionally volatile to expose the race condition */
    private volatile int balance = INITIAL_BALANCE;

    /** Counts logical debit completions to compute the "expected" balance */
    private final AtomicInteger completedDebits = new AtomicInteger(0);

    public void reset() {
        balance = INITIAL_BALANCE;
        completedDebits.set(0);
        log.info("[Account] Reset → balance={}, expected={}", INITIAL_BALANCE, INITIAL_BALANCE);
    }

    public int getBalance()  { return balance; }
    public int getExpected() { return Math.max(0, INITIAL_BALANCE - completedDebits.get() * DEBIT_AMOUNT); }

    /** Write the balance directly (no synchronization — used by no-lock service) */
    public void setBalance(int b) { this.balance = b; }

    /** Read the current balance (used by threads before debiting) */
    public int readBalance() { return balance; }

    /** Record that a logical debit has completed (updates the expected calculation) */
    public void recordDebitCompletion() { completedDebits.incrementAndGet(); }
}
