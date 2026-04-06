package com.wemoov.redis.demo.locks;

/**
 * Response DTO matching the Angular frontend contract:
 * { threadA, threadB, done, finalExpected?, finalActual? }
 */
public record ThreadStatus(
        String threadA,
        String threadB,
        boolean done,
        Integer finalExpected,
        Integer finalActual
) {}
