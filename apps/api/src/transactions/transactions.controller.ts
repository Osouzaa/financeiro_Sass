import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  editScopeSchema,
  transactionFilterSchema,
  transactionInputSchema,
  transactionStatusSchema,
  transferInputSchema,
  type EditScopeInput,
  type TransactionDto,
  type TransactionFilterParsed,
  type TransactionInputParsed,
  type TransactionListDto,
  type TransactionStatusInput,
  type TransferInputParsed,
} from '@financeiro/shared';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { openApiSchema, ZodValidationPipe } from '../common/zod/zod-validation.pipe';
import { TransactionsService } from './transactions.service';

@ApiTags('Lançamentos')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista lançamentos do período (até um ano) com totais e gastos por categoria',
  })
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(transactionFilterSchema)) filter: TransactionFilterParsed,
  ): Promise<TransactionListDto> {
    return this.transactions.list(user.id, filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe de um lançamento' })
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TransactionDto> {
    return this.transactions.get(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Lança uma receita ou despesa (no cartão, entra na fatura do período)' })
  @ApiBody({ schema: openApiSchema(transactionInputSchema) })
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(transactionInputSchema)) body: TransactionInputParsed,
  ): Promise<TransactionDto> {
    return this.transactions.create(user.id, body);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Atualiza uma receita ou despesa (parcela/recorrência: só esta ou esta e as próximas)',
  })
  @ApiQuery({ name: 'scope', required: false, enum: ['this', 'future'] })
  @ApiBody({ schema: openApiSchema(transactionInputSchema) })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(editScopeSchema)) { scope }: EditScopeInput,
    @Body(new ZodValidationPipe(transactionInputSchema)) body: TransactionInputParsed,
  ): Promise<TransactionDto> {
    return this.transactions.update(user.id, id, body, scope);
  }

  @Post('transfers')
  @ApiOperation({ summary: 'Transfere entre contas (inclui pagar o cartão)' })
  @ApiBody({ schema: openApiSchema(transferInputSchema) })
  createTransfer(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(transferInputSchema)) body: TransferInputParsed,
  ): Promise<TransactionDto> {
    return this.transactions.createTransfer(user.id, body);
  }

  @Put('transfers/:groupId')
  @ApiOperation({ summary: 'Atualiza as duas pontas de uma transferência' })
  @ApiBody({ schema: openApiSchema(transferInputSchema) })
  updateTransfer(
    @CurrentUser() user: AuthUser,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body(new ZodValidationPipe(transferInputSchema)) body: TransferInputParsed,
  ): Promise<TransactionDto> {
    return this.transactions.updateTransfer(user.id, groupId, body);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Marca como realizado ou previsto' })
  @ApiBody({ schema: openApiSchema(transactionStatusSchema) })
  setStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(transactionStatusSchema)) body: TransactionStatusInput,
  ): Promise<TransactionDto> {
    return this.transactions.setStatus(user.id, id, body.status);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Exclui o lançamento (transferência: as duas pontas; parcela/recorrência: só esta ou desta em diante)',
  })
  @ApiQuery({ name: 'scope', required: false, enum: ['this', 'future'] })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(editScopeSchema)) { scope }: EditScopeInput,
  ): Promise<void> {
    return this.transactions.remove(user.id, id, scope);
  }
}
