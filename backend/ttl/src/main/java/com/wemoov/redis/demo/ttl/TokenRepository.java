package com.wemoov.redis.demo.ttl;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TokenRepository extends JpaRepository<TokenEntity, Long> {
    void deleteByEmail(String email);
}
