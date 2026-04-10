import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map } from 'rxjs';

export interface NoTtlSession {
  id: string;
  username: string;
  createdAt: number;
}

export interface WithTtlSession {
  id: string;
  username: string;
  ttlRemaining: number; // in seconds
  initialTtl: number; // in seconds
}

export interface NoTtlToken {
  id: string;
  email: string;
  code: string;
  createdAt: number; // epoch ms
}

export interface WithTtlToken {
  id: string;
  email: string;
  code: string;
  ttlRemaining: number; // in seconds
  initialTtl: number; // in seconds
}

@Injectable({ providedIn: 'root' })
export class TtlService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:8088';

  checkHealth(): Observable<boolean> {
    return this.http.get(`${this.baseUrl}/health`, { observe: 'response', responseType: 'text' }).pipe(
      map(res => res.status === 200),
      catchError(() => of(false))
    );
  }

  resetAll(): Observable<boolean> {
    return this.http.post(`${this.baseUrl}/api/sessions/reset`, {}, { observe: 'response', responseType: 'text' }).pipe(
      map(res => res.status === 200),
      catchError(() => of(false))
    );
  }

  // --- NO TTL SESSIONS ---
  getNoTtlSessions(): Observable<NoTtlSession[]> {
    return this.http.get<NoTtlSession[]>(`${this.baseUrl}/no-ttl/api/sessions`).pipe(
      catchError(() => of([]))
    );
  }

  createNoTtlSession(username: string): Observable<boolean> {
    return this.http.post(`${this.baseUrl}/no-ttl/api/sessions`, { username }, { observe: 'response' }).pipe(
      map(res => res.status === 200 || res.status === 201),
      catchError(() => of(false))
    );
  }

  cleanupNoTtlSessions(): Observable<boolean> {
    return this.http.post(`${this.baseUrl}/no-ttl/api/sessions/cleanup`, {}, { observe: 'response' }).pipe(
      map(res => res.status === 200),
      catchError(() => of(false))
    );
  }

  // --- WITH TTL SESSIONS ---
  getWithTtlSessions(): Observable<WithTtlSession[]> {
    return this.http.get<WithTtlSession[]>(`${this.baseUrl}/with-ttl/api/sessions`).pipe(
      catchError(() => of([]))
    );
  }

  createWithTtlSession(username: string, ttl: number): Observable<boolean> {
    return this.http.post(`${this.baseUrl}/with-ttl/api/sessions`, { username, ttl }, { observe: 'response' }).pipe(
      map(res => res.status === 200 || res.status === 201),
      catchError(() => of(false))
    );
  }

  // --- NO TTL 2FA TOKENS ---
  getNoTtlTokens(): Observable<NoTtlToken[]> {
    return this.http.get<NoTtlToken[]>(`${this.baseUrl}/no-ttl/api/2fa/tokens`).pipe(
      catchError(() => of([]))
    );
  }

  generateNoTtlToken(email: string): Observable<boolean> {
    return this.http.post(`${this.baseUrl}/no-ttl/api/2fa/generate`, { email }, { observe: 'response' }).pipe(
      map(res => res.status === 200 || res.status === 201),
      catchError(() => of(false))
    );
  }

  cleanupExpiredTokens(): Observable<boolean> {
    return this.http.post(`${this.baseUrl}/no-ttl/api/2fa/cleanup`, {}, { observe: 'response' }).pipe(
      map(res => res.status === 200),
      catchError(() => of(false))
    );
  }

  resetTokens(): Observable<boolean> {
    return this.http.post(`${this.baseUrl}/api/2fa/reset`, {}, { observe: 'response', responseType: 'text' }).pipe(
      map(res => res.status === 200),
      catchError(() => of(false))
    );
  }

  // --- WITH TTL 2FA TOKENS ---
  getWithTtlTokens(): Observable<WithTtlToken[]> {
    return this.http.get<WithTtlToken[]>(`${this.baseUrl}/with-ttl/api/2fa/tokens`).pipe(
      catchError(() => of([]))
    );
  }

  generateWithTtlToken(email: string, ttl: number): Observable<boolean> {
    return this.http.post(`${this.baseUrl}/with-ttl/api/2fa/generate`, { email, ttl }, { observe: 'response' }).pipe(
      map(res => res.status === 200 || res.status === 201),
      catchError(() => of(false))
    );
  }
}
