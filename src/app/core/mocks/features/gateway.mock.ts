import { HttpRequest } from '@angular/common/http';

// Static routes for no-redis side (mirrors application.yml)
const noRedisRoutes = [
  { path: '/api/hello',  destination: 'service-a', active: true },
  { path: '/api/orders', destination: 'service-b', active: true },
  { path: '/api/users',  destination: 'service-c', active: true },
  { path: '/api/test',   destination: 'service-d', active: true },
];

// Dynamic routes for redis side
const redisRoutes = [
  { path: '/api/hello',  destination: 'hello-service-v1',  active: true, maintenance: false },
  { path: '/api/users',  destination: 'user-service-v1',   active: true, maintenance: false },
  { path: '/api/orders', destination: 'order-service-v2',  active: true, maintenance: false }
];

// Simulated latencies per destination (no-redis is slow because it reads YAML each time)
const NO_REDIS_LATENCY = 580;

export function gatewayMock(req: HttpRequest<unknown>): { body: unknown, delay?: number, status?: number } | null {
  const url = req.url;
  const method = req.method;

  // --- NO REDIS (8081) ---
  if (url.includes('8081/health') && method === 'GET') {
    return { body: { status: 'UP' }, delay: 50 };
  }

  if (url.includes('8081/api/routes') && method === 'GET') {
    return { body: noRedisRoutes, delay: 80 };
  }

  // Generic endpoint handler for no-redis (matches /api/*)
  const noRedisApiMatch = url.match(/8081(\/api\/[^?]+)/);
  if (noRedisApiMatch && method === 'GET') {
    const path = noRedisApiMatch[1];
    const route = noRedisRoutes.find(r => r.path === path && r.active);
    if (!route) return { body: { error: 'Route introuvable' }, status: 404, delay: 50 };
    return {
      body: { message: `Hello from ${route.destination} (No Redis)`, targetService: route.destination, durationMs: NO_REDIS_LATENCY },
      delay: NO_REDIS_LATENCY
    };
  }

  // --- WITH REDIS (8082) ---
  if (url.includes('8082/health') && method === 'GET') {
    return { body: { status: 'UP' }, delay: 50 };
  }

  if (url.includes('8082/api/routes') && method === 'GET') {
    return { body: redisRoutes, delay: 100 };
  }

  if (url.includes('8082/api/routes') && method === 'POST') {
    const newRoute = req.body as { path: string, destination: string, active?: boolean, maintenance?: boolean };
    const existingIndex = redisRoutes.findIndex(r => r.path === newRoute.path);
    if (existingIndex >= 0) {
      redisRoutes[existingIndex] = { ...redisRoutes[existingIndex], ...newRoute };
    } else {
      redisRoutes.push({ ...newRoute, active: true, maintenance: false });
    }
    return { body: newRoute, delay: 200, status: 201 };
  }

  // Generic endpoint handler for redis
  const redisApiMatch = url.match(/8082(\/api\/[^?]+)/);
  if (redisApiMatch && method === 'GET') {
    const path = redisApiMatch[1];
    const route = redisRoutes.find(r => r.path === path && r.active);
    if (!route) return { body: { error: 'Route introuvable' }, status: 404, delay: 20 };
    if (route.maintenance) {
      return { body: { error: 'Service en maintenance' }, status: 503, delay: 15 };
    }
    const latency = 80 + Math.floor(Math.random() * 60);
    return {
      body: { message: `Hello from ${route.destination} (Redis)`, targetService: route.destination, durationMs: latency },
      delay: latency
    };
  }

  return null;
}
