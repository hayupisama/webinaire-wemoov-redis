package com.wemoov.redis.demo.locks;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/no-lock/api/concert")
@CrossOrigin("*")
public class NoLockConcertController {

    private final NoLockBookingService service;

    public NoLockConcertController(NoLockBookingService service) {
        this.service = service;
    }

    /**
     * Chaque appel est traité sur son propre thread HTTP Spring.
     * Le frontend envoie deux requêtes simultanées (client=A et client=B)
     * → race condition naturelle entre les deux handlers.
     */
    @PostMapping("/book")
    public void book(@RequestParam String seatId, @RequestParam String client)
            throws InterruptedException {
        service.book(seatId, client);
    }

    @GetMapping("/status")
    public BookingStatus getStatus() {
        return service.getStatus();
    }
}
