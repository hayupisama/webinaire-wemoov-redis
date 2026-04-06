package com.wemoov.redis.demo.ttl;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SessionRepository extends JpaRepository<SessionEntity, Long> {
    Optional<SessionEntity> findByUsername(String username);
    void deleteByUsername(String username);
}
