import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { CategoriesModule } from '../categories/categories.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PasswordResetService } from './password-reset.service';
import { RefreshTokenService } from './refresh-token.service';

@Module({
  imports: [JwtModule.register({}), CategoriesModule],
  controllers: [AuthController],
  exports: [EmailVerificationService, RefreshTokenService],
  providers: [
    AuthService,
    PasswordResetService,
    EmailVerificationService,
    RefreshTokenService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AuthModule {}
