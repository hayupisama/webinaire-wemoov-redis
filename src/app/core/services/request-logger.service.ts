import { Injectable, signal } from '@angular/core';

export interface RequestLog {
  id: string;
  feature: string;
  method: string;
  url: string;
  status: number;
  duration: number;
  timestamp: Date;
  body: unknown;
  isError: boolean;
}

@Injectable({ providedIn: 'root' })
export class RequestLoggerService {
  readonly logs = signal<RequestLog[]>([]);

  addLog(log: RequestLog): void {
    this.logs.update(prev => [log, ...prev].slice(0, 200));
  }

  clearFeature(feature: string): void {
    this.logs.update(prev => prev.filter(l => l.feature !== feature));
  }
}
