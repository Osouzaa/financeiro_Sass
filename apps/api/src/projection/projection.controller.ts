import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  projectionQuerySchema,
  type ProjectionDto,
  type ProjectionQuery,
} from '@financeiro/shared';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/zod/zod-validation.pipe';
import { ProjectionService } from './projection.service';

@ApiTags('Projeção')
@ApiBearerAuth()
@Controller('projection')
export class ProjectionController {
  constructor(private readonly projection: ProjectionService) {}

  @Get()
  @ApiOperation({
    summary: 'Saldo previsto dia a dia, com o menor saldo e o primeiro dia negativo',
  })
  @ApiQuery({ name: 'days', required: false, type: Number, example: 90 })
  @ApiQuery({ name: 'accountId', required: false })
  project(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(projectionQuerySchema)) query: ProjectionQuery,
  ): Promise<ProjectionDto> {
    return this.projection.project(user.id, query);
  }
}
