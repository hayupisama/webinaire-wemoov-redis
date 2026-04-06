package com.wemoov.redis.demo.locks;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

@Service
public class NoLockService {

    private static final Logger log = LoggerFactory.getLogger(NoLockService.class);

    private final SharedAccountService account;

    // Thread states — volatile for cross-thread visibility
    private volatile ThreadState stateA = ThreadState.IDLE;
    private volatile ThreadState stateB = ThreadState.IDLE;
    private volatile boolean done = false;
    private volatile int finalActual = 0;

    public NoLockService(SharedAccountService account) {
        this.account = account;
    }

    public void reset() {
        stateA = ThreadState.IDLE;
        stateB = ThreadState.IDLE;
        done   = false;
        log.info("[NoLock] State reset");
    }

    public void launchConcurrentDebits() {
        done   = false;
        stateA = ThreadState.IDLE;
        stateB = ThreadState.IDLE;
        log.info("[NoLock] Launching 2 concurrent threads — balance={}", account.getBalance());

        CompletableFuture<Void> a = CompletableFuture.runAsync(() -> runDebit("A"));
        CompletableFuture<Void> b = CompletableFuture.runAsync(() -> runDebit("B"));

        CompletableFuture.allOf(a, b).thenRun(() -> {
            finalActual = account.getBalance();
            done = true;
            log.warn("[NoLock] Both threads done — balance={} expected={} → INCONSISTENCY DETECTED",
                    finalActual, account.getExpected());
        });
    }

    private void runDebit(String name) {
        try {
            setThreadState(name, ThreadState.READING);
            log.info("[NoLock][Thread-{}] Reading balance...", name);
            Thread.sleep(100);

            int read = account.readBalance(); // No lock — race condition here!
            log.info("[NoLock][Thread-{}] Read balance={}", name, read);

            setThreadState(name, ThreadState.DEBITING);
            Thread.sleep(200); // Simulate business logic

            int newBalance = read - SharedAccountService.DEBIT_AMOUNT;
            account.setBalance(newBalance);              // Unsafe write!
            account.recordDebitCompletion();

            setThreadState(name, ThreadState.DONE);
            log.info("[NoLock][Thread-{}] Wrote balance={} (read={}, debit={})",
                    name, newBalance, read, SharedAccountService.DEBIT_AMOUNT);

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            setThreadState(name, ThreadState.ERROR);
            log.error("[NoLock][Thread-{}] Interrupted", name);
        }
    }

    private void setThreadState(String name, ThreadState state) {
        if ("A".equals(name)) stateA = state;
        else stateB = state;
    }

    public ThreadStatus getStatus() {
        return new ThreadStatus(
                stateA.name(),
                stateB.name(),
                done,
                done ? account.getExpected() : null,
                done ? finalActual : null
        );
    }
}
