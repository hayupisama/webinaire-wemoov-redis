package com.wemoov.redis.demo.streams;

public record StreamMessage(String id, String type, String payload, long timestamp) {}
