import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AppConfig } from '../config/app-config';

/** Assinatura (preapproval) como o Mercado Pago devolve; só os campos usados. */
export interface MpPreapproval {
  id: string;
  status: string;
  external_reference?: string | null;
  init_point?: string;
  payer_email?: string;
  next_payment_date?: string | null;
  auto_recurring?: { transaction_amount?: number; start_date?: string; frequency?: number };
}

/** Cobrança de uma assinatura (authorized_payment). */
export interface MpAuthorizedPayment {
  id: number | string;
  preapproval_id: string;
  transaction_amount: number;
  status?: string;
  date_created?: string;
  debit_date?: string;
  payment?: { id?: number | string; status?: string; status_detail?: string };
}

const TIMEOUT_MS = 10_000;

/**
 * Cliente mínimo da API do Mercado Pago. O token nunca sai da API e nunca vai
 * para log; erros do provedor viram 503 com mensagem genérica para o usuário.
 */
@Injectable()
export class MercadoPagoClient {
  private readonly logger = new Logger(MercadoPagoClient.name);

  constructor(private readonly config: AppConfig) {}

  get configured(): boolean {
    return Boolean(this.config.mercadoPago.accessToken);
  }

  createPreapproval(body: Record<string, unknown>, idempotencyKey: string): Promise<MpPreapproval> {
    return this.request('POST', '/preapproval', body, idempotencyKey);
  }

  getPreapproval(id: string): Promise<MpPreapproval> {
    return this.request('GET', `/preapproval/${encodeURIComponent(id)}`);
  }

  cancelPreapproval(id: string): Promise<MpPreapproval> {
    return this.request('PUT', `/preapproval/${encodeURIComponent(id)}`, { status: 'cancelled' });
  }

  getAuthorizedPayment(id: string): Promise<MpAuthorizedPayment> {
    return this.request('GET', `/authorized_payments/${encodeURIComponent(id)}`);
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    const { accessToken, apiBase } = this.config.mercadoPago;
    if (!accessToken)
      throw new ServiceUnavailableException('Pagamentos ainda não estão configurados');

    let response: Response;
    try {
      response = await fetch(`${apiBase}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.error(`Mercado Pago indisponível em ${method} ${path}: ${String(error)}`);
      throw new ServiceUnavailableException(
        'Não foi possível falar com o Mercado Pago. Tente de novo.',
      );
    }

    if (!response.ok) {
      // A resposta de erro pode ter detalhes úteis; o token nunca está nela
      const detail = (await response.text().catch(() => '')).slice(0, 500);
      this.logger.error(
        `Mercado Pago respondeu ${response.status} em ${method} ${path}: ${detail}`,
      );
      throw new ServiceUnavailableException(
        'O Mercado Pago recusou a operação. Tente de novo em instantes.',
      );
    }
    return (await response.json()) as T;
  }
}
