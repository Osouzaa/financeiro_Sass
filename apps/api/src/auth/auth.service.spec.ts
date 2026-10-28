import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { CategoriesService } from '../categories/categories.service';
import type { AppConfig } from '../config/app-config';
import type { PrismaService } from '../prisma/prisma.service';
import { AuthService, type JwtPayload } from './auth.service';
import type { RefreshTokenService } from './refresh-token.service';

const SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';

function setup() {
  const user = { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() };
  const tx = { user };
  const prisma = {
    user,
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  } as unknown as PrismaService;
  const config = { jwt: { secret: SECRET, ttlSeconds: 900 } } as AppConfig;
  const refreshTokens = {
    issue: jest.fn().mockResolvedValue({ id: 'rt', token: 'refresh-token', expiresAt: new Date() }),
    rotate: jest.fn(),
    revoke: jest.fn(),
    revokeAll: jest.fn(),
  };
  const categories = { createDefaults: jest.fn() };
  const jwt = new JwtService();
  const service = new AuthService(
    prisma,
    jwt,
    config,
    refreshTokens as unknown as RefreshTokenService,
    categories as unknown as CategoriesService,
  );
  return { service, user, prisma, refreshTokens, categories, jwt };
}

const input = { name: 'Gabriel', email: 'gabriel@exemplo.com', password: 'senha1234' };

describe('AuthService', () => {
  describe('register', () => {
    it('recusa e-mail já cadastrado', async () => {
      const { service, user } = setup();
      user.findUnique.mockResolvedValue({ id: 'existente' });
      await expect(service.register(input)).rejects.toBeInstanceOf(ConflictException);
      expect(user.create).not.toHaveBeenCalled();
    });

    it('cria o usuário com senha em hash, semeia categorias e abre a sessão', async () => {
      const { service, user, categories, jwt } = setup();
      user.findUnique.mockResolvedValue(null);
      user.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'u1', name: data.name, email: data.email }),
      );

      const session = await service.register(input);

      const { passwordHash } = user.create.mock.calls[0][0].data;
      expect(passwordHash).not.toBe(input.password);
      expect(await bcrypt.compare(input.password, passwordHash)).toBe(true);
      expect(categories.createDefaults).toHaveBeenCalledWith(expect.anything(), 'u1');

      const payload = await jwt.verifyAsync<JwtPayload>(session.accessToken, { secret: SECRET });
      expect(payload.sub).toBe('u1');
      expect(session.refreshToken).toBe('refresh-token');
      expect(session.user).toEqual({
        id: 'u1',
        name: 'Gabriel',
        email: 'gabriel@exemplo.com',
        avatarVersion: null,
      });
    });
  });

  describe('login', () => {
    it('recusa e-mail inexistente com a mesma mensagem de senha errada', async () => {
      const { service, user } = setup();
      user.findUnique.mockResolvedValue(null);
      await expect(service.login({ email: input.email, password: 'x' })).rejects.toThrow(
        'E-mail ou senha inválidos',
      );
    });

    it('recusa senha incorreta', async () => {
      const { service, user, refreshTokens } = setup();
      user.findUnique.mockResolvedValue({
        id: 'u1',
        name: 'G',
        email: input.email,
        passwordHash: await bcrypt.hash('outra123', 4),
      });
      await expect(
        service.login({ email: input.email, password: input.password }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(refreshTokens.issue).not.toHaveBeenCalled();
    });

    it('abre a sessão com senha correta e não expõe o hash', async () => {
      const { service, user } = setup();
      user.findUnique.mockResolvedValue({
        id: 'u1',
        name: 'G',
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, 4),
      });
      const session = await service.login({ email: input.email, password: input.password });
      expect(session.user).toEqual({
        id: 'u1',
        name: 'G',
        email: input.email,
        avatarVersion: null,
      });
      expect(session.user).not.toHaveProperty('passwordHash');
    });
  });

  it('refresh usa o token rotacionado e devolve novo access token', async () => {
    const { service, user, refreshTokens } = setup();
    refreshTokens.rotate.mockResolvedValue({ userId: 'u1', token: 'novo', expiresAt: new Date() });
    user.findUnique.mockResolvedValue({ id: 'u1', name: 'G', email: input.email });

    const session = await service.refresh('antigo');
    expect(session.refreshToken).toBe('novo');
    expect(session.accessToken).toEqual(expect.any(String));
  });

  describe('changePassword', () => {
    const change = {
      currentPassword: 'senha1234',
      newPassword: 'NovaSenha99',
      confirmPassword: 'NovaSenha99',
    };

    it('recusa senha atual incorreta sem alterar nada', async () => {
      const { service, user, refreshTokens } = setup();
      user.findUnique.mockResolvedValue({
        id: 'u1',
        name: 'G',
        email: input.email,
        passwordHash: await bcrypt.hash('outra123', 4),
      });
      await expect(service.changePassword('u1', change)).rejects.toThrow('Senha atual incorreta');
      expect(user.update).not.toHaveBeenCalled();
      expect(refreshTokens.revokeAll).not.toHaveBeenCalled();
    });

    it('troca o hash, encerra todas as sessões e abre uma nova', async () => {
      const { service, user, refreshTokens } = setup();
      user.findUnique.mockResolvedValue({
        id: 'u1',
        name: 'G',
        email: input.email,
        passwordHash: await bcrypt.hash(change.currentPassword, 4),
      });
      const session = await service.changePassword('u1', change);

      const { passwordHash } = user.update.mock.calls[0][0].data;
      expect(await bcrypt.compare(change.newPassword, passwordHash)).toBe(true);
      expect(refreshTokens.revokeAll).toHaveBeenCalledWith('u1');
      expect(refreshTokens.issue).toHaveBeenCalled();
      expect(session.refreshToken).toBe('refresh-token');
    });
  });
});
