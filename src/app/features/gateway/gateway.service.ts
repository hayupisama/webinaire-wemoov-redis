import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map } from 'rxjs';

export interface RouteDef {
  path: string;
  destination: string;
  active: boolean;
  maintenance?: boolean;
}

export interface HelloResponse {
  message: string;
  targetService: string;
  durationMs: number;
  error?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class GatewayService {
  private http = inject(HttpClient);
  private urlNoRedis = 'http://localhost:8081';
  private urlRedis = 'http://localhost:8082';

  checkHealth(withRedis: boolean): Observable<boolean> {
    const url = withRedis ? this.urlRedis : this.urlNoRedis;
    return this.http.get(`${url}/health`, { observe: 'response', responseType: 'text' }).pipe(
      map(res => res.status === 200),
      catchError(() => of(false))
    );
  }

  getHello(withRedis: boolean): Observable<HelloResponse> {
    const url = withRedis ? this.urlRedis : this.urlNoRedis;
    const start = performance.now();
    return this.http.get<{message?: string, targetService?: string}>(`${url}/api/hello`).pipe(
      map(res => ({
        message: res.message || 'Hello World',
        targetService: res.targetService || 'Unknown Service',
        durationMs: Math.round(performance.now() - start)
      })),
      catchError(() => of({
        message: 'Request failed',
        targetService: 'N/A',
        durationMs: Math.round(performance.now() - start),
        error: true
      }))
    );
  }

  getRoutes(): Observable<RouteDef[]> {
    return this.http.get<RouteDef[]>(`${this.urlRedis}/api/routes`).pipe(
      catchError(() => of([]))
    );
  }

  addRoute(route: RouteDef): Observable<boolean> {
    return this.http.post(`${this.urlRedis}/api/routes`, route, { observe: 'response', responseType: 'text' }).pipe(
      map(res => res.status === 200 || res.status === 201),
      catchError(() => of(false))
    );
  }

  updateRoute(route: RouteDef): Observable<boolean> {
    return this.http.post(`${this.urlRedis}/api/routes`, route, { observe: 'response', responseType: 'text' }).pipe(
      map(res => res.status === 200 || res.status === 201),
      catchError(() => of(false))
    );
  }
}
