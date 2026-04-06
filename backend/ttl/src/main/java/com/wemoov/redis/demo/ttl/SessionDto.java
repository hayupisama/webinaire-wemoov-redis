package com.wemoov.redis.demo.ttl;

/**
 * Matches both frontend session shapes:
 * - NoTtlSession  { id, username, createdAt }
 * - WithTtlSession { id, username, ttlRemaining, initialTtl }
 */
public record SessionDto(
        String id,           // = username (unique key)
        String username,
        Long   createdAt,    // epoch ms — null for Redis sessions
        Long   ttlRemaining, // seconds remaining — null for Postgres sessions
        Long   initialTtl    // original TTL in seconds — null for Postgres sessions
) {}
