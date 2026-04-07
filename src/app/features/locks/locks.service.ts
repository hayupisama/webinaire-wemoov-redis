import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map } from 'rxjs';

export interface AccountBalance {
  balance: number;
  expected: number;
}

export type ThreadState = 'IDLE' | 'READING' | 'DEBITING' | 'DONE' | 'WAITING_LOCK';

export interface ThreadStatus {
  threadA: ThreadState;
  threadB: ThreadState;
  done: boolean;
  finalExpected?: number;
  finalActual?: number;
}

export interface LockStatus {
  owner: string | null;
}

// --- Concert ---

export interface Seat {
  id: string;
  status: 'AVAILABLE' | 'RESERVED' | 'PAID';
}

export interface BookingClientState {
  state: string;
  message: string;
  success: boolean;
}

export interface BookingStatus {
  clientA: BookingClientState;
  clientB: BookingClientState;
  done: boolean;
}

const DEFAULT_BOOKING_STATUS: BookingStatus = {
  clientA: { state: 'IDLE', message: '', success: false },
  clientB: { state: 'IDLE', message: '', success: false },
  done: false,
};

@Injectable({ providedIn: 'root' })
export class LocksService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:8086';

  checkHealth(): Observable<boolean> {
    return this.http.get(`${this.baseUrl}/health`, { observe: 'response', responseType: 'text' }).pipe(
      map(res => res.status === 200),
      catchError(() => of(false))
    );
  }

  // --- Compte bancaire ---

  getBalance(): Observable<AccountBalance> {
    return this.http.get<AccountBalance>(`${this.baseUrl}/api/account/balance`).pipe(
      catchError(() => of({ balance: 1000, expected: 1000 }))
    );
  }

  resetAccount(): Observable<boolean> {
    return this.http.post(`${this.baseUrl}/api/account/reset`, {}, { observe: 'response' }).pipe(
      map(res => res.status === 200),
      catchError(() => of(false))
    );
  }

  runNoLock(): Observable<boolean> {
    return this.http.post(`${this.baseUrl}/no-lock/api/debit/concurrent`, {}, { observe: 'response' }).pipe(
      map(res => res.status === 200),
      catchError(() => of(false))
    );
  }

  getNoLockStatus(): Observable<ThreadStatus> {
    return this.http.get<ThreadStatus>(`${this.baseUrl}/no-lock/api/threads/status`).pipe(
      catchError(() => of({ threadA: 'IDLE' as ThreadState, threadB: 'IDLE' as ThreadState, done: false }))
    );
  }

  runWithLock(): Observable<boolean> {
    return this.http.post(`${this.baseUrl}/with-lock/api/debit/concurrent`, {}, { observe: 'response' }).pipe(
      map(res => res.status === 200),
      catchError(() => of(false))
    );
  }

  getWithLockStatus(): Observable<ThreadStatus> {
    return this.http.get<ThreadStatus>(`${this.baseUrl}/with-lock/api/threads/status`).pipe(
      catchError(() => of({ threadA: 'IDLE' as ThreadState, threadB: 'IDLE' as ThreadState, done: false }))
    );
  }

  getLockStatus(): Observable<LockStatus> {
    return this.http.get<LockStatus>(`${this.baseUrl}/with-lock/api/lock/status`).pipe(
      catchError(() => of({ owner: null }))
    );
  }

  // --- Concert ---

  getSeats(): Observable<Seat[]> {
    return this.http.get<Seat[]>(`${this.baseUrl}/api/concert/seats`).pipe(
      catchError(() => of([]))
    );
  }

  resetConcert(): Observable<boolean> {
    return this.http.post(`${this.baseUrl}/api/concert/reset`, {}, { observe: 'response' }).pipe(
      map(res => res.status === 200),
      catchError(() => of(false))
    );
  }

  runNoLockBooking(seatId: string, client: 'A' | 'B'): Observable<boolean> {
    return this.http.post(`${this.baseUrl}/no-lock/api/concert/book`, {}, {
      params: { seatId, client },
      observe: 'response',
    }).pipe(
      map(res => res.status === 200),
      catchError(() => of(false))
    );
  }

  getNoLockBookingStatus(): Observable<BookingStatus> {
    return this.http.get<BookingStatus>(`${this.baseUrl}/no-lock/api/concert/status`).pipe(
      catchError(() => of(DEFAULT_BOOKING_STATUS))
    );
  }

  runWithLockBooking(seatId: string, client: 'A' | 'B'): Observable<boolean> {
    return this.http.post(`${this.baseUrl}/with-lock/api/concert/book`, {}, {
      params: { seatId, client },
      observe: 'response',
    }).pipe(
      map(res => res.status === 200),
      catchError(() => of(false))
    );
  }

  getWithLockBookingStatus(): Observable<BookingStatus> {
    return this.http.get<BookingStatus>(`${this.baseUrl}/with-lock/api/concert/status`).pipe(
      catchError(() => of(DEFAULT_BOOKING_STATUS))
    );
  }

  getConcertLockStatus(seatId: string): Observable<LockStatus> {
    return this.http.get<LockStatus>(`${this.baseUrl}/with-lock/api/concert/lock`, {
      params: { seatId },
    }).pipe(
      catchError(() => of({ owner: null }))
    );
  }

  releaseSeat(seatId: string): Observable<boolean> {
    return this.http.post(`${this.baseUrl}/with-lock/api/concert/release`, {}, {
      params: { seatId },
      observe: 'response',
    }).pipe(
      map(res => res.status === 200),
      catchError(() => of(false))
    );
  }
}
