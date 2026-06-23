import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../core/app-config.token';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private config = inject(APP_CONFIG);

  private basicAuth(): string {
    return btoa(`${this.config.clientId}:${this.config.clientSecret}`);
  }

  exchangeToken(code: string, codeVerifier: string): Promise<Record<string, unknown>> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri!,
      client_id: this.config.clientId!,
      code_verifier: codeVerifier,
    });

    return firstValueFrom(
      this.http.post<Record<string, unknown>>(this.config.tokenUri!, body.toString(), {
        headers: new HttpHeaders({
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${this.basicAuth()}`,
        }),
      })
    );
  }

  refreshToken(refreshToken: string): Promise<Record<string, unknown>> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId!,
    });

    return firstValueFrom(
      this.http.post<Record<string, unknown>>(this.config.tokenUri!, body.toString(), {
        headers: new HttpHeaders({
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${this.basicAuth()}`,
        }),
      })
    );
  }
}
