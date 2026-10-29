import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AppConfig } from '../config/app-config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Janela em que reutilizar um token recém-rotacionado é tratado como
 * requisições concorrentes (duas abas, ou o StrictMode do React chamando
 * o refresh duas vezes), e não como roubo de token.
 */
export const REUSE_GRACE_MS = 10_000;

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

export interface RotationResult extends IssuedRefreshToken {
  userId: string;
}

/**
 * Refresh tokens opacos com rotação a cada uso.
 *
 * - O token bruto vai só para o cookie httpOnly; no banco fica o hash SHA-256.
 * - Cada uso revoga o token e emite outro.
 * - Se um token já revogado for reapresentado fora da janela de tolerância,
 *   assumimos vazamento e revogamos TODAS as sessões do usuário.
 * - A tolerância vale só para token revogado por rotação (tem `replacedBy`).
 *   Revogado de propósito (logout, troca de senha, desconectar dispositivo)
 *   não volta a valer nunca, nem um segundo depois.
 */
@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  async issue(
    userId: string,
    userAgent?: string,
    id?: string,
  ): Promise<IssuedRefreshToken & { id: string }> {
    const token = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.refreshToken.ttlDays * 86_400_000);
    const record = await this.prisma.refreshToken.create({
      data: {
        ...(id ? { id } : {}),
        userId,
        tokenHash: hashToken(token),
        expiresAt,
        userAgent: userAgent?.slice(0, 300),
      },
      select: { id: true },
    });
    return { id: record.id, token, expiresAt };
  }

  async rotate(token: string, userAgent?: string): Promise<RotationResult> {
    const now = new Date();
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { id: true, userId: true, expiresAt: true },
    });

    if (!record || record.expiresAt <= now) {
      throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    }

    // Reivindica o token de forma atômica e já registra quem o substitui:
    // assim, quem chegar depois sabe que foi rotação, e não logout
    const nextId = randomUUID();
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: now, replacedBy: nextId },
    });

    if (claimed.count === 0) {
      const current = await this.prisma.refreshToken.findUnique({
        where: { id: record.id },
        select: { revokedAt: true, replacedBy: true },
      });
      if (!current?.replacedBy) {
        throw new UnauthorizedException('Sessão encerrada. Entre novamente.');
      }
      const revokedAt = current.revokedAt ?? now;
      if (now.getTime() - revokedAt.getTime() > REUSE_GRACE_MS) {
        this.logger.warn(`Reutilização de refresh token detectada (usuário ${record.userId})`);
        await this.revokeAll(record.userId);
        throw new UnauthorizedException('Sessão inválida. Entre novamente.');
      }
    }

    const next = await this.issue(
      record.userId,
      userAgent,
      claimed.count === 1 ? nextId : undefined,
    );
    return { userId: record.userId, token: next.token, expiresAt: next.expiresAt };
  }

  async revoke(token: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
