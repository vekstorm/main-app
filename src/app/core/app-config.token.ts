import { InjectionToken } from '@angular/core';
import { AppEnvironment } from '../../environments/environment.model';

export const APP_CONFIG = new InjectionToken<AppEnvironment>('app.config');
