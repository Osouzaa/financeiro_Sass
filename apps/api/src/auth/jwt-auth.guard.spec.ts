import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { AppConfig } from '../config/app-config';
import { JwtAuthGuard } from './jwt-auth.guard';

const SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function setup(isPublic = false) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(isPublic),
  } as unknown as Reflector;
  const jwt = new JwtService();
  const guard = new JwtAuthGuard(reflector, jwt, { jwt: { secret: SECRET } } as AppConfig);
  return { guard, jwt };
}

describe('JwtAuthGuard', () => {
  it('libera rotas públicas sem token', async () => {
    const { guard } = setup(true);
    await expect(guard.canActivate(contextFor({ headers: {} }))).resolves.toBe(true);
  });

  it('bloqueia requisição sem token', async () => {
    const { guard } = setup();
    await expect(guard.canActivate(contextFor({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('bloqueia token assinado com outro segredo', async () => {
    const { guard, jwt } = setup();
    const token = await jwt.signAsync(
      { sub: 'u1', email: 'a@b.com' },
      { secret: 'outro-segredo-qualquer-com-32-caracteres' },
    );
    await expect(
      guard.canActivate(contextFor({ headers: { authorization: `Bearer ${token}` } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('aceita token válido e coloca o usuário na requisição', async () => {
    const { guard, jwt } = setup();
    const token = await jwt.signAsync({ sub: 'u1', email: 'a@b.com' }, { secret: SECRET });
    const request: Record<string, unknown> = { headers: { authorization: `Bearer ${token}` } };
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'u1', email: 'a@b.com' });
  });
});
