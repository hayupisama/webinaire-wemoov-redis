package com.wemoov.redis.demo.locks;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/with-lock/api/concert")
@CrossOrigin("*")
public class WithLockConcertController {

    private final WithLockBookingService service;

    public WithLockConcertController(WithLockBookingService service) {
        this.service = service;
    }

    @PostMapping("/book")
    public void book(@RequestParam String seatId, @RequestParam String client)
            throws InterruptedException {
        service.bookWithLock(seatId, client);
    }

    @GetMapping("/status")
    public BookingStatus getStatus() {
        return service.getStatus();
    }

    @GetMapping("/lock")
    public LockStatus getLockStatus(@RequestParam String seatId) {
        return service.getLockStatus(seatId);
    }

    @PostMapping("/release")
    public void release(@RequestParam String seatId) {
        service.releaseSeat(seatId);
    }
}
