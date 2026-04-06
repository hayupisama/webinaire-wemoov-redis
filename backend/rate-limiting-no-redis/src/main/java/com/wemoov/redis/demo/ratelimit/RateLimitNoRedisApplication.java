package com.wemoov.redis.demo.ratelimit;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class RateLimitNoRedisApplication {
    public static void main(String[] args) {
        SpringApplication.run(RateLimitNoRedisApplication.class, args);
    }
}
