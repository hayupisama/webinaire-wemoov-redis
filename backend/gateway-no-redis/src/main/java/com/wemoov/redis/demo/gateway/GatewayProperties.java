package com.wemoov.redis.demo.gateway;

import org.springframework.boot.context.properties.ConfigurationProperties;
import java.util.List;

@ConfigurationProperties(prefix = "gateway")
public record GatewayProperties(List<RouteEntry> routes) {
    public record RouteEntry(String path, String destination, boolean active) {}
}
