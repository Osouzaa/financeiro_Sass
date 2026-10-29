import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Confere a assinatura dos webhooks do Mercado Pago.
 *
 * O cabeçalho `x-signature` vem como "ts=1704908010,v1=<hmac>". O HMAC-SHA256,
 * com a chave secreta do painel, é calculado sobre o manifesto
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`. Partes ausentes saem do
 * manifesto, como na documentação do Mercado Pago.
 */
export function verifyMercadoPagoSignature(input: {
  secret: string;
  signatureHeader: string | undefined;
  requestId: string | undefined;
  dataId: string | undefined;
}): boolean {
  if (!input.signatureHeader) return false;
  const parts = Object.fromEntries(
    input.signatureHeader.split(',').map((part) => {
      const [key, ...rest] = part.trim().split('=');
      return [key, rest.join('=')];
    }),
  ) as Record<string, string | undefined>;
  const { ts, v1 } = parts;
  if (!ts || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) return false;

  // Ids alfanuméricos vêm em minúsculas no manifesto
  const dataId =
    input.dataId && /^[a-z0-9]+$/i.test(input.dataId) ? input.dataId.toLowerCase() : input.dataId;
  const manifest =
    (dataId ? `id:${dataId};` : '') +
    (input.requestId ? `request-id:${input.requestId};` : '') +
    `ts:${ts};`;
  const expected = createHmac('sha256', input.secret).update(manifest).digest();
  const received = Buffer.from(v1, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** Gera o cabeçalho como o Mercado Pago gera (usado nos testes e no simulador). */
export function signMercadoPago(
  secret: string,
  dataId: string,
  requestId: string,
  ts: string,
): string {
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  return `ts=${ts},v1=${createHmac('sha256', secret).update(manifest).digest('hex')}`;
}
