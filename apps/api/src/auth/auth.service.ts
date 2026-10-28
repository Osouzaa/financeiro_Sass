import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  SessionDto,
  UserDto,
} from '@financeiro/shared';
import { CategoriesService } from '../categories/categories.service';
import { AppConfig } from '../config/app-config';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, verifyPassword } from './password';
import { hashToken, RefreshTokenService } from './refresh-token.service';
import { toUserDto, USER_SELECT } from './user-dto';

export interface Session {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: UserDto;
}

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
    private readonly refreshTokens: RefreshTokenService,
    private readonly categories: CategoriesService,
  ) {}

  async register(input: RegisterInput, userAgent?: string): Promise<Session> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Este e-mail já está cadastrado');

    const passwordHash = await hashPassword(input.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { name: input.name, email: input.email, passwordHash },
        select: USER_SELECT,
      });
      await this.categories.createDefaults(tx, created.id);
      return created;
    });

    return this.createSession(toUserDto(user), userAgent);
  }

  async login(input: LoginInput, userAgent?: string): Promise<Session> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { ...USER_SELECT, passwordHash: true },
    });

    const valid = await verifyPassword(input.password, user?.passwordHash);
    if (!user || !valid) throw new UnauthorizedException('E-mail ou senha inválidos');

    return this.createSession(toUserDto(user), userAgent);
  }

  async refresh(refreshToken: string, userAgent?: string): Promise<Session> {
    const rotated = await this.refreshTokens.rotate(refreshToken, userAgent);
    const user = await this.getUser(rotated.userId);
    return {
      ...(await this.createAccessToken(user)),
      refreshToken: rotated.token,
      refreshExpiresAt: rotated.expiresAt,
      user,
    };
  }

  logout(refreshToken: string): Promise<void> {
    return this.refreshTokens.revoke(refreshToken);
  }

  /**
   * Troca a senha, encerra todas as sessões (inclusive em outros dispositivos)
   * e abre uma sessão nova para este dispositivo.
   */
  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    userAgent?: string,
  ): Promise<Session> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { ...USER_SELECT, passwordHash: true },
    });
    if (!user) throw new UnauthorizedException('Usuário não encontrado');

    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      // 400, e não 401: um 401 faria o front tentar renovar a sessão
      throw new BadRequestException({
        message: 'Senha atual incorreta',
        fields: { currentPassword: ['Senha atual incorreta'] },
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(input.newPassword) },
    });
    await this.refreshTokens.revokeAll(userId);
    return this.createSession(toUserDto(user), userAgent);
  }

  async listSessions(userId: string, currentToken?: string): Promise<SessionDto[]> {
    const currentHash = currentToken ? hashToken(currentToken) : undefined;
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, createdAt: true, tokenHash: true },
      orderBy: { createdAt: 'desc' },
    });
    return tokens.map((token) => ({
      id: token.id,
      userAgent: token.userAgent,
      createdAt: token.createdAt.toISOString(),
      current: token.tokenHash === currentHash,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundException('Sessão não encontrada');
  }

  async revokeOtherSessions(userId: string, currentToken?: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(currentToken ? { NOT: { tokenHash: hashToken(currentToken) } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  }

  async getUser(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT,
    });
    if (!user) throw new UnauthorizedException('Usuário não encontrado');
    return toUserDto(user);
  }

  private async createSession(user: UserDto, userAgent?: string): Promise<Session> {
    const refresh = await this.refreshTokens.issue(user.id, userAgent);
    return {
      ...(await this.createAccessToken(user)),
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
      user,
    };
  }

  private async createAccessToken(user: UserDto) {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const { secret, ttlSeconds } = this.config.jwt;
    const accessToken = await this.jwt.signAsync(payload, { secret, expiresIn: ttlSeconds });
    return { accessToken, expiresIn: ttlSeconds };
  }
}
