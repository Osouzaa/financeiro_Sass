import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  adminPaymentsQuerySchema,
  adminSubscriptionSchema,
  adminUsersQuerySchema,
  planInputSchema,
  UserStatus,
  type AdminBillingDto,
  type AdminMetricsDto,
  type AdminPaymentDto,
  type AdminPaymentsQuery,
  type AdminSubscriptionInputParsed,
  type AdminUserDto,
  type AdminUsersQuery,
  type AuditEntryDto,
  type PageDto,
  type PlanDto,
  type PlanInputParsed,
} from '@financeiro/shared';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { openApiSchema, ZodValidationPipe } from '../common/zod/zod-validation.pipe';
import { BillingService } from '../billing/billing.service';
import { AdminService } from './admin.service';
import { SuperAdminGuard } from './super-admin.guard';

@ApiTags('Administração')
@ApiBearerAuth()
@UseGuards(SuperAdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly billing: BillingService,
  ) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Usuários, distribuição por plano e receita mensal estimada' })
  metrics(): Promise<AdminMetricsDto> {
    return this.admin.metrics();
  }

  @Get('users')
  @ApiOperation({ summary: 'Contas, com busca por nome, e-mail ou CPF' })
  users(
    @Query(new ZodValidationPipe(adminUsersQuerySchema)) query: AdminUsersQuery,
  ): Promise<PageDto<AdminUserDto>> {
    return this.admin.listUsers(query);
  }

  @Put('users/:id/subscription')
  @HttpCode(204)
  @ApiOperation({ summary: 'Define o plano de uma conta (inclusive a própria)' })
  @ApiBody({ schema: openApiSchema(adminSubscriptionSchema) })
  setSubscription(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(adminSubscriptionSchema)) body: AdminSubscriptionInputParsed,
  ): Promise<void> {
    return this.admin.setSubscription(actor.id, id, body);
  }

  @Post('users/:id/suspend')
  @HttpCode(204)
  @ApiOperation({ summary: 'Suspende a conta e encerra as sessões' })
  suspend(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.admin.setStatus(actor.id, id, UserStatus.SUSPENDED);
  }

  @Post('users/:id/reactivate')
  @HttpCode(204)
  @ApiOperation({ summary: 'Reativa uma conta suspensa' })
  reactivate(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.admin.setStatus(actor.id, id, UserStatus.ACTIVE);
  }

  @Post('users/:id/billing/cancel')
  @HttpCode(204)
  @ApiOperation({ summary: 'Cancela a cobrança recorrente da conta no Mercado Pago' })
  cancelBilling(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.admin.cancelBilling(actor.id, id);
  }

  @Get('billing')
  @ApiOperation({
    summary: 'Situação da integração, receita do mês e últimos avisos do Mercado Pago',
  })
  billingSummary(): Promise<AdminBillingDto> {
    return this.billing.adminSummary();
  }

  @Get('payments')
  @ApiOperation({ summary: 'Cobranças, com busca por e-mail, nome ou id do Mercado Pago' })
  payments(
    @Query(new ZodValidationPipe(adminPaymentsQuerySchema)) query: AdminPaymentsQuery,
  ): Promise<PageDto<AdminPaymentDto>> {
    return this.billing.adminPayments(query);
  }

  @Get('plans')
  @ApiOperation({ summary: 'Todos os planos, inclusive os fora da vitrine' })
  plans(): Promise<PlanDto[]> {
    return this.admin.listPlans();
  }

  @Post('plans')
  @ApiOperation({ summary: 'Cria um plano' })
  @ApiBody({ schema: openApiSchema(planInputSchema) })
  createPlan(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(planInputSchema)) body: PlanInputParsed,
  ): Promise<PlanDto> {
    return this.admin.createPlan(actor.id, body);
  }

  @Put('plans/:id')
  @ApiOperation({ summary: 'Edita preço, limites e vitrine de um plano' })
  @ApiBody({ schema: openApiSchema(planInputSchema) })
  updatePlan(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(planInputSchema)) body: PlanInputParsed,
  ): Promise<PlanDto> {
    return this.admin.updatePlan(actor.id, id, body);
  }

  @Get('audit')
  @ApiOperation({ summary: 'Registro das ações administrativas' })
  audit(
    @Query(new ZodValidationPipe(adminUsersQuerySchema)) query: AdminUsersQuery,
  ): Promise<PageDto<AuditEntryDto>> {
    return this.admin.auditLog(query.page);
  }
}
