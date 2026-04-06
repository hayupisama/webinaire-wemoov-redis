import { HttpRequest } from '@angular/common/http';
import { NoTtlSession, WithTtlSession } from '../../../features/ttl/ttl.service';

let noTtlSessions: NoTtlSession[] = [];
let withTtlSessions: (WithTtlSession & { _createdAt: number })[] = [];

export function ttlMock(req: HttpRequest<unknown>): { body: unknown, delay?: number, status?: number } | null {
  const url = req.url;
  const method = req.method;

  // --- NO TTL ---
  if (url.includes('8088/no-ttl/api/sessions') && method === 'GET') {
    return { body: noTtlSessions, delay: 20 };
  }

  if (url.includes('8088/no-ttl/api/sessions') && method === 'POST' && !url.includes('cleanup')) {
    const body = req.body as { username: string };
    noTtlSessions.push({
      id: Math.random().toString(36).substring(7),
      username: body.username,
      createdAt: Date.now()
    });
    return { body: { message: 'Created' }, status: 201, delay: 50 };
  }

  if (url.includes('8088/no-ttl/api/sessions/cleanup') && method === 'POST') {
    const now = Date.now();
    noTtlSessions = noTtlSessions.filter(s => now - s.createdAt <= 30000);
    return { body: { message: 'Cleaned' }, status: 200, delay: 200 };
  }

  // --- WITH TTL ---
  if (url.includes('8088/with-ttl/api/sessions') && method === 'GET') {
    const now = Date.now();
    // Filter out expired sessions and calculate remaining TTL
    withTtlSessions = withTtlSessions.filter(s => {
      const elapsed = Math.floor((now - s._createdAt) / 1000);
      s.ttlRemaining = Math.max(0, s.initialTtl - elapsed);
      return s.ttlRemaining > 0;
    });
    return { body: withTtlSessions, delay: 20 };
  }

  if (url.includes('8088/with-ttl/api/sessions') && method === 'POST') {
    const body = req.body as { username: string, ttl: number };
    withTtlSessions.push({
      id: Math.random().toString(36).substring(7),
      username: body.username,
      initialTtl: body.ttl,
      ttlRemaining: body.ttl,
      _createdAt: Date.now()
    });
    return { body: { message: 'Created' }, status: 201, delay: 50 };
  }

  return null;
}
