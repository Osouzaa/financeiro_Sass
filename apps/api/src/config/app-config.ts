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

  get appUrl(): string {
    return this.env.APP_URL.replace(/\/+$/, '');
  }

  get mail() {
    return {
      host: this.env.SMTP_HOST,
      port: this.env.SMTP_PORT,
      secure: this.env.SMTP_SECURE,
      user: this.env.SMTP_USER,
      pass: this.env.SMTP_PASS,
      from: this.env.MAIL_FROM,
    };
  }

  get superAdminEmails(): string[] {
    return this.env.SUPER_ADMIN_EMAILS.split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
  }

  get rateLimitEnabled(): boolean {
    return this.env.RATE_LIMIT_ENABLED;
  }

  get trustProxy(): boolean {
    return this.env.TRUST_PROXY;
  }

  get refreshToken() {
    return {
      ttlDays: this.env.REFRESH_TOKEN_TTL_DAYS,
      cookieSecure: this.env.COOKIE_SECURE,
      cookieSameSite: this.env.COOKIE_SAME_SITE,
    };
  }
}
