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
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  recurrenceInputSchema,
  type RecurrenceDto,
  type RecurrenceInputParsed,
} from '@financeiro/shared';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { openApiSchema, ZodValidationPipe } from '../common/zod/zod-validation.pipe';
import { RecurrencesService } from './recurrences.service';

@ApiTags('Recorrências')
@ApiBearerAuth()
@Controller('recurrences')
export class RecurrencesController {
  constructor(private readonly recurrences: RecurrencesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as recorrências com a próxima data e o peso mensal' })
  list(@CurrentUser() user: AuthUser): Promise<RecurrenceDto[]> {
    return this.recurrences.list(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe de uma recorrência' })
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RecurrenceDto> {
    return this.recurrences.get(user.id, id);
  }

  @Post()
  @ApiOperation({
    summary: 'Cria a recorrência e gera os lançamentos previstos dos próximos 12 meses',
  })
  @ApiBody({ schema: openApiSchema(recurrenceInputSchema) })
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(recurrenceInputSchema)) body: RecurrenceInputParsed,
  ): Promise<RecurrenceDto> {
    return this.recurrences.create(user.id, body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Altera a recorrência daqui para frente' })
  @ApiBody({ schema: openApiSchema(recurrenceInputSchema) })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(recurrenceInputSchema)) body: RecurrenceInputParsed,
  ): Promise<RecurrenceDto> {
    return this.recurrences.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Encerra a recorrência (apaga os previstos futuros, mantém o histórico)',
  })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.recurrences.remove(user.id, id);
  }
}
