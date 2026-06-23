import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { APP_CONFIG } from '../core/app-config.token';
import { getStoredCodeVerifier, clearCodeVerifier } from '../core/pkce';
import { ApiService } from './api.service';
import { firstValueFrom } from 'rxjs';
import { SubscriptionControllerService } from './subscription-controller.service';
import { SubscriptionUsersControllerService } from './subscription-users-controller.service';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private config = inject(APP_CONFIG);
  private api = inject(ApiService);
  private router = inject(Router);
  private subscriptionApiService = inject(SubscriptionControllerService);
  private subscriptionUsersApiService = inject(SubscriptionUsersControllerService);

  private _isAuthenticated = signal<boolean>(this.hasValidToken());
  readonly isAuthenticatedSignal = this._isAuthenticated.asReadonly();
  private _hasAuthority = signal<boolean>(false);

  private _subscriptionName = signal<string | null>(null);
  readonly subscriptionNameSignal = this._subscriptionName.asReadonly();

  isAuthenticated() {
    return this._isAuthenticated();
  }

  hasAuthority(authority: string): boolean {
    const token = this.getAccessToken();
    if (!token) return false;

    const parsed = this.parseJwt(token);
    const authorities = parsed?.['authorities'];

    return Array.isArray(authorities) && authorities.includes(authority);
  }

  async initSubscription(userId: string, email: string): Promise<void> {
    try {
      const userSubs = await firstValueFrom(
        this.subscriptionUsersApiService.getAll1({ userId })
      );

      if (userSubs && userSubs.length > 0) {
        const sub = await firstValueFrom(
          this.subscriptionApiService.getById({ id: userSubs[0].subscriptionId! })
        );
        this._subscriptionName.set(sub.subscriptionName ?? null);
      } else {
        const emailUsername = email.split('@')[0];
        const randomId = crypto.randomUUID().split('-')[0];
        const subscriptionName = `${emailUsername}_${randomId}_subscription`;

        const newSub = await firstValueFrom(
          this.subscriptionApiService.create({
            subscription: {
              subscriptionName,
              type: 'BASIC_ACCESS',
              enabled: true,
            }
          })
        );

        await firstValueFrom(
          this.subscriptionUsersApiService.create1({
            subscriptionUsers: {
              subscriptionId: newSub.id,
              userId,
            }
          })
        );

        this._subscriptionName.set(newSub.subscriptionName ?? null);
      }
    } catch (err) {
      console.error('Failed to initialize subscription:', err);
    }
  }

  setAccessToken(access_token: string) {
    localStorage.setItem("ACCESS_TOKEN", access_token);
  }

  setRefreshToken(refresh_token: string) {
    localStorage.setItem("REFRESH_TOKEN", refresh_token);
  }

  getJwt() {
    return {
      "access_token": this.getAccessToken(),
      "refresh_token": this.getRefreshToken()
    };
  }

  getAccessToken(): string | null {
    return localStorage.getItem("ACCESS_TOKEN");
  }

  getRefreshToken(): string | null {
    return localStorage.getItem("REFRESH_TOKEN");
  }

  private hasValidToken(): boolean {
    const token = this.getAccessToken();
    if (!token) return false;
    const parsed = this.parseJwt(token);
    if (!parsed) return false;
    const exp = parsed['exp'] as number | undefined;
    if (!exp || Date.now() < exp * 1000) return true;
    return this.getRefreshToken() !== null;
  }

  setAuthentication(isAuthenticated: boolean) {
    this._isAuthenticated.update(() => isAuthenticated);
  }

  setAuthenticated(token: string | null) {
    if (!token) return;

    const jwt = JSON.parse(token) as { access_token: string; refresh_token: string };

    this.setAuthentication(true);
    this.setAccessToken(jwt.access_token);
    this.setRefreshToken(jwt.refresh_token);
  }

  logout() {
    this._isAuthenticated.update(() => false);
    this._hasAuthority.update(() => false);
    localStorage.clear();
    sessionStorage.clear();
    document.cookie.split(';').forEach((c) => {
      document.cookie = c.replace(/^ +/, '').replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
    });

    const authBaseUrl = this.config.authorizeUri?.replace(/\/oauth2\/authorize.*$/, '');
    if (authBaseUrl) {
      fetch(`${authBaseUrl}/exit?client_id=${this.config.clientId}`, {
        method: 'GET',
        credentials: 'include',
        mode: 'cors',
      }).catch(() => { });
    }
  }

  async handleOAuthCallback(code: string): Promise<void> {
    const codeVerifier = getStoredCodeVerifier();
    if (!codeVerifier) {
      this.router.navigate(['/'], { replaceUrl: true, queryParams: {} });
      return;
    }

    try {
      const authenticationData = await this.api.exchangeToken(code, codeVerifier);
      this.setAuthentication(false);

      if (authenticationData['access_token']) {
        const parsed = this.parseJwt(authenticationData['access_token'] as string);
        if (parsed) {
          const claims = this.parseClaims(parsed);
          this.setAuthenticated(JSON.stringify(authenticationData));
        }
      }
    } catch {
      localStorage.clear();
      sessionStorage.clear();
    } finally {
      clearCodeVerifier();
      this.router.navigate(['/'], { replaceUrl: true, queryParams: {} });
    }
  }

  private clearSession(): void {
    localStorage.clear();
    sessionStorage.clear();
    const authBaseUrl = this.config.authorizeUri?.replace(/\/oauth2\/authorize.*$/, '');
    if (authBaseUrl) {
      window.location.href = `${authBaseUrl}/exit`;
    } else {
      window.location.href = '/';
    }
  }

  getUserId(): string | null {
    const token = this.getAccessToken();
    if (!token) return null;
    const parsed = this.parseJwt(token);
    if (!parsed) return null;
    return (parsed['user_id'] ?? parsed['sub'] ?? null) as string | null;
  }

  parseClaims(claims: Record<string, unknown>) {
    const c = claims as any;

    // user_id
    const userId = c.user_id ?? c.sub ?? null;

    // scope
    let scope: string[];
    const rawScope = c.scope;
    if (Array.isArray(rawScope)) {
      scope = rawScope.map(String);
    } else if (typeof rawScope === 'string') {
      scope = rawScope.split(/[\s,]+/).filter(Boolean);
    } else {
      scope = [];
    }

    // authorities
    const rawAuthorities = c.authorities;
    const authorities = Array.isArray(rawAuthorities) ? rawAuthorities.map(String) : null;

    // roles
    let roles: string[] | null = null;
    const realmAccess = c.realm_access;
    if (realmAccess?.roles) {
      roles = realmAccess.roles;
    } else if (Array.isArray(c.roles)) {
      roles = c.roles.map(String);
    }

    // permissions
    let permissions: string[] | null = null;
    const resourceAccess = c.resource_access;
    if (resourceAccess) {
      const perms: string[] = [];
      for (const client of Object.values(resourceAccess) as any) {
        if (client.roles) perms.push(...client.roles);
      }
      permissions = [...new Set(perms)];
    } else if (Array.isArray(c.permissions)) {
      permissions = c.permissions.map(String);
    }

    return { userId, scope, authorities, roles, permissions };
  }

  parseJwt(token: string): Record<string, unknown> | null {
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch {
      return null;
    }
  }
}
