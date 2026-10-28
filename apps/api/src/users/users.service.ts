import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AVATAR_MAX_BYTES,
  type AlertPreferences,
  type ProfileDto,
  type UpdateProfileInput,
  type UserDto,
} from '@financeiro/shared';
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
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<ProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PROFILE_SELECT,
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return {
      ...toUserDto(user),
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

  /** Atualiza nome e e-mail. Trocar o e-mail exige a senha atual. */
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, passwordHash: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    if (input.email !== user.email) {
      if (!input.currentPassword) {
        throw new BadRequestException({
          message: 'Confirme sua senha para trocar o e-mail',
          fields: { currentPassword: ['Informe sua senha atual'] },
        });
      }
      if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
        throw new BadRequestException({
          message: 'Senha incorreta',
          fields: { currentPassword: ['Senha incorreta'] },
        });
      }
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

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { name: input.name, email: input.email },
      select: USER_SELECT,
    });
    return toUserDto(updated);
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
