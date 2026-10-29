import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiErrorBody } from '@financeiro/shared';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client';

/** Padroniza todas as respostas de erro no formato `ApiErrorBody`. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);

    if (body.statusCode >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ApiErrorBody {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();
      const data =
        typeof payload === 'string' ? { message: payload } : (payload as Record<string, unknown>);
      const message = Array.isArray(data.message)
        ? data.message.join('; ')
        : String(data.message ?? exception.message);
      return {
        statusCode,
        error: HttpStatus[statusCode] ?? 'Error',
        message,
        ...(data.fields ? { fields: data.fields as Record<string, string[]> } : {}),
        ...(typeof data.code === 'string' ? { code: data.code } : {}),
        ...(data.meta ? { meta: data.meta as Record<string, string> } : {}),
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return { statusCode: 409, error: 'CONFLICT', message: 'Registro duplicado' };
      }
      if (exception.code === 'P2025') {
        return { statusCode: 404, error: 'NOT_FOUND', message: 'Registro não encontrado' };
      }
    }

    return {
      statusCode: 500,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Erro interno. Tente novamente em instantes.',
    };
  }
}
