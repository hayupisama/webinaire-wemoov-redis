package com.wemoov.redis.demo.streams;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@CrossOrigin("*")
@RequestMapping("/api")
public class ProducerController {

    private static final Logger log = LoggerFactory.getLogger(ProducerController.class);

    private final ProducerService service;

    public ProducerController(ProducerService service) {
        this.service = service;
    }

    @GetMapping("/health")
    public ResponseEntity<Void> health() {
        return ResponseEntity.ok().build();
    }

    @GetMapping("/stream")
    public List<StreamMessage> getStream() {
        return service.getStream();
    }

    @PostMapping("/publish")
    public ResponseEntity<Void> publish(@RequestBody Map<String, String> body) {
        String type    = body.getOrDefault("type", "unknown");
        String payload = body.getOrDefault("payload", "");
        log.info("[Producer] POST /publish type='{}' payload='{}'", type, payload);
        service.publish(type, payload);
        return ResponseEntity.status(201).build();
    }

    @PostMapping("/reset")
    public ResponseEntity<Void> reset() {
        log.info("[Producer] POST /reset");
        service.reset();
        return ResponseEntity.ok().build();
    }
}
