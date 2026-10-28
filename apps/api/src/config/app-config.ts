import { Injectable } from '@nestjs/common';
import { parseEnv, type Env } from './env';

/** Configuração tipada da aplicação, validada na inicialização. */
@Injectable()
export class AppConfig {
  private readonly env: Env;

  constructor() {
    this.env = parseEnv(process.env);
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get port(): number {
    return this.env.PORT;
  }

  get corsOrigins(): string[] {
    return this.env.CORS_ORIGIN.split(',').map((origin) => origin.trim());
  }

  get databaseUrl(): string {
    return this.env.DATABASE_URL;
  }

  get jwt() {
    return {
      secret: this.env.JWT_ACCESS_SECRET,
      ttlSeconds: this.env.JWT_ACCESS_TTL_SECONDS,
    };
  }

  get refreshToken() {
    return {
      ttlDays: this.env.REFRESH_TOKEN_TTL_DAYS,
      cookieSecure: this.env.COOKIE_SECURE,
      cookieSameSite: this.env.COOKIE_SAME_SITE,
    };
  }
}
