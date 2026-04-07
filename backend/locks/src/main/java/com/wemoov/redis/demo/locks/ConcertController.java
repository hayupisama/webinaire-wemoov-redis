package com.wemoov.redis.demo.locks;

import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@CrossOrigin("*")
public class ConcertController {

    private final SeatStore seatStore;
    private final NoLockBookingService noLockBookingService;
    private final WithLockBookingService withLockBookingService;

    public ConcertController(SeatStore seatStore,
                             NoLockBookingService noLockBookingService,
                             WithLockBookingService withLockBookingService) {
        this.seatStore = seatStore;
        this.noLockBookingService = noLockBookingService;
        this.withLockBookingService = withLockBookingService;
    }

    @GetMapping("/api/concert/seats")
    public List<Seat> getSeats() {
        return seatStore.getSeats();
    }

    @PostMapping("/api/concert/reset")
    public void reset() {
        seatStore.reset();
        noLockBookingService.reset();
        withLockBookingService.reset();
    }
}
