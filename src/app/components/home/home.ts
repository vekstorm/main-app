import { Component, inject } from '@angular/core';
import { APP_CONFIG } from '../../core/app-config.token';
import { generateCodeVerifier, generateCodeChallenge, storeCodeVerifier } from '../../core/pkce';
import { Users } from '../users/users';
import { Roles } from '../roles/roles';
import { Permissions } from '../permissions/permissions';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  imports: [Users, Roles, Permissions],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private config = inject(APP_CONFIG);
  authService = inject(AuthService);

  authorizeUri = this.config.authorizeUri?.replace('?', '');
  redirectUri = this.config.redirectUri;
  clientId = this.config.clientId;
  scope = this.config.scope;
  responseType = this.config.responseType;
  codeChallengeMethod = this.config.codeChallengeMethod;

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
}
