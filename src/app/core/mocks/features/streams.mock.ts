import { HttpRequest } from '@angular/common/http';
import { StreamMessage } from '../../../features/streams/streams.service';

let streamMessages: StreamMessage[] = [];
const processedMessages: StreamMessage[] = [];
const consumerIsHealthy = true;

// Simulate consumer processing
setInterval(() => {
  if (consumerIsHealthy && streamMessages.length > processedMessages.length) {
    // Process one message every 500ms if healthy
    const nextMsg = streamMessages[processedMessages.length];
    if (nextMsg) {
      processedMessages.push(nextMsg);
    }
  }
}, 500);

export function streamsMock(req: HttpRequest<unknown>): { body: unknown, delay?: number, status?: number } | null {
  const url = req.url;
  const method = req.method;

  // --- PRODUCER (8085) ---
  if (url.includes('8085/producer/api/publish') && method === 'POST') {
    const body = req.body as { type: string, payload: string };
    const newMsg: StreamMessage = {
      id: `${Date.now()}-0`,
      type: body.type,
      payload: body.payload,
      timestamp: Date.now()
    };
    streamMessages = [newMsg, ...streamMessages]; // Prepend for UI
    return { body: { message: 'Published' }, status: 201, delay: 100 };
  }

  if (url.includes('8085/producer/api/stream') && method === 'GET') {
    return { body: streamMessages, delay: 50 };
  }

  // --- CONSUMER (8085) ---
  if (url.includes('8085/consumer/api/health') && method === 'GET') {
    return { body: consumerIsHealthy ? 'UP' : 'DOWN', status: consumerIsHealthy ? 200 : 503, delay: 20 };
  }

  if (url.includes('8085/consumer/api/processed') && method === 'GET') {
    return { body: processedMessages, delay: 50 };
  }

  return null;
}
