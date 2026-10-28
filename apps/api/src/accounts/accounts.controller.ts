import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { accountInputSchema, type AccountDto, type AccountInputParsed } from '@financeiro/shared';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { openApiSchema, ZodValidationPipe } from '../common/zod/zod-validation.pipe';
import { AccountsService } from './accounts.service';

@ApiTags('Contas e cartões')
@ApiBearerAuth()
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as contas com saldo atual (e limite disponível nos cartões)' })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  list(
    @CurrentUser() user: AuthUser,
    @Query('includeArchived', new ParseBoolPipe({ optional: true })) includeArchived?: boolean,
  ): Promise<AccountDto[]> {
    return this.accounts.list(user.id, includeArchived ?? false);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe de uma conta' })
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<AccountDto> {
    return this.accounts.get(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra conta corrente, carteira ou cartão de crédito' })
  @ApiBody({ schema: openApiSchema(accountInputSchema) })
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(accountInputSchema)) body: AccountInputParsed,
  ): Promise<AccountDto> {
    return this.accounts.create(user.id, body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza uma conta' })
  @ApiBody({ schema: openApiSchema(accountInputSchema) })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(accountInputSchema)) body: AccountInputParsed,
  ): Promise<AccountDto> {
    return this.accounts.update(user.id, id, body);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @ApiOperation({ summary: 'Arquiva a conta (some dos seletores, continua no histórico)' })
  archive(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AccountDto> {
    return this.accounts.setArchived(user.id, id, true);
  }

  @Post(':id/unarchive')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reativa uma conta arquivada' })
  unarchive(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AccountDto> {
    return this.accounts.setArchived(user.id, id, false);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Exclui uma conta sem lançamentos' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.accounts.remove(user.id, id);
  }
}
