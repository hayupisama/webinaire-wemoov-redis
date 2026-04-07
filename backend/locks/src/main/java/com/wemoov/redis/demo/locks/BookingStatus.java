package com.wemoov.redis.demo.locks;

public record BookingStatus(BookingClientState clientA, BookingClientState clientB, boolean done) {}
