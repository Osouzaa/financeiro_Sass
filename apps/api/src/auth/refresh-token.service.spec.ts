import { UnauthorizedException } from '@nestjs/common';
import type { AppConfig } from '../config/app-config';
import type { PrismaService } from '../prisma/prisma.service';
import { hashToken, RefreshTokenService, REUSE_GRACE_MS } from './refresh-token.service';

function setup() {
  const refreshToken = {
    create: jest.fn(({ data }: { data: { id?: string } }) =>
      Promise.resolve({ id: data.id ?? 'novo-id' }),
    ),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  };
  const prisma = { refreshToken } as unknown as PrismaService;
  const config = { refreshToken: { ttlDays: 30 } } as AppConfig;
  return { service: new RefreshTokenService(prisma, config), refreshToken };
}

const future = () => new Date(Date.now() + 86_400_000);
const valid = { id: 'antigo', userId: 'user-1', expiresAt: future() };

describe('RefreshTokenService', () => {
  it('guarda apenas o hash do token emitido', async () => {
    const { service, refreshToken } = setup();
    const issued = await service.issue('user-1', 'jest');

    const saved = refreshToken.create.mock.calls[0]![0].data as { tokenHash: string };
    expect(saved.tokenHash).toBe(hashToken(issued.token));
    expect(saved.tokenHash).not.toBe(issued.token);
    expect(issued.token.length).toBeGreaterThanOrEqual(64);
  });

  it('rotaciona: revoga o antigo já apontando o substituto, e o novo nasce com esse id', async () => {
    const { service, refreshToken } = setup();
    refreshToken.findUnique.mockResolvedValue(valid);
    refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.rotate('token-antigo');

    const claim = refreshToken.updateMany.mock.calls[0][0];
    const created = refreshToken.create.mock.calls[0]![0].data as { id: string };
    expect(claim.where).toEqual({ id: 'antigo', revokedAt: null });
    expect(claim.data.replacedBy).toBe(created.id);
    expect(result.userId).toBe('user-1');
    expect(result.token).not.toBe('token-antigo');
  });

  it('rejeita token inexistente', async () => {
    const { service, refreshToken } = setup();
    refreshToken.findUnique.mockResolvedValue(null);
    await expect(service.rotate('qualquer')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejeita token expirado', async () => {
    const { service, refreshToken } = setup();
    refreshToken.findUnique.mockResolvedValue({ ...valid, expiresAt: new Date(Date.now() - 1000) });
    await expect(service.rotate('expirado')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('reutilização logo após uma rotação (requisições concorrentes) é aceita', async () => {
    const { service, refreshToken } = setup();
    refreshToken.findUnique
      .mockResolvedValueOnce(valid)
      .mockResolvedValueOnce({ revokedAt: new Date(Date.now() - 1000), replacedBy: 'outro' });
    refreshToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.rotate('recem-rotacionado')).resolves.toMatchObject({ userId: 'user-1' });
    expect(refreshToken.updateMany).toHaveBeenCalledTimes(1); // não revogou tudo
  });

  it('token revogado de propósito (logout, troca de senha) não volta, nem logo em seguida', async () => {
    const { service, refreshToken } = setup();
    refreshToken.findUnique
      .mockResolvedValueOnce(valid)
      .mockResolvedValueOnce({ revokedAt: new Date(Date.now() - 500), replacedBy: null });
    refreshToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.rotate('encerrado')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(refreshToken.create).not.toHaveBeenCalled();
  });

  it('reutilização fora da janela revoga todas as sessões do usuário', async () => {
    const { service, refreshToken } = setup();
    refreshToken.findUnique.mockResolvedValueOnce(valid).mockResolvedValueOnce({
      revokedAt: new Date(Date.now() - REUSE_GRACE_MS - 1000),
      replacedBy: 'outro',
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
