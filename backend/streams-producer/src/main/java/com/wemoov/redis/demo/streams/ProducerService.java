package com.wemoov.redis.demo.streams;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.connection.stream.RecordId;
import org.springframework.data.redis.connection.stream.StreamRecords;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class ProducerService {

    private static final Logger log = LoggerFactory.getLogger(ProducerService.class);

    static final String STREAM_KEY    = "events";
    static final String PROCESSED_KEY = "events:processed";

    private final StringRedisTemplate redis;

    public ProducerService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void publish(String type, String payload) {
        MapRecord<String, String, String> record = StreamRecords
                .newRecord()
                .ofMap(Map.of("type", type, "payload", payload))
                .withStreamKey(STREAM_KEY);
        RecordId id = redis.opsForStream().add(record);
        log.info("[Producer] XADD {} → id={} type='{}' payload='{}'",
                STREAM_KEY, id != null ? id.getValue() : "?", type, payload);
    }

    public List<StreamMessage> getStream() {
        List<MapRecord<String, Object, Object>> entries =
                redis.opsForStream().range(STREAM_KEY, org.springframework.data.domain.Range.unbounded());

        if (entries == null) return List.of();

        return entries.stream().map(e -> {
            String id        = e.getId().getValue();
            String type      = (String) e.getValue().getOrDefault("type", "");
            String payload   = (String) e.getValue().getOrDefault("payload", "");
            long   timestamp = Long.parseLong(id.split("-")[0]);
            return new StreamMessage(id, type, payload, timestamp);
        }).toList();
    }

    public void reset() {
        redis.delete(STREAM_KEY);
        redis.delete(PROCESSED_KEY);
        log.info("[Producer] Stream reset — DEL {} {}", STREAM_KEY, PROCESSED_KEY);
    }
}
