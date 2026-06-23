import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_CONFIG } from '../../core/app-config.token';
import { generateCodeVerifier, generateCodeChallenge, storeCodeVerifier } from '../../core/pkce';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-menu',
  imports: [RouterLink],
  templateUrl: './menu.html',
  styleUrl: './menu.scss',
})
export class Menu {
  private config = inject(APP_CONFIG);
  authService = inject(AuthService);

  async login(): Promise<void> {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    storeCodeVerifier(codeVerifier);

    const params = new URLSearchParams({
      response_type: this.config.responseType!,
      client_id: this.config.clientId!,
      redirect_uri: this.config.redirectUri!,
      scope: this.config.scope!,
      code_challenge_method: this.config.codeChallengeMethod!,
      code_challenge: codeChallenge,
    });
    window.location.href = `${this.config.authorizeUri}${params.toString()}`;
  }

  logout(): void {
    this.authService.logout();
    window.location.href = '/';
  }
}
