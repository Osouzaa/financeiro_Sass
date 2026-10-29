import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { AppConfig } from '../config/app-config';
import type { MailService } from '../mail/mail.service';
import type { PrismaService } from '../prisma/prisma.service';
import { PasswordResetService } from './password-reset.service';
import { hashToken, type RefreshTokenService } from './refresh-token.service';

function setup() {
  const user = { findUnique: jest.fn(), update: jest.fn() };
  const userCpf = { findUnique: jest.fn() };
  const passwordResetToken = {
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    create: jest.fn(),
    findUnique: jest.fn(),
  };
  const client = { user, userCpf, passwordResetToken };
  const prisma = {
    ...client,
    $transaction: jest.fn((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: typeof client) => unknown)(client)
        : Promise.all(arg as unknown[]),
    ),
  };
  const mail = { send: jest.fn().mockResolvedValue(undefined) };
  const refreshTokens = { revokeAll: jest.fn() };
  const service = new PasswordResetService(
    prisma as unknown as PrismaService,
    { appUrl: 'https://app.exemplo.com' } as AppConfig,
    mail as unknown as MailService,
    refreshTokens as unknown as RefreshTokenService,
  );
  return { service, user, userCpf, passwordResetToken, mail, refreshTokens };
}

const account = { id: 'u1', name: 'Gabriel Souza', email: 'gabriel@exemplo.com' };

describe('PasswordResetService.request', () => {
  it('conta inexistente: não cria token nem envia e-mail, e não dá erro', async () => {
    const { service, user, passwordResetToken, mail } = setup();
    user.findUnique.mockResolvedValue(null);
    await expect(service.request('ninguem@exemplo.com')).resolves.toBeUndefined();
    expect(passwordResetToken.create).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('texto que não é e-mail nem CPF nem consulta o banco', async () => {
    const { service, user, userCpf } = setup();
    await service.request("' OR 1=1 --");
    expect(user.findUnique).not.toHaveBeenCalled();
    expect(userCpf.findUnique).not.toHaveBeenCalled();
  });

  it('pelo CPF: guarda só o hash do token, invalida os anteriores e manda o link', async () => {
    const { service, userCpf, passwordResetToken, mail } = setup();
    userCpf.findUnique.mockResolvedValue({ user: account });

    await service.request('529.982.247-25', '10.0.0.1');

    expect(userCpf.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cpf: '52998224725' } }),
    );
    expect(passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    const { data } = passwordResetToken.create.mock.calls[0][0];
    const message = mail.send.mock.calls[0][0];
    const token = /token=([A-Za-z0-9_-]+)/.exec(message.text)![1]!;
    expect(message.to).toBe('gabriel@exemplo.com');
    expect(message.text).toContain('https://app.exemplo.com/redefinir-senha?token=');
    expect(data.tokenHash).toBe(hashToken(token));
    expect(data.tokenHash).not.toContain(token);
    expect(data.requestIp).toBe('10.0.0.1');
    // Validade de 30 minutos
    const minutes = (data.expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(29);
    expect(minutes).toBeLessThanOrEqual(30);
  });
});

describe('PasswordResetService.reset', () => {
  const input = {
    token: 'a'.repeat(43),
    newPassword: 'novaSenha123',
    confirmPassword: 'novaSenha123',
  };
  const valid = {
    id: 't1',
    userId: 'u1',
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    user: account,
  };

  it('troca a senha, marca o link como usado e encerra todas as sessões', async () => {
    const { service, passwordResetToken, user, refreshTokens, mail } = setup();
    passwordResetToken.findUnique.mockResolvedValue(valid);

    await service.reset(input);

    expect(passwordResetToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashToken(input.token) } }),
    );
    const { passwordHash } = user.update.mock.calls[0][0].data;
    expect(await bcrypt.compare('novaSenha123', passwordHash)).toBe(true);
    expect(refreshTokens.revokeAll).toHaveBeenCalledWith('u1');
    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Sua senha foi alterada' }),
    );
  });

  it.each([
    ['inexistente', null],
    ['expirado', { ...valid, expiresAt: new Date(Date.now() - 1000) }],
    ['já usado', { ...valid, usedAt: new Date() }],
  ])('recusa link %s', async (_label, record) => {
    const { service, passwordResetToken, user } = setup();
    passwordResetToken.findUnique.mockResolvedValue(record);
    await expect(service.reset(input)).rejects.toBeInstanceOf(BadRequestException);
    expect(user.update).not.toHaveBeenCalled();
  });

  it('dois envios simultâneos do mesmo link: só um troca a senha', async () => {
    const { service, passwordResetToken, user } = setup();
    passwordResetToken.findUnique.mockResolvedValue(valid);
    passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.reset(input)).rejects.toBeInstanceOf(BadRequestException);
    expect(user.update).not.toHaveBeenCalled();
  });
});
