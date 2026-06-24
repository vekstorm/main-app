import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { SubscriptionControllerService } from '../../services/subscription-controller.service';
import { SubscriptionUsersControllerService } from '../../services/subscription-users-controller.service';
import { Subscription } from '../../services/dtos/subscription';

@Component({
  selector: 'app-subscription',
  imports: [DatePipe],
  templateUrl: './subscription.html',
  styleUrl: './subscription.scss',
})
export class SubscriptionComponent {
  private authService = inject(AuthService);
  private subscriptionApi = inject(SubscriptionControllerService);
  private subscriptionUsersApi = inject(SubscriptionUsersControllerService);

  subscription = signal<Subscription | null>(null);
  userCount = signal(0);
  loading = signal(true);
  error = signal<string | null>(null);

  constructor() {
    this.loadSubscription();
  }

  private async loadSubscription(): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) {
      this.error.set('User not authenticated');
      this.loading.set(false);
      return;
    }

    try {
      const userSubs = await this.subscriptionUsersApi.getAll1({ userId }).toPromise();
      if (!userSubs || userSubs.length === 0) {
        this.error.set('No subscription found');
        this.loading.set(false);
        return;
      }

      const subId = userSubs[0].subscriptionId!;
      const [sub, allSubUsers] = await Promise.all([
        this.subscriptionApi.getById({ id: subId }).toPromise(),
        this.subscriptionUsersApi.getAll1({ subscriptionId: subId }).toPromise(),
      ]);

      this.subscription.set(sub ?? null);
      this.userCount.set(allSubUsers?.length ?? 0);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to load subscription');
    } finally {
      this.loading.set(false);
    }
  }
}
