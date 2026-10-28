import { BadRequestException, PipeTransform } from '@nestjs/common';
import { z } from 'zod';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SchemaObject = Record<string, any>;

/**
 * Valida o corpo/parâmetros com um schema Zod de @financeiro/shared.
 * O mesmo schema valida o formulário no front, então as regras nunca divergem.
 *
 * Uso: `@Body(new ZodValidationPipe(registerSchema)) body: RegisterInput`
 */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    throw new BadRequestException({
      message: 'Dados inválidos',
      fields: toFieldErrors(result.error),
    });
  }
}

export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_root';
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

/** Converte um schema Zod em schema OpenAPI para o Swagger (`@ApiBody({ schema: ... })`). */
export function openApiSchema(schema: z.ZodType): SchemaObject {
  const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema, { io: 'input' });
  return jsonSchema as SchemaObject;
}
