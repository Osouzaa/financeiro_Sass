import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { LoginInput, RegisterInput, UserDto } from '@financeiro/shared';
import * as bcrypt from 'bcryptjs';
import { CategoriesService } from '../categories/categories.service';
import { AppConfig } from '../config/app-config';
import { PrismaService } from '../prisma/prisma.service';
import { RefreshTokenService } from './refresh-token.service';

const BCRYPT_COST = 12;

/**
 * Hash de uma senha qualquer, usado quando o e-mail não existe.
 * Assim o login leva o mesmo tempo nos dois casos e não revela quais e-mails estão cadastrados.
 */
const DUMMY_HASH = '$2b$12$/pelSEX1kDoOaYyLcatROe4tC9ik3luUZf0LbL38Ra2b8Mr5ykoyq';

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

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { name: input.name, email: input.email, passwordHash },
        select: { id: true, name: true, email: true },
      });
      await this.categories.createDefaults(tx, created.id);
      return created;
    });

    return this.createSession(user, userAgent);
  }

  async login(input: LoginInput, userAgent?: string): Promise<Session> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, name: true, email: true, passwordHash: true },
    });

    const valid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) throw new UnauthorizedException('E-mail ou senha inválidos');

    return this.createSession({ id: user.id, name: user.name, email: user.email }, userAgent);
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

  async getUser(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    if (!user) throw new UnauthorizedException('Usuário não encontrado');
    return user;
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
