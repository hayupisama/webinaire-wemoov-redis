import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RateLimitService {
  private http = inject(HttpClient);
  private urlNoRedis = 'http://localhost:8083';
  private urlRedis = 'http://localhost:8084';

  // --- NO REDIS ---
  getCounterNoRedis(instance: string): Observable<number> {
    return this.http.get<{count: number}>(`${this.urlNoRedis}/api/rate/counter?instance=${instance}`).pipe(
      map(res => res.count),
      catchError(() => of(0))
    );
  }

  hitNoRedis(instance: string): Observable<number> {
    return this.http.post(`${this.urlNoRedis}/api/rate/hit?instance=${instance}`, null, { observe: 'response' }).pipe(
      map(res => res.status),
      catchError(err => of(err.status || 500))
    );
  }

  resetNoRedis(): Observable<boolean> {
    return this.http.post(`${this.urlNoRedis}/api/rate/reset`, null, { observe: 'response' }).pipe(
      map(res => res.status === 200),
      catchError(() => of(false))
    );
  }

  // --- WITH REDIS ---
  getCounterRedis(): Observable<number> {
    return this.http.get<{count: number}>(`${this.urlRedis}/api/rate/counter`).pipe(
      map(res => res.count),
      catchError(() => of(0))
    );
  }

  hitRedis(): Observable<number> {
    return this.http.post(`${this.urlRedis}/api/rate/hit`, null, { observe: 'response' }).pipe(
      map(res => res.status),
      catchError(err => of(err.status || 500))
    );
  }

  resetRedis(): Observable<boolean> {
    return this.http.post(`${this.urlRedis}/api/rate/reset`, null, { observe: 'response' }).pipe(
      map(res => res.status === 200),
      catchError(() => of(false))
    );
  }
}
