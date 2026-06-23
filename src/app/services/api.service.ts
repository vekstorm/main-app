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

  getUsers(search: string, page: number, size: number): Promise<any> {
    let url = `${this.config.apiUrl}/api/v1/user/all?page=${page}&size=${size}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return firstValueFrom(this.http.get<any>(url));
  }

  getUserById(id: string): Promise<any> {
    return firstValueFrom(
      this.http.get<any>(`${this.config.apiUrl}/api/v1/user/${id}`)
    );
  }

  createUser(user: Record<string, unknown>): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(`${this.config.apiUrl}/api/v1/user`, user)
    );
  }

  updateUser(id: string, user: Record<string, unknown>): Promise<any> {
    return firstValueFrom(
      this.http.put<any>(`${this.config.apiUrl}/api/v1/user/${id}`, user)
    );
  }

  deleteUser(id: string): Promise<any> {
    return firstValueFrom(
      this.http.delete<any>(`${this.config.apiUrl}/api/v1/user/${id}`)
    );
  }

  getRoles(search: string, page: number, size: number): Promise<any> {
    let url = `${this.config.apiUrl}/api/v1/role/all?page=${page}&size=${size}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return firstValueFrom(this.http.get<any>(url));
  }

  getRoleById(id: string): Promise<any> {
    return firstValueFrom(
      this.http.get<any>(`${this.config.apiUrl}/api/v1/role/${id}`)
    );
  }

  createRole(role: any): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(`${this.config.apiUrl}/api/v1/role`, role)
    );
  }

  updateRole(id: string, role: any): Promise<any> {
    return firstValueFrom(
      this.http.put<any>(`${this.config.apiUrl}/api/v1/role/${id}`, role)
    );
  }

  deleteRole(id: string): Promise<any> {
    return firstValueFrom(
      this.http.delete<any>(`${this.config.apiUrl}/api/v1/role/${id}`)
    );
  }

  getPermissions(search: string, page: number, size: number): Promise<any> {
    let url = `${this.config.apiUrl}/api/v1/permission/all?page=${page}&size=${size}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return firstValueFrom(this.http.get<any>(url));
  }

  getAllPermissions(): Promise<any[]> {
    return firstValueFrom(
      this.http.get<any[]>(`${this.config.apiUrl}/api/v1/permission/all?page=0&size=1000`)
    );
  }

  createPermission(perm: any): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(`${this.config.apiUrl}/api/v1/permission`, perm)
    );
  }

  updatePermission(id: string, perm: any): Promise<any> {
    return firstValueFrom(
      this.http.put<any>(`${this.config.apiUrl}/api/v1/permission/${id}`, perm)
    );
  }

  deletePermission(id: string): Promise<any> {
    return firstValueFrom(
      this.http.delete<any>(`${this.config.apiUrl}/api/v1/permission/${id}`)
    );
  }

  deletePermissions(ids: string[]): Promise<any> {
    return firstValueFrom(
      this.http.request<any>('delete', `${this.config.apiUrl}/api/v1/permission/batch`, { body: ids })
    );
  }
}
