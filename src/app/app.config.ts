import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {provideRouter} from '@angular/router';
import {provideHttpClient, withInterceptors} from '@angular/common/http';

import {routes} from './app.routes';
import {environment} from '../environments/environment';
import {mockInterceptor} from './core/mocks/mock.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(), 
    provideRouter(routes), 
    provideHttpClient(
      environment.mocked ? withInterceptors([mockInterceptor]) : withInterceptors([])
    )
  ],
};
