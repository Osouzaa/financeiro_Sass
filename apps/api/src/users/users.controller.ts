import {
  Body,
  Controller,
  Delete,
  Get,
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
  updateProfileSchema,
  type AlertPreferences,
  type ProfileDto,
  type UpdateProfileInput,
  type UserDto,
} from '@financeiro/shared';
import type { Response } from 'express';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { openApiSchema, ZodValidationPipe } from '../common/zod/zod-validation.pipe';
import { UsersService } from './users.service';

@ApiTags('Perfil')
@ApiBearerAuth()
@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

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
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ): Promise<UserDto> {
    return this.users.updateProfile(user.id, body);
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
