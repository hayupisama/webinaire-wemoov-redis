package com.wemoov.redis.demo.streams;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.connection.stream.*;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;

@Service
public class ConsumerService {

    private static final Logger log           = LoggerFactory.getLogger(ConsumerService.class);
    private static final String STREAM_KEY    = "events";
    private static final String PROCESSED_KEY = "events:processed";
    private static final String GROUP         = "demo-group";
    private static final String CONSUMER      = "consumer-1";

    private final StringRedisTemplate redis;
    private final ObjectMapper        mapper = new ObjectMapper();

    public ConsumerService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void init() {
        try {
            redis.opsForStream().createGroup(STREAM_KEY, ReadOffset.from("0"), GROUP);
            log.info("[Consumer] Consumer group '{}' created on stream '{}'", GROUP, STREAM_KEY);
        } catch (Exception e) {
            log.info("[Consumer] Consumer group '{}' already exists — catching up PEL", GROUP);
        }
        // Recover messages from PEL after restart
        processBatch(StreamOffset.create(STREAM_KEY, ReadOffset.from("0")));
    }

    @Scheduled(fixedDelay = 300)
    public void consume() {
        processBatch(StreamOffset.create(STREAM_KEY, ReadOffset.lastConsumed()));
    }

    private void processBatch(StreamOffset<String> offset) {
        try {
            List<MapRecord<String, Object, Object>> messages = redis.opsForStream().read(
                    Consumer.from(GROUP, CONSUMER),
                    StreamReadOptions.empty().count(20),
                    offset
            );
            if (messages == null || messages.isEmpty()) return;

            for (MapRecord<String, Object, Object> msg : messages) {
                String id      = msg.getId().getValue();
                String type    = (String) msg.getValue().getOrDefault("type", "");
                String payload = (String) msg.getValue().getOrDefault("payload", "");
                long   ts      = Long.parseLong(id.split("-")[0]);

                StreamMessage sm = new StreamMessage(id, type, payload, ts);
                try {
                    redis.opsForList().rightPush(PROCESSED_KEY, mapper.writeValueAsString(sm));
                    log.info("[Consumer] XREADGROUP → processed id={} type='{}' payload='{}'", id, type, payload);
                } catch (JsonProcessingException e) {
                    log.error("[Consumer] Failed to serialize message id={}: {}", id, e.getMessage());
                }
                redis.opsForStream().acknowledge(STREAM_KEY, GROUP, id);
            }
        } catch (Exception e) {
            // Stream may not exist yet — normal at startup
            log.debug("[Consumer] processBatch error (stream may not exist yet): {}", e.getMessage());
        }
    }

    public List<StreamMessage> getProcessed() {
        List<String> raw = redis.opsForList().range(PROCESSED_KEY, 0, -1);
        if (raw == null) return Collections.emptyList();
        return raw.stream().map(json -> {
            try { return mapper.readValue(json, StreamMessage.class); }
            catch (Exception e) {
                log.error("[Consumer] Failed to deserialize processed message: {}", e.getMessage());
                return null;
            }
        }).filter(m -> m != null).toList();
    }
}
