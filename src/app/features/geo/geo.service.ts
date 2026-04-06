import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map } from 'rxjs';

export interface GeoResult {
  name: string;
  distance: number;
}

export interface GeoResponse {
  results: GeoResult[];
  responseTime: number;
}

@Injectable({ providedIn: 'root' })
export class GeoService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:8087';

  checkHealth(): Observable<boolean> {
    return this.http.get(`${this.baseUrl}/health`, { observe: 'response', responseType: 'text' }).pipe(
      map(res => res.status === 200),
      catchError(() => of(false))
    );
  }

  search(city: string, radius: number): Observable<GeoResponse> {
    const start = Date.now();
    return this.http.get<GeoResult[]>(`${this.baseUrl}/api/geo/search?city=${city}&radius=${radius}`).pipe(
      map(results => ({ results, responseTime: Date.now() - start })),
      catchError(() => of({ results: [], responseTime: Date.now() - start }))
    );
  }
}
