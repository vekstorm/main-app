import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { APP_CONFIG } from './app-config.token';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const config = inject(APP_CONFIG);

  const token = auth.getAccessToken();
  const isApiRequest = req.url.startsWith(config.apiUrl);
  const isTokenRequest = config.tokenUri && req.url.startsWith(config.tokenUri);

  if (token && isApiRequest && !isTokenRequest) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
    return next(cloned);
  }

  return next(req);
};
