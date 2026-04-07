package com.wemoov.redis.demo.locks;

import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SeatStore {

    private static final List<String> SEAT_IDS;

    static {
        List<String> ids = new ArrayList<>();
        for (char row : new char[]{'A', 'B'}) {
            for (int col = 1; col <= 6; col++) {
                ids.add(row + String.valueOf(col));
            }
        }
        SEAT_IDS = Collections.unmodifiableList(ids);
    }

    private final Map<String, String> seatStatus = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        reset();
    }

    public void reset() {
        SEAT_IDS.forEach(id -> seatStatus.put(id, "AVAILABLE"));
    }

    public List<Seat> getSeats() {
        return SEAT_IDS.stream()
                .map(id -> new Seat(id, seatStatus.getOrDefault(id, "AVAILABLE")))
                .toList();
    }

    public String getStatus(String seatId) {
        return seatStatus.getOrDefault(seatId, "AVAILABLE");
    }

    public void setStatus(String seatId, String status) {
        seatStatus.put(seatId, status);
    }
}
