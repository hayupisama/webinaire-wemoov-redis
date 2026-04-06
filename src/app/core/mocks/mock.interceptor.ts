import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, delay, of } from 'rxjs';
import { gatewayMock } from './features/gateway.mock';
import { rateLimitingMock } from './features/rate-limiting.mock';
import { streamsMock } from './features/streams.mock';
import { locksMock } from './features/locks.mock';
import { geoMock } from './features/geo.mock';
import { ttlMock } from './features/ttl.mock';

export const mockInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
  // Try to find a mock for this request
  const mockResponse = gatewayMock(req) || rateLimitingMock(req) || streamsMock(req) || locksMock(req) || geoMock(req) || ttlMock(req);
  
  if (mockResponse) {
    console.log(`[MOCK] Intercepted ${req.method} ${req.url}`);
    return of(new HttpResponse({ 
      status: mockResponse.status || 200, 
      body: mockResponse.body 
    })).pipe(
      delay(mockResponse.delay || 0)
    );
  }

  // If no mock found, pass the request through
  return next(req);
};
