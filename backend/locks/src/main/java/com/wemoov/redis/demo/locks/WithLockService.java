package com.wemoov.redis.demo.locks;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.CompletableFuture;

@Service
public class WithLockService {

    private static final Logger log = LoggerFactory.getLogger(WithLockService.class);
    private static final String LOCK_KEY = "lock:account:FR001";

    private final SharedAccountService account;
    private final StringRedisTemplate   redis;

    // Thread states — volatile for cross-thread visibility
    private volatile ThreadState stateA = ThreadState.IDLE;
    private volatile ThreadState stateB = ThreadState.IDLE;
    private volatile boolean done = false;
    private volatile int finalActual = 0;

    public WithLockService(SharedAccountService account, StringRedisTemplate redis) {
        this.account = account;
        this.redis   = redis;
    }

    public void reset() {
        stateA = ThreadState.IDLE;
        stateB = ThreadState.IDLE;
        done   = false;
        redis.delete(LOCK_KEY);
        log.info("[WithLock] State reset, lock released");
    }

    public LockStatus getLockStatus() {
        String holder = redis.opsForValue().get(LOCK_KEY);
        return new LockStatus(holder);
    }

    public void launchConcurrentDebits() {
        done   = false;
        stateA = ThreadState.IDLE;
        stateB = ThreadState.IDLE;
        log.info("[WithLock] Launching 2 concurrent threads — balance={}", account.getBalance());

        CompletableFuture<Void> a = CompletableFuture.runAsync(() -> runDebitWithLock("A"));
        CompletableFuture<Void> b = CompletableFuture.runAsync(() -> runDebitWithLock("B"));

        CompletableFuture.allOf(a, b).thenRun(() -> {
            finalActual = account.getBalance();
            done = true;
            log.info("[WithLock] Both threads done — balance={} expected={} → CONSISTENT",
                    finalActual, account.getExpected());
        });
    }

    private void runDebitWithLock(String name) {
        try {
            setThreadState(name, ThreadState.WAITING_LOCK);
            log.info("[WithLock][Thread-{}] Waiting for Redis lock...", name);

            // Spin until the distributed lock is acquired (SETNX)
            while (true) {
                Boolean acquired = redis.opsForValue()
                        .setIfAbsent(LOCK_KEY, "Thread-" + name, Duration.ofSeconds(10));
                if (Boolean.TRUE.equals(acquired)) {
                    log.info("[WithLock][Thread-{}] Lock acquired", name);
                    break;
                }
                Thread.sleep(50);
            }

            try {
                setThreadState(name, ThreadState.READING);
                log.info("[WithLock][Thread-{}] Reading balance under lock...", name);
                Thread.sleep(100);

                int read = account.readBalance(); // Safe — we hold the lock
                log.info("[WithLock][Thread-{}] Read balance={}", name, read);

                setThreadState(name, ThreadState.DEBITING);
                Thread.sleep(200);

                int newBalance = read - SharedAccountService.DEBIT_AMOUNT;
                account.setBalance(newBalance);
                account.recordDebitCompletion();

                setThreadState(name, ThreadState.DONE);
                log.info("[WithLock][Thread-{}] Wrote balance={} safely", name, newBalance);

            } finally {
                redis.delete(LOCK_KEY);
                log.info("[WithLock][Thread-{}] Lock released", name);
            }

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            setThreadState(name, ThreadState.ERROR);
            log.error("[WithLock][Thread-{}] Interrupted", name);
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
