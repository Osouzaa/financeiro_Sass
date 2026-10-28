import { BadRequestException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { PrismaService } from '../prisma/prisma.service';
import { detectImageType } from './image-signature';
import { UsersService } from './users.service';

function setup() {
  const user = { findUnique: jest.fn(), update: jest.fn() };
  const service = new UsersService({ user } as unknown as PrismaService);
  return { service, user };
}

const profile = { name: 'Gabriel', email: 'gabriel@exemplo.com' };

describe('UsersService.updateProfile', () => {
  it('atualiza o nome sem pedir senha quando o e-mail não muda', async () => {
    const { service, user } = setup();
    user.findUnique.mockResolvedValueOnce({ email: profile.email, passwordHash: 'x' });
    user.update.mockResolvedValue({ id: 'u1', ...profile, avatarUpdatedAt: null });

    await expect(service.updateProfile('u1', profile)).resolves.toMatchObject({ name: 'Gabriel' });
  });

  it('exige a senha atual para trocar o e-mail', async () => {
    const { service, user } = setup();
    user.findUnique.mockResolvedValueOnce({ email: 'antigo@exemplo.com', passwordHash: 'x' });
    await expect(service.updateProfile('u1', profile)).rejects.toBeInstanceOf(BadRequestException);
    expect(user.update).not.toHaveBeenCalled();
  });

  it('recusa e-mail já usado por outra pessoa', async () => {
    const { service, user } = setup();
    user.findUnique
      .mockResolvedValueOnce({
        email: 'antigo@exemplo.com',
        passwordHash: await bcrypt.hash('senha1234', 4),
      })
      .mockResolvedValueOnce({ id: 'outra-pessoa' });
    await expect(
      service.updateProfile('u1', { ...profile, currentPassword: 'senha1234' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('UsersService.setAvatar', () => {
  it('recusa arquivo que não é imagem, mesmo com nome de imagem', async () => {
    const { service } = setup();
    const fake = Buffer.from('<script>alert(1)</script>');
    await expect(service.setAvatar('u1', { buffer: fake, size: fake.length })).rejects.toThrow(
      'JPG, PNG ou WebP',
    );
  });

  it('recusa imagens acima de 1 MB', async () => {
    const { service } = setup();
    await expect(
      service.setAvatar('u1', { buffer: Buffer.alloc(10), size: 2_000_000 }),
    ).rejects.toThrow('1 MB');
  });
});

describe('detectImageType', () => {
  it('reconhece JPEG, PNG e WebP pela assinatura', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(
      detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])),
    ).toBe('image/png');
    expect(detectImageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(detectImageType(Buffer.from('GIF89a'))).toBeNull();
  });
});
