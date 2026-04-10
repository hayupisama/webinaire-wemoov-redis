package com.wemoov.redis.demo.ttl;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "tokens_2fa")
public class TokenEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private String code;

    @Column(nullable = false)
    private Instant createdAt;

    public TokenEntity() {}

    public TokenEntity(String email, String code, Instant createdAt) {
        this.email     = email;
        this.code      = code;
        this.createdAt = createdAt;
    }

    public Long getId()           { return id; }
    public String getEmail()      { return email; }
    public String getCode()       { return code; }
    public Instant getCreatedAt() { return createdAt; }
}
