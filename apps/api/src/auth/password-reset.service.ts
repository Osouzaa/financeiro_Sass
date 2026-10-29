import { randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { ResetPasswordInput } from '@financeiro/shared';
import { AppConfig } from '../config/app-config';
import { MailService } from '../mail/mail.service';
import { passwordChangedEmail, passwordResetEmail } from '../mail/templates';
import { PrismaService } from '../prisma/prisma.service';
import { findUserByIdentifier } from './identifier';
import { hashPassword } from './password';
import { hashToken, RefreshTokenService } from './refresh-token.service';

/** Tempo de validade do link. Curto: quem tem acesso ao e-mail usa na hora. */
export const RESET_TOKEN_MINUTES = 30;

const invalidLink = () =>
  new BadRequestException({
    message: 'Este link expirou ou já foi usado. Peça um novo.',
    fields: { token: ['Link expirado ou já usado'] },
  });

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly mail: MailService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  /**
   * Gera o link e manda para o e-mail da conta. A resposta é a mesma exista ou não
   * a conta, e o envio não segura a resposta: nem o conteúdo nem o tempo revelam
   * quais e-mails ou CPFs estão cadastrados.
   */
  async request(identifier: string, requestIp?: string): Promise<void> {
    const user = await findUserByIdentifier(this.prisma, identifier, {
      id: true,
      name: true,
      email: true,
    });
    if (!user) return;

    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.prisma.$transaction([
      // Só o link mais recente vale
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(now.getTime() + RESET_TOKEN_MINUTES * 60_000),
          requestIp: requestIp?.slice(0, 45) ?? null,
        },
      }),
    ]);

    const link = `${this.config.appUrl}/redefinir-senha?token=${token}`;
    void this.mail
      .send(
        passwordResetEmail({
          to: user.email,
          name: user.name,
          link,
          minutes: RESET_TOKEN_MINUTES,
        }),
      )
      .catch((error: unknown) =>
        this.logger.error(`Falha ao enviar e-mail de redefinição: ${String(error)}`),
      );
  }

  /** Troca a senha pelo link, encerra todas as sessões e avisa por e-mail. */
  async reset(input: ResetPasswordInput): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(input.token) },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
        user: { select: { name: true, email: true } },
      },
    });
    if (!record || record.usedAt || record.expiresAt <= new Date()) throw invalidLink();

    const passwordHash = await hashPassword(input.newPassword);
    await this.prisma.$transaction(async (tx) => {
      // Marca como usado de forma condicional: dois envios do mesmo link não passam juntos
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0) throw invalidLink();
      await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    });
    await this.refreshTokens.revokeAll(record.userId);

    void this.mail
      .send(passwordChangedEmail({ to: record.user.email, name: record.user.name }))
      .catch((error: unknown) =>
        this.logger.error(`Falha ao enviar aviso de senha alterada: ${String(error)}`),
      );
  }
}
