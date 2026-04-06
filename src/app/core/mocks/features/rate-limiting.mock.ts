import { HttpRequest } from '@angular/common/http';

let noRedisCounters: Record<string, number> = { A: 0, B: 0, C: 0 };
let redisCounter = 0;

export function rateLimitingMock(req: HttpRequest<unknown>): { body: unknown, delay?: number, status?: number } | null {
  const url = req.url;
  const method = req.method;

  // --- NO REDIS (8083) ---
  if (url.includes('8083/api/rate/counter') && method === 'GET') {
    const urlObj = new URL(url);
    const instance = urlObj.searchParams.get('instance') || 'A';
    return { body: { count: noRedisCounters[instance] || 0 }, delay: 20 };
  }
  
  if (url.includes('8083/api/rate/hit') && method === 'POST') {
    const urlObj = new URL(url);
    const instance = urlObj.searchParams.get('instance') || 'A';
    noRedisCounters[instance] = (noRedisCounters[instance] || 0) + 1;
    const status = noRedisCounters[instance] > 10 ? 429 : 200;
    return { body: { message: status === 200 ? 'OK' : 'Too Many Requests' }, status, delay: 40 };
  }
  
  if (url.includes('8083/api/rate/reset') && method === 'POST') {
    noRedisCounters = { A: 0, B: 0, C: 0 };
    return { body: { message: 'Reset OK' }, status: 200, delay: 30 };
  }

  // --- WITH REDIS (8084) ---
  if (url.includes('8084/api/rate/counter') && method === 'GET') {
    return { body: { count: redisCounter }, delay: 20 };
  }
  
  if (url.includes('8084/api/rate/hit') && method === 'POST') {
    redisCounter++;
    const status = redisCounter > 30 ? 429 : 200;
    return { body: { message: status === 200 ? 'OK' : 'Too Many Requests' }, status, delay: 40 };
  }
  
  if (url.includes('8084/api/rate/reset') && method === 'POST') {
    redisCounter = 0;
    return { body: { message: 'Reset OK' }, status: 200, delay: 30 };
  }

  return null;
}
