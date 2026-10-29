import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { MyPlanDto, PlanDto } from '@financeiro/shared';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { PlansService } from './plans.service';

@ApiTags('Planos')
@Controller()
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'Planos à venda (página de planos e cadastro)' })
  list(): Promise<PlanDto[]> {
    return this.plans.listPublic();
  }

  @Get('me/plan')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Plano atual, assinatura e quanto dos limites já foi usado' })
  mine(@CurrentUser() user: AuthUser): Promise<MyPlanDto> {
    return this.plans.myPlan(user.id);
  }
}
