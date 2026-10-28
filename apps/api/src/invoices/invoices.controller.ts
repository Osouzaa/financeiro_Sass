import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  invoiceFilterSchema,
  invoicePaymentSchema,
  type InvoiceDetailDto,
  type InvoiceDto,
  type InvoiceFilterParsed,
  type InvoicePaymentInputParsed,
  type TransactionDto,
} from '@financeiro/shared';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { openApiSchema, ZodValidationPipe } from '../common/zod/zod-validation.pipe';
import { InvoicesService } from './invoices.service';

@ApiTags('Faturas')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @ApiOperation({
    summary: 'Faturas com totais e status (por cartão, ou só as que têm valor a pagar)',
  })
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(invoiceFilterSchema)) filter: InvoiceFilterParsed,
  ): Promise<InvoiceDto[]> {
    return this.invoices.list(user.id, filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fatura com compras, estornos e pagamentos' })
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InvoiceDetailDto> {
    return this.invoices.get(user.id, id);
  }

  @Post(':id/pay')
  @ApiOperation({ summary: 'Paga a fatura (total ou parcial) com uma conta corrente ou carteira' })
  @ApiBody({ schema: openApiSchema(invoicePaymentSchema) })
  pay(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(invoicePaymentSchema)) body: InvoicePaymentInputParsed,
  ): Promise<TransactionDto> {
    return this.invoices.pay(user.id, id, body);
  }
}
