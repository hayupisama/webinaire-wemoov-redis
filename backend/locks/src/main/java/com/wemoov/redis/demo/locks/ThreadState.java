package com.wemoov.redis.demo.locks;

public enum ThreadState {
    IDLE, READING, DEBITING, WAITING_LOCK, DONE, ERROR
}
