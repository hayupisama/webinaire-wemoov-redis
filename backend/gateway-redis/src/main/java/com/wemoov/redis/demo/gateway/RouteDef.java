package com.wemoov.redis.demo.gateway;

public record RouteDef(
        String path,
        String destination,
        boolean active,
        boolean maintenance
) {}
