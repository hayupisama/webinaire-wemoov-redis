package com.wemoov.redis.demo.streams;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class StreamsConsumerApplication {
    public static void main(String[] args) {
        SpringApplication.run(StreamsConsumerApplication.class, args);
    }
}
