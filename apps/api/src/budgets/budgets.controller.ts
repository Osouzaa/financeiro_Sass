import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  budgetCopySchema,
  budgetInputSchema,
  budgetMonthSchema,
  type BudgetCopyInput,
  type BudgetInputParsed,
  type BudgetMonthDto,
} from '@financeiro/shared';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { openApiSchema, ZodValidationPipe } from '../common/zod/zod-validation.pipe';
import { BudgetsService } from './budgets.service';

@ApiTags('Orçamento')
@ApiBearerAuth()
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get()
  @ApiOperation({ summary: 'Limites do mês por categoria, com o realizado e o previsto' })
  @ApiQuery({ name: 'month', required: true, example: '2026-11' })
  month(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(budgetMonthSchema)) { month }: { month: string },
  ): Promise<BudgetMonthDto> {
    return this.budgets.month(user.id, month);
  }

  @Put()
  @ApiOperation({ summary: 'Define ou troca o limite de uma categoria no mês' })
  @ApiBody({ schema: openApiSchema(budgetInputSchema) })
  upsert(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(budgetInputSchema)) body: BudgetInputParsed,
  ): Promise<BudgetMonthDto> {
    return this.budgets.upsert(user.id, body);
  }

  @Post('copy')
  @HttpCode(200)
  @ApiOperation({ summary: 'Copia os limites de outro mês (sem sobrescrever)' })
  @ApiBody({ schema: openApiSchema(budgetCopySchema) })
  copy(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(budgetCopySchema)) body: BudgetCopyInput,
  ): Promise<BudgetMonthDto> {
    return this.budgets.copy(user.id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove o limite de uma categoria' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.budgets.remove(user.id, id);
  }
}
