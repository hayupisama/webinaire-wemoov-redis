import { HttpRequest } from '@angular/common/http';

// State for the mock
const routes = [
  { path: '/api/hello', destination: 'hello-service-v1', active: true, maintenance: false },
  { path: '/api/users', destination: 'user-service-v1', active: true, maintenance: false },
  { path: '/api/orders', destination: 'order-service-v2', active: true, maintenance: false }
];

export function gatewayMock(req: HttpRequest<unknown>): { body: unknown, delay?: number, status?: number } | null {
  const url = req.url;
  const method = req.method;

  // --- NO REDIS (8081) ---
  if (url.includes('8081/health') && method === 'GET') {
    return { body: { status: 'UP' }, delay: 50 };
  }
  
  if (url.includes('8081/api/hello') && method === 'GET') {
    return { 
      body: { 
        message: 'Hello from Service A (No Redis)', 
        targetService: 'Service A', 
        durationMs: 650 
      }, 
      delay: 650 
    };
  }

  // --- WITH REDIS (8082) ---
  if (url.includes('8082/health') && method === 'GET') {
    return { body: { status: 'UP' }, delay: 50 };
  }

  if (url.includes('8082/api/hello') && method === 'GET') {
    const helloRoute = routes.find(r => r.path === '/api/hello');
    
    if (helloRoute && helloRoute.maintenance) {
      return {
        body: {
          message: 'Service Unavailable (Maintenance Filter)',
          targetService: 'Gateway',
          durationMs: 15,
          error: true
        },
        status: 503,
        delay: 15
      };
    }

    return { 
      body: { 
        message: 'Hello from Service B (With Redis)', 
        targetService: helloRoute ? helloRoute.destination : 'Service B', 
        durationMs: 120 
      }, 
      delay: 120 
    };
  }

  if (url.includes('8082/api/routes') && method === 'GET') {
    return { body: routes, delay: 100 };
  }

  if (url.includes('8082/api/routes') && method === 'POST') {
    const newRoute = req.body as { path: string, destination: string, active?: boolean, maintenance?: boolean };
    const existingIndex = routes.findIndex(r => r.path === newRoute.path);
    if (existingIndex >= 0) {
      routes[existingIndex] = { ...routes[existingIndex], ...newRoute };
    } else {
      routes.push({ ...newRoute, active: true, maintenance: false });
    }
    return { body: newRoute, delay: 200, status: 201 };
  }

  return null;
}
