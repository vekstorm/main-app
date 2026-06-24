import { Component, signal, inject, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { APP_CONFIG } from '../../core/app-config.token';
import { generateCodeVerifier, generateCodeChallenge, storeCodeVerifier } from '../../core/pkce';
import { AuthService } from '../../services/auth.service';
import { UserControllerService } from '../../services/user-controller.service';
import { GetByIdRequestParams } from '../../services/user-controller.serviceInterface';
import { AppUserResponseDto } from '../../services/dtos/app-user-response-dto';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private config = inject(APP_CONFIG);
  private userService = inject(UserControllerService);
  private sub?: Subscription;
  authService = inject(AuthService);

  authorizeUri = this.config.authorizeUri?.replace('?', '');
  redirectUri = this.config.redirectUri;
  clientId = this.config.clientId;
  scope = this.config.scope;
  responseType = this.config.responseType;
  codeChallengeMethod = this.config.codeChallengeMethod;

  user = signal<AppUserResponseDto | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.authService.isAuthenticatedSignal()) {
        this.loadUser();
      } else {
        this.user.set(null);
        this.loading.set(false);
        this.error.set(null);
      }
    });
  }

  private loadUser(): void {
    const userId = this.authService.getUserId();
    if (!userId) return;

    this.loading.set(true);
    this.error.set(null);
    this.sub?.unsubscribe();

    const params: GetByIdRequestParams = { id: userId };
    this.sub = this.userService.getById(params).subscribe({
      next: (u) => {
        this.user.set(u);
        this.loading.set(false);
        if (u.id && u.email) {
          this.authService.initSubscription(u.id, u.email);
        }
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error loading user');
        this.loading.set(false);
      },
    });
  }

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
