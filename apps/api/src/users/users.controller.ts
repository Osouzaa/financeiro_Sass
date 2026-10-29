import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Put,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  alertPreferencesSchema,
  AVATAR_MAX_BYTES,
  deleteAccountSchema,
  phoneInputSchema,
  type DeleteAccountInput,
  type PhoneInputParsed,
  updateProfileSchema,
  type AlertPreferences,
  type ProfileDto,
  type UpdateProfileInputParsed,
  type UserDto,
} from '@financeiro/shared';
import type { Response } from 'express';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { openApiSchema, ZodValidationPipe } from '../common/zod/zod-validation.pipe';
import { AccountDataService } from './account-data.service';
import { UsersService } from './users.service';

@ApiTags('Perfil')
@ApiBearerAuth()
@Controller('me')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly accountData: AccountDataService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Perfil completo do usuário autenticado' })
  profile(@CurrentUser() user: AuthUser): Promise<ProfileDto> {
    return this.users.getProfile(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Atualiza nome e e-mail (trocar o e-mail exige a senha atual)' })
  @ApiBody({ schema: openApiSchema(updateProfileSchema) })
  update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInputParsed,
  ): Promise<UserDto> {
    return this.users.updateProfile(user.id, body);
  }

  @Put('phone')
  @ApiOperation({ summary: 'Cadastra ou troca o celular do WhatsApp (com o consentimento)' })
  @ApiBody({ schema: openApiSchema(phoneInputSchema) })
  setPhone(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(phoneInputSchema)) body: PhoneInputParsed,
  ): Promise<ProfileDto> {
    return this.users.setPhone(user.id, body);
  }

  @Delete('phone')
  @ApiOperation({ summary: 'Remove o celular e o consentimento do WhatsApp' })
  removePhone(@CurrentUser() user: AuthUser): Promise<ProfileDto> {
    return this.users.removePhone(user.id);
  }

  @Get('export')
  @ApiOperation({ summary: 'Baixa todos os dados da conta em JSON (portabilidade, LGPD)' })
  async exportData(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const data = await this.accountData.export(user.id);
    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="meus-dados-${data.exportedAt.slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    });
    return new StreamableFile(Buffer.from(JSON.stringify(data, null, 2), 'utf8'));
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: 'Exclui a conta e todos os dados (pede a senha e a palavra EXCLUIR)' })
  @ApiBody({ schema: openApiSchema(deleteAccountSchema) })
  deleteAccount(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(deleteAccountSchema)) body: DeleteAccountInput,
  ): Promise<void> {
    return this.accountData.delete(user.id, body.password);
  }

  @Put('alerts')
  @ApiOperation({ summary: 'Atualiza as preferências de alertas' })
  @ApiBody({ schema: openApiSchema(alertPreferencesSchema) })
  updateAlerts(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(alertPreferencesSchema)) body: AlertPreferences,
  ): Promise<ProfileDto> {
    return this.users.updateAlerts(user.id, body);
  }

  @Put('avatar')
  @ApiOperation({ summary: 'Envia a foto do perfil (JPG, PNG ou WebP, até 1 MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: AVATAR_MAX_BYTES + 1 } }))
  uploadAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<UserDto> {
    return this.users.setAvatar(user.id, file);
  }

  @Delete('avatar')
  @ApiOperation({ summary: 'Remove a foto do perfil' })
  removeAvatar(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.users.removeAvatar(user.id);
  }

  @Get('avatar')
  @ApiOperation({ summary: 'Imagem da foto do perfil' })
  async avatar(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { data, mimeType } = await this.users.getAvatar(user.id);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return new StreamableFile(Buffer.from(data), { type: mimeType });
  }
}
