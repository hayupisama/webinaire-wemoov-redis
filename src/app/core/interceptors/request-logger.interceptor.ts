import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { RequestLoggerService } from '../services/request-logger.service';

export const requestLoggerInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(RequestLoggerService);
  const router = inject(Router);
  const start = Date.now();
  const feature = router.url.split('/').filter(Boolean)[0] || 'unknown';

  return next(req).pipe(
    tap({
      next: (event) => {
        if (event instanceof HttpResponse) {
          logger.addLog({
            id: crypto.randomUUID(),
            feature,
            method: req.method,
            url: req.url,
            status: event.status,
            duration: Date.now() - start,
            timestamp: new Date(),
            body: event.body,
            isError: false,
          });
        }
      },
      error: (err: HttpErrorResponse) => {
        logger.addLog({
          id: crypto.randomUUID(),
          feature,
          method: req.method,
          url: req.url,
          status: err.status,
          duration: Date.now() - start,
          timestamp: new Date(),
          body: err.error,
          isError: true,
        });
      },
    })
  );
};
