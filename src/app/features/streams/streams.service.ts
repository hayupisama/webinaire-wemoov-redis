import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map } from 'rxjs';

export interface StreamMessage {
  id: string;
  type: string;
  payload: string;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class StreamsService {
  private http = inject(HttpClient);
  private producerUrl = 'http://localhost:8085/producer';
  private consumerUrl = 'http://localhost:8085/consumer';

  publishMessage(type: string, payload: string): Observable<boolean> {
    return this.http.post(`${this.producerUrl}/api/publish`, { type, payload }, { observe: 'response' }).pipe(
      map(res => res.status === 200 || res.status === 201),
      catchError(() => of(false))
    );
  }

  getStream(): Observable<StreamMessage[]> {
    return this.http.get<StreamMessage[]>(`${this.producerUrl}/api/stream`).pipe(
      catchError(() => of([]))
    );
  }

  getProducerHealth(): Observable<boolean> {
    return this.http.get(`${this.producerUrl}/api/health`, { observe: 'response', responseType: 'text' }).pipe(
      map(res => res.status === 200),
      catchError(() => of(false))
    );
  }

  getConsumerHealth(): Observable<boolean> {
    return this.http.get(`${this.consumerUrl}/api/health`, { observe: 'response', responseType: 'text' }).pipe(
      map(res => res.status === 200),
      catchError(() => of(false))
    );
  }

  resetStream(): Observable<boolean> {
    return this.http.post(`${this.producerUrl}/api/reset`, {}, { observe: 'response', responseType: 'text' }).pipe(
      map(res => res.status === 200),
      catchError(() => of(false))
    );
  }

  getProcessedMessages(): Observable<StreamMessage[]> {
    return this.http.get<StreamMessage[]>(`${this.consumerUrl}/api/processed`).pipe(
      catchError(() => of([]))
    );
  }
}
