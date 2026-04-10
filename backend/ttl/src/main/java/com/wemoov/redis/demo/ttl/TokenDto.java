package com.wemoov.redis.demo.ttl;

/**
 * Covers both frontend shapes:
 * - NoTtlToken  { id, email, code, createdAt }
 * - WithTtlToken { id, email, code, ttlRemaining, initialTtl }
 */
public record TokenDto(
        String id,
        String email,
        String code,
        Long   createdAt,    // epoch ms — null for Redis tokens
        Long   ttlRemaining, // seconds remaining — null for Postgres tokens
        Long   initialTtl    // original TTL in seconds — null for Postgres tokens
) {}
