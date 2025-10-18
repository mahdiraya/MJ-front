import { HttpInterceptorFn } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((err) => {
      if (err?.status === 401) {
        // clear any stale creds
        localStorage.removeItem('access_token');
        localStorage.removeItem('auth_user');
        // redirect to login
        router.navigate(['/login']);
      }
      return throwError(() => err);
    })
  );
};
