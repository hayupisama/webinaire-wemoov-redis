package com.wemoov.redis.demo.geo;

/** Matches frontend GeoResult { name, distance } */
public record GeoResult(String name, double distance) {}
