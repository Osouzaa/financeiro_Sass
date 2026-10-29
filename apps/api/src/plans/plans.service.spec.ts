import { ForbiddenException } from '@nestjs/common';
import type { AppConfig } from '../config/app-config';
import type { PrismaService } from '../prisma/prisma.service';
import { PlansService } from './plans.service';

const planRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'p-free',
  code: 'free',
  name: 'Grátis',
  description: '',
  priceAmount: { toString: () => '0' },
  interval: 'MONTH',
  isPublic: true,
  isActive: true,
  highlighted: false,
  sortOrder: 1,
  features: '["2 contas"]',
  maxAccounts: 2,
  maxCards: 1,
  maxRecurrences: 5,
  maxBudgets: 3,
  projectionDays: 30,
  whatsapp: false,
  trialDays: 0,
  ...overrides,
});

function setup(subscription: unknown = null) {
  const prisma = {
    plan: { findUnique: jest.fn().mockResolvedValue(planRow()), findMany: jest.fn() },
    subscription: { findUnique: jest.fn().mockResolvedValue(subscription) },
  };
  return new PlansService(
    prisma as unknown as PrismaService,
    { mercadoPago: { accessToken: undefined } } as unknown as AppConfig,
  );
}

const pro = planRow({
  id: 'p-pro',
  code: 'pro',
  name: 'Pro',
  maxAccounts: null,
  projectionDays: 365,
});
const yesterday = new Date(Date.now() - 2 * 86_400_000);
const nextMonth = new Date(Date.now() + 30 * 86_400_000);

describe('PlansService', () => {
  it('sem assinatura vale o grátis, e o limite barra a 3ª conta com código PLAN_LIMIT', async () => {
    const service = setup();
    await expect(service.assertWithin('u1', 'maxAccounts', 1)).resolves.toBeUndefined();
    await expect(service.assertWithin('u1', 'maxAccounts', 2)).rejects.toMatchObject({
      response: { code: 'PLAN_LIMIT', meta: { limit: 'maxAccounts', planName: 'Grátis' } },
    });
  });

  it('assinatura ativa do Pro libera sem limite', async () => {
    const service = setup({ status: 'ACTIVE', currentPeriodEnd: nextMonth, plan: pro });
    await expect(service.assertWithin('u1', 'maxAccounts', 500)).resolves.toBeUndefined();
    await expect(service.assertProjectionDays('u1', 365)).resolves.toBeUndefined();
  });

  it('assinatura vencida ou cancelada após o período volta para o grátis', async () => {
    for (const subscription of [
      { status: 'ACTIVE', currentPeriodEnd: yesterday, plan: pro },
      { status: 'CANCELED', currentPeriodEnd: yesterday, plan: pro },
      { status: 'CANCELED', currentPeriodEnd: null, plan: pro },
    ]) {
      const service = setup(subscription);
      await expect(service.assertProjectionDays('u1', 90)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    }
  });

  it('cancelada ainda dentro do período pago continua no plano', async () => {
    const service = setup({ status: 'CANCELED', currentPeriodEnd: nextMonth, plan: pro });
    await expect(service.assertProjectionDays('u1', 365)).resolves.toBeUndefined();
  });
});
