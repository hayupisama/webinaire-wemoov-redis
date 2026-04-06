package com.wemoov.redis.demo.ttl;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "sessions")
public class SessionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(nullable = false)
    private String token;

    @Column(nullable = false)
    private Instant createdAt;

    // Postgres doesn't auto-expire rows — we store expiry time for display
    private Instant expiresAt;

    public SessionEntity() {}

    public SessionEntity(String username, String token, Instant createdAt, Instant expiresAt) {
        this.username  = username;
        this.token     = token;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    public Long getId()            { return id; }
    public String getUsername()    { return username; }
    public String getToken()       { return token; }
    public Instant getCreatedAt()  { return createdAt; }
    public Instant getExpiresAt()  { return expiresAt; }
}
