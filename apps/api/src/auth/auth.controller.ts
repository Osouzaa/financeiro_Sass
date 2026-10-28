import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  type AuthResponse,
  type ChangePasswordInput,
  type SessionDto,
  type LoginInput,
  type RegisterInput,
  type UserDto,
} from '@financeiro/shared';
import type { CookieOptions, Request, Response } from 'express';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { openApiSchema, ZodValidationPipe } from '../common/zod/zod-validation.pipe';
import { AppConfig } from '../config/app-config';
import { AuthService, type Session } from './auth.service';

export const REFRESH_COOKIE = 'fin_rt';
/** O cookie só é enviado para as rotas de autenticação. */
const REFRESH_COOKIE_PATH = '/api/v1/auth';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfig,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Cria a conta e já inicia a sessão' })
  @ApiBody({ schema: openApiSchema(registerSchema) })
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(res, await this.auth.register(body, req.get('user-agent')));
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Entra com e-mail e senha' })
  @ApiBody({ schema: openApiSchema(loginSchema) })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(res, await this.auth.login(body, req.get('user-agent')));
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({ summary: 'Renova o access token usando o cookie de refresh' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const token = this.readRefreshCookie(req);
    if (!token) throw new UnauthorizedException('Sessão não encontrada');
    try {
      return this.respond(res, await this.auth.refresh(token, req.get('user-agent')));
    } catch (error) {
      res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Encerra a sessão atual' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const token = this.readRefreshCookie(req);
    if (token) await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  @Post('password')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Troca a senha e encerra as sessões em outros dispositivos' })
  @ApiBody({ schema: openApiSchema(changePasswordSchema) })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(res, await this.auth.changePassword(user.id, body, req.get('user-agent')));
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dispositivos com sessão ativa' })
  sessions(@CurrentUser() user: AuthUser, @Req() req: Request): Promise<SessionDto[]> {
    return this.auth.listSessions(user.id, this.readRefreshCookie(req));
  }

  @Post('sessions/revoke-others')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Encerra as sessões de todos os outros dispositivos' })
  revokeOthers(@CurrentUser() user: AuthUser, @Req() req: Request): Promise<void> {
    return this.auth.revokeOtherSessions(user.id, this.readRefreshCookie(req));
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Encerra uma sessão específica' })
  revokeSession(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.auth.revokeSession(user.id, id);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dados do usuário autenticado' })
  me(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.auth.getUser(user.id);
  }

  private respond(res: Response, session: Session): AuthResponse {
    res.cookie(REFRESH_COOKIE, session.refreshToken, {
      ...this.cookieOptions(),
      expires: session.refreshExpiresAt,
    });
    return { accessToken: session.accessToken, expiresIn: session.expiresIn, user: session.user };
  }

  private readRefreshCookie(req: Request): string | undefined {
    const value: unknown = req.cookies?.[REFRESH_COOKIE];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private cookieOptions(): CookieOptions {
    const { cookieSecure, cookieSameSite } = this.config.refreshToken;
    return {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      path: REFRESH_COOKIE_PATH,
    };
  }
}
