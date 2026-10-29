import { Body, Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  checkoutSchema,
  type CheckoutDto,
  type CheckoutInput,
  type PaymentDto,
} from '@financeiro/shared';
import type { Request, Response } from 'express';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { openApiSchema, ZodValidationPipe } from '../common/zod/zod-validation.pipe';
import { BillingService } from './billing.service';

const CHECKOUT_LIMIT = { default: { limit: 10, ttl: 10 * 60_000 } };

@ApiTags('Assinatura')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Throttle(CHECKOUT_LIMIT)
  @Post('checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cria a assinatura no Mercado Pago e devolve a página do cartão' })
  @ApiBody({ schema: openApiSchema(checkoutSchema) })
  checkout(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(checkoutSchema)) body: CheckoutInput,
  ): Promise<CheckoutDto> {
    return this.billing.checkout(user.id, body.planId);
  }

  @Post('sync')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Confere no Mercado Pago o status da última assinatura (volta do checkout)',
  })
  sync(@CurrentUser() user: AuthUser): Promise<void> {
    return this.billing.sync(user.id);
  }

  @Post('cancel')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancela a cobrança recorrente; o plano vale até o fim do período pago',
  })
  cancel(@CurrentUser() user: AuthUser): Promise<void> {
    return this.billing.cancel(user.id);
  }

  @Get('payments')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Histórico de cobranças da conta' })
  payments(@CurrentUser() user: AuthUser): Promise<PaymentDto[]> {
    return this.billing.myPayments(user.id);
  }

  /** Avisos do Mercado Pago. Público, mas só aceita aviso com assinatura válida. */
  @Public()
  @Post('webhooks/mercadopago')
  @ApiExcludeEndpoint()
  async webhook(
    @Req() req: Request,
    @Query() query: Record<string, unknown>,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: boolean }> {
    const result = await this.billing.handleWebhook({
      headers: { signature: req.get('x-signature'), requestId: req.get('x-request-id') },
      query,
      body,
    });
    if (result === 'rejected') {
      res.status(401);
      return { ok: false };
    }
    res.status(200);
    return { ok: true };
  }
}
