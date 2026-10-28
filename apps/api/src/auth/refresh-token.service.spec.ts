import { UnauthorizedException } from '@nestjs/common';
import type { AppConfig } from '../config/app-config';
import type { PrismaService } from '../prisma/prisma.service';
import { hashToken, RefreshTokenService, REUSE_GRACE_MS } from './refresh-token.service';

function setup() {
  const refreshToken = {
    create: jest.fn().mockResolvedValue({ id: 'novo-id' }),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  };
  const prisma = { refreshToken } as unknown as PrismaService;
  const config = { refreshToken: { ttlDays: 30 } } as AppConfig;
  return { service: new RefreshTokenService(prisma, config), refreshToken };
}

const future = () => new Date(Date.now() + 86_400_000);

describe('RefreshTokenService', () => {
  it('guarda apenas o hash do token emitido', async () => {
    const { service, refreshToken } = setup();
    const issued = await service.issue('user-1', 'jest');

    const saved = refreshToken.create.mock.calls[0][0].data;
    expect(saved.tokenHash).toBe(hashToken(issued.token));
    expect(saved.tokenHash).not.toBe(issued.token);
    expect(issued.token.length).toBeGreaterThanOrEqual(64);
  });

  it('rotaciona um token válido: revoga o antigo e emite outro', async () => {
    const { service, refreshToken } = setup();
    refreshToken.findUnique.mockResolvedValue({
      id: 'antigo',
      userId: 'user-1',
      expiresAt: future(),
      revokedAt: null,
    });
    refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.rotate('token-antigo');

    expect(result.userId).toBe('user-1');
    expect(result.token).not.toBe('token-antigo');
    expect(refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'antigo' },
      data: { replacedBy: 'novo-id' },
    });
  });

  it('rejeita token inexistente', async () => {
    const { service, refreshToken } = setup();
    refreshToken.findUnique.mockResolvedValue(null);
    await expect(service.rotate('qualquer')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejeita token expirado', async () => {
    const { service, refreshToken } = setup();
    refreshToken.findUnique.mockResolvedValue({
      id: 'x',
      userId: 'user-1',
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
    });
    await expect(service.rotate('expirado')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('reutilização dentro da janela de tolerância (requisições concorrentes) é aceita', async () => {
    const { service, refreshToken } = setup();
    refreshToken.findUnique.mockResolvedValue({
      id: 'x',
      userId: 'user-1',
      expiresAt: future(),
      revokedAt: new Date(Date.now() - 1000),
    });
    refreshToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.rotate('recem-rotacionado')).resolves.toMatchObject({ userId: 'user-1' });
    expect(refreshToken.updateMany).toHaveBeenCalledTimes(1); // não revogou tudo
  });

  it('reutilização fora da janela revoga todas as sessões do usuário', async () => {
    const { service, refreshToken } = setup();
    refreshToken.findUnique.mockResolvedValue({
      id: 'x',
      userId: 'user-1',
      expiresAt: future(),
      revokedAt: new Date(Date.now() - REUSE_GRACE_MS - 1000),
    });
    refreshToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.rotate('roubado')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(refreshToken.updateMany).toHaveBeenLastCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(refreshToken.create).not.toHaveBeenCalled();
  });
});
