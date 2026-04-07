package com.wemoov.redis.demo.locks;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class WithLockBookingService {

    private static final String LOCK_PREFIX = "lock:seat:";

    private final SeatStore seatStore;
    private final StringRedisTemplate redis;

    private volatile String stateA = "IDLE";
    private volatile String messageA = "";
    private volatile boolean successA = false;

    private volatile String stateB = "IDLE";
    private volatile String messageB = "";
    private volatile boolean successB = false;

    private volatile boolean done = false;
    private final AtomicInteger completions = new AtomicInteger(0);

    public WithLockBookingService(SeatStore seatStore, StringRedisTemplate redis) {
        this.seatStore = seatStore;
        this.redis = redis;
    }

    public void reset() {
        stateA = stateB = "IDLE";
        messageA = messageB = "";
        successA = successB = false;
        done = false;
        completions.set(0);
    }

    public BookingStatus getStatus() {
        return new BookingStatus(
                new BookingClientState(stateA, messageA, successA),
                new BookingClientState(stateB, messageB, successB),
                done
        );
    }

    public LockStatus getLockStatus(String seatId) {
        String owner = redis.opsForValue().get(LOCK_PREFIX + seatId);
        return new LockStatus(owner);
    }

    public void releaseSeat(String seatId) {
        seatStore.setStatus(seatId, "AVAILABLE");
        redis.delete(LOCK_PREFIX + seatId);
    }

    /**
     * Traité directement sur le thread HTTP Spring.
     * Deux requêtes simultanées → le premier acquiert le verrou, le second attend.
     */
    public void bookWithLock(String seatId, String client) throws InterruptedException {
        String lockKey = LOCK_PREFIX + seatId;
        String lockValue = "Client-" + client;

        setState(client, "WAITING_LOCK", "En attente du verrou Redis...", false);

        // Spin-lock avec SETNX atomique
        while (true) {
            Boolean acquired = redis.opsForValue()
                    .setIfAbsent(lockKey, lockValue, Duration.ofSeconds(30));
            if (Boolean.TRUE.equals(acquired)) break;
            Thread.sleep(50);
        }

        try {
            setState(client, "CHECKING", "Vérification disponibilité (verrou acquis)...", false);
            Thread.sleep(150);

            String status = seatStore.getStatus(seatId);

            if (!"AVAILABLE".equals(status)) {
                setState(client, "CONFLICT", "Place déjà réservée — refus propre", false);
                return;
            }

            setState(client, "RESERVING", "Réservation sécurisée...", false);
            Thread.sleep(150);
            seatStore.setStatus(seatId, "RESERVED");

            setState(client, "PAYING", "Traitement du paiement...", false);
            Thread.sleep(400);
            seatStore.setStatus(seatId, "PAID");

            setState(client, "SUCCESS", "Place confirmée et payée", true);

        } finally {
            redis.delete(lockKey);
            if (completions.incrementAndGet() >= 2) {
                done = true;
            }
        }
    }

    private void setState(String client, String state, String message, boolean success) {
        if ("A".equals(client)) {
            stateA = state;
            messageA = message;
            successA = success;
        } else {
            stateB = state;
            messageB = message;
            successB = success;
        }
    }
}
