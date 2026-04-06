package com.wemoov.redis.demo.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(GatewayProperties.class)
public class GatewayNoRedisApplication {
    public static void main(String[] args) {
        SpringApplication.run(GatewayNoRedisApplication.class, args);
    }
}
