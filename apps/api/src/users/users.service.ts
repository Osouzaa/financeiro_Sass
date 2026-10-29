import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AVATAR_MAX_BYTES,
  maskCpf,
  type AlertPreferences,
  type PhoneInputParsed,
  type ProfileDto,
  type UpdateProfileInputParsed,
  type UserDto,
} from '@financeiro/shared';
import { EmailVerificationService } from '../auth/email-verification.service';
import { verifyPassword } from '../auth/password';
import { toUserDto, USER_SELECT } from '../auth/user-dto';
import { PrismaService } from '../prisma/prisma.service';
import { detectImageType } from './image-signature';

const PROFILE_SELECT = {
  ...USER_SELECT,
  createdAt: true,
  alertDueSoon: true,
  alertDueDays: true,
  alertBudget: true,
  alertBudgetPercent: true,
  alertNegativeBalance: true,
  cpf: { select: { cpf: true } },
  phone: { select: { phone: true, whatsappOptIn: true, verifiedAt: true } },
  termsAcceptedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  async getProfile(userId: string): Promise<ProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PROFILE_SELECT,
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return {
      ...toUserDto(user),
      cpfMasked: user.cpf ? maskCpf(user.cpf.cpf) : null,
      phone: user.phone
        ? {
            number: user.phone.phone,
            whatsappOptIn: user.phone.whatsappOptIn,
            verified: Boolean(user.phone.verifiedAt),
          }
        : null,
      termsAcceptedAt: user.termsAcceptedAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      alerts: {
        dueSoon: user.alertDueSoon,
        dueDays: user.alertDueDays,
        budget: user.alertBudget,
        budgetPercent: user.alertBudgetPercent,
        negativeBalance: user.alertNegativeBalance,
      },
    };
  }

  /**
   * Atualiza nome, e-mail e CPF. Trocar o e-mail ou o CPF exige a senha atual:
   * os dois servem para entrar na conta.
   */
  async updateProfile(userId: string, input: UpdateProfileInputParsed): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, passwordHash: true, cpf: { select: { cpf: true } } },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const cpfChanged = Boolean(input.cpf) && input.cpf !== user.cpf?.cpf;
    if (input.email !== user.email || cpfChanged) {
      if (!input.currentPassword) {
        throw new BadRequestException({
          message: 'Confirme sua senha para trocar o e-mail ou o CPF',
          fields: { currentPassword: ['Informe sua senha atual'] },
        });
      }
      if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
        throw new BadRequestException({
          message: 'Senha incorreta',
          fields: { currentPassword: ['Senha incorreta'] },
        });
      }
    }

    if (input.email !== user.email) {
      const taken = await this.prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      if (taken) {
        throw new ConflictException({
          message: 'Este e-mail já está em uso',
          fields: { email: ['Este e-mail já está em uso'] },
        });
      }
    }

    if (cpfChanged) {
      const taken = await this.prisma.userCpf.findUnique({
        where: { cpf: input.cpf! },
        select: { userId: true },
      });
      if (taken && taken.userId !== userId) {
        throw new ConflictException({
          message: 'Este CPF já está em uso',
          fields: { cpf: ['Este CPF já está em uso'] },
        });
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        email: input.email,
        // E-mail novo precisa ser confirmado de novo
        ...(input.email !== user.email ? { emailVerifiedAt: null } : {}),
        ...(cpfChanged
          ? {
              cpf: {
                upsert: { create: { cpf: input.cpf! }, update: { cpf: input.cpf! } },
              },
            }
          : {}),
      },
      select: USER_SELECT,
    });
    if (input.email !== user.email) await this.emailVerification.send(userId);
    return toUserDto(updated);
  }

  /**
   * Celular para o WhatsApp. Trocar o número desfaz a confirmação; o consentimento
   * guarda quando foi dado, e retirar o consentimento vale na hora.
   */
  async setPhone(userId: string, input: PhoneInputParsed): Promise<ProfileDto> {
    const [current, taken] = await Promise.all([
      this.prisma.userPhone.findUnique({
        where: { userId },
        select: { phone: true, whatsappOptIn: true },
      }),
      this.prisma.userPhone.findUnique({ where: { phone: input.phone }, select: { userId: true } }),
    ]);
    if (taken && taken.userId !== userId) {
      throw new ConflictException({
        message: 'Este celular já está em outra conta',
        fields: { phone: ['Este celular já está em outra conta'] },
      });
    }
    const changed = current?.phone !== input.phone;
    const optInAt =
      input.whatsappOptIn && (!current?.whatsappOptIn || changed) ? new Date() : undefined;
    await this.prisma.userPhone.upsert({
      where: { userId },
      create: {
        userId,
        phone: input.phone,
        whatsappOptIn: input.whatsappOptIn,
        optInAt: input.whatsappOptIn ? new Date() : null,
      },
      update: {
        phone: input.phone,
        whatsappOptIn: input.whatsappOptIn,
        ...(optInAt ? { optInAt } : {}),
        ...(input.whatsappOptIn ? {} : { optInAt: null }),
        ...(changed ? { verifiedAt: null } : {}),
      },
    });
    return this.getProfile(userId);
  }

  async removePhone(userId: string): Promise<ProfileDto> {
    await this.prisma.userPhone.deleteMany({ where: { userId } });
    return this.getProfile(userId);
  }

  async updateAlerts(userId: string, alerts: AlertPreferences): Promise<ProfileDto> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        alertDueSoon: alerts.dueSoon,
        alertDueDays: alerts.dueDays,
        alertBudget: alerts.budget,
        alertBudgetPercent: alerts.budgetPercent,
        alertNegativeBalance: alerts.negativeBalance,
      },
    });
    return this.getProfile(userId);
  }

  async setAvatar(
    userId: string,
    file: { buffer: Buffer; size: number } | undefined,
  ): Promise<UserDto> {
    if (!file) throw new BadRequestException('Envie uma imagem no campo "file"');
    if (file.size > AVATAR_MAX_BYTES) {
      throw new BadRequestException('A imagem deve ter no máximo 1 MB');
    }
    const mimeType = detectImageType(file.buffer);
    if (!mimeType) throw new BadRequestException('Use uma imagem JPG, PNG ou WebP');

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        avatarData: new Uint8Array(file.buffer),
        avatarMimeType: mimeType,
        avatarUpdatedAt: new Date(),
      },
      select: USER_SELECT,
    });
    return toUserDto(user);
  }

  async removeAvatar(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarData: null, avatarMimeType: null, avatarUpdatedAt: null },
      select: USER_SELECT,
    });
    return toUserDto(user);
  }

  async getAvatar(userId: string): Promise<{ data: Uint8Array; mimeType: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarData: true, avatarMimeType: true },
    });
    if (!user?.avatarData || !user.avatarMimeType) {
      throw new NotFoundException('Sem foto de perfil');
    }
    return { data: user.avatarData, mimeType: user.avatarMimeType };
  }
}
