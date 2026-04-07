package com.wemoov.redis.demo.locks;

import org.springframework.stereotype.Service;

import java.util.concurrent.atomic.AtomicInteger;

@Service
public class NoLockBookingService {

    private final SeatStore seatStore;

    private volatile String stateA = "IDLE";
    private volatile String messageA = "";
    private volatile boolean successA = false;

    private volatile String stateB = "IDLE";
    private volatile String messageB = "";
    private volatile boolean successB = false;

    private volatile boolean done = false;
    private final AtomicInteger completions = new AtomicInteger(0);

    public NoLockBookingService(SeatStore seatStore) {
        this.seatStore = seatStore;
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

    /**
     * Traité directement sur le thread HTTP Spring.
     * Deux requêtes simultanées → deux threads concurrents → race condition naturelle.
     */
    public void book(String seatId, String client) throws InterruptedException {
        setState(client, "CHECKING", "Vérification de la disponibilité...", false);

        // READ sans protection — les deux threads lisent AVAILABLE en même temps
        String readStatus = seatStore.getStatus(seatId);
        Thread.sleep(200); // fenêtre de race condition ouverte

        if ("AVAILABLE".equals(readStatus)) {
            setState(client, "RESERVING", "Réservation en cours...", false);
            Thread.sleep(150);
            // WRITE non-atomique — les deux threads écrivent RESERVED
            seatStore.setStatus(seatId, "RESERVED");
            // Les deux pensent avoir réussi → double réservation !
            setState(client, "SUCCESS", "Place réservée !", true);
        } else {
            setState(client, "CONFLICT", "Place indisponible", false);
        }

        if (completions.incrementAndGet() >= 2) {
            done = true;
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
