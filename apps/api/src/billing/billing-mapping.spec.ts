import { paymentStatusFrom, periodEndFrom, subscriptionStatusFrom } from './billing-mapping';
import { signMercadoPago, verifyMercadoPagoSignature } from './mp-signature';

describe('verifyMercadoPagoSignature', () => {
  const secret = 'chave-secreta-do-painel';
  const header = signMercadoPago(secret, '123456', 'req-1', '1704908010');

  it('aceita a assinatura correta', () => {
    expect(
      verifyMercadoPagoSignature({
        secret,
        signatureHeader: header,
        requestId: 'req-1',
        dataId: '123456',
      }),
    ).toBe(true);
  });

  it('recusa assinatura de outro recurso, outra entrega ou outra chave', () => {
    expect(
      verifyMercadoPagoSignature({
        secret,
        signatureHeader: header,
        requestId: 'req-1',
        dataId: '999',
      }),
    ).toBe(false);
    expect(
      verifyMercadoPagoSignature({
        secret,
        signatureHeader: header,
        requestId: 'req-2',
        dataId: '123456',
      }),
    ).toBe(false);
    expect(
      verifyMercadoPagoSignature({
        secret: 'outra',
        signatureHeader: header,
        requestId: 'req-1',
        dataId: '123456',
      }),
    ).toBe(false);
  });

  it('recusa cabeçalho ausente ou malformado', () => {
    for (const signatureHeader of [undefined, '', 'ts=1', 'v1=abc', 'ts=1,v1=zz']) {
      expect(
        verifyMercadoPagoSignature({ secret, signatureHeader, requestId: 'req-1', dataId: '1' }),
      ).toBe(false);
    }
  });
});

describe('subscriptionStatusFrom', () => {
  const now = new Date('2026-11-01T12:00:00Z');
  const later = new Date('2026-11-08T12:00:00Z');

  it('autorizada dentro do teste grátis fica em teste; depois do teste, ativa', () => {
    expect(
      subscriptionStatusFrom('authorized', {
        firstChargeAt: later,
        hasApprovedPayment: false,
        now,
      }),
    ).toBe('TRIALING');
    expect(
      subscriptionStatusFrom('authorized', {
        firstChargeAt: now,
        hasApprovedPayment: false,
        now: later,
      }),
    ).toBe('ACTIVE');
    expect(
      subscriptionStatusFrom('authorized', { firstChargeAt: null, hasApprovedPayment: false, now }),
    ).toBe('ACTIVE');
  });

  it('pausada vira pagamento pendente, cancelada vira cancelada, pendente não muda nada', () => {
    expect(
      subscriptionStatusFrom('paused', { firstChargeAt: null, hasApprovedPayment: true }),
    ).toBe('PAST_DUE');
    expect(
      subscriptionStatusFrom('cancelled', { firstChargeAt: null, hasApprovedPayment: true }),
    ).toBe('CANCELED');
    expect(
      subscriptionStatusFrom('pending', { firstChargeAt: null, hasApprovedPayment: false }),
    ).toBeNull();
  });
});

describe('paymentStatusFrom e periodEndFrom', () => {
  it('traduz os status de pagamento', () => {
    expect(paymentStatusFrom('approved')).toBe('APPROVED');
    expect(paymentStatusFrom('rejected')).toBe('REJECTED');
    expect(paymentStatusFrom('charged_back')).toBe('REFUNDED');
    expect(paymentStatusFrom('in_process')).toBe('PENDING');
    expect(paymentStatusFrom(undefined)).toBe('PENDING');
  });

  it('período vai até a próxima cobrança mais 3 dias de tolerância', () => {
    expect(periodEndFrom('2026-12-05T10:00:00.000-03:00')?.toISOString().slice(0, 10)).toBe(
      '2026-12-08',
    );
    expect(periodEndFrom(null)).toBeNull();
    expect(periodEndFrom('não é data')).toBeNull();
  });
});
