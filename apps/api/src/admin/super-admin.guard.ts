import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole, UserStatus } from '@financeiro/shared';
import type { AuthenticatedRequest } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Só super administrador ativo. O papel é lido do banco a cada requisição, e não
 * do token: rebaixar ou suspender alguém vale na hora, sem esperar o token expirar.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user
      ? await this.prisma.user.findUnique({
          where: { id: request.user.id },
          select: { role: true, status: true },
        })
      : null;
    if (user?.role !== UserRole.SUPER_ADMIN || user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Acesso restrito ao administrador');
    }
    return true;
  }
}
