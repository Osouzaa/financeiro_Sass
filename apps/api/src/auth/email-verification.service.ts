import { randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { MailService } from '../mail/mail.service';
import { emailVerificationEmail } from '../mail/templates';
import { PrismaService } from '../prisma/prisma.service';
import { hashToken } from './refresh-token.service';

/** Validade do link de confirmação. Mais longa que a de senha: não é uma credencial. */
export const VERIFY_TOKEN_HOURS = 24;

const invalidLink = () =>
  new BadRequestException({
    message: 'Este link expirou ou já foi usado. Peça um novo no app.',
    fields: { token: ['Link expirado ou já usado'] },
  });

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly mail: MailService,
  ) {}

  /** Envia (ou reenvia) o link para o e-mail atual da conta, se ainda não confirmado. */
  async send(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, emailVerifiedAt: true },
    });
    if (!user || user.emailVerifiedAt) return;

    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: now },
      }),
      this.prisma.emailVerificationToken.create({
        data: {
          userId,
          email: user.email,
          tokenHash: hashToken(token),
          expiresAt: new Date(now.getTime() + VERIFY_TOKEN_HOURS * 3_600_000),
        },
      }),
    ]);

    void this.mail
      .send(
        emailVerificationEmail({
          to: user.email,
          name: user.name,
          link: `${this.config.appUrl}/verificar-email?token=${token}`,
          hours: VERIFY_TOKEN_HOURS,
        }),
      )
      .catch((error: unknown) =>
        this.logger.error(`Falha ao enviar confirmação de e-mail: ${String(error)}`),
      );
  }

  /** Confirma o e-mail. O link só vale para o e-mail que estava na conta quando foi enviado. */
  async verify(token: string): Promise<void> {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        id: true,
        userId: true,
        email: true,
        expiresAt: true,
        usedAt: true,
        user: { select: { email: true } },
      },
    });
    if (!record || record.usedAt || record.expiresAt <= new Date()) throw invalidLink();
    if (record.user.email !== record.email) throw invalidLink();

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.emailVerificationToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0) throw invalidLink();
      await tx.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      });
    });
  }
}
