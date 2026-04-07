package com.wemoov.redis.demo.locks;

public record BookingClientState(String state, String message, boolean success) {}
