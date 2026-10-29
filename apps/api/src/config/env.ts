import { z } from 'zod';

const EXAMPLE_SECRET = 'troque-este-segredo-por-um-valor-aleatorio-longo';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    DATABASE_URL: z
      .string({ error: 'DATABASE_URL é obrigatória' })
      .startsWith('sqlserver://', { error: 'DATABASE_URL deve começar com sqlserver://' }),
    JWT_ACCESS_SECRET: z
      .string({ error: 'JWT_ACCESS_SECRET é obrigatório' })
      .min(32, { error: 'JWT_ACCESS_SECRET deve ter pelo menos 32 caracteres' }),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    COOKIE_SECURE: z.stringbool().default(false),
    COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    /** Endereço do front, usado nos links enviados por e-mail. */
    APP_URL: z
      .url({ error: 'APP_URL deve ser uma URL (ex.: https://app.exemplo.com)' })
      .default('http://localhost:5173'),
    /** Sem SMTP_HOST, em desenvolvimento os e-mails aparecem no terminal da API. */
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: z.stringbool().default(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().default('Financeiro <nao-responda@localhost>'),
    /** Limite de tentativas por IP em login, cadastro e recuperação de senha. */
    RATE_LIMIT_ENABLED: z.stringbool().default(true),
    /** E-mails promovidos a super administrador ao subir a API ou ao se cadastrar. */
    SUPER_ADMIN_EMAILS: z.string().default(''),
    /** true atrás de proxy reverso (nginx, load balancer), para ler o IP real do cliente. */
    TRUST_PROXY: z.stringbool().default(false),
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.JWT_ACCESS_SECRET !== EXAMPLE_SECRET, {
    error: 'Defina um JWT_ACCESS_SECRET próprio em produção',
    path: ['JWT_ACCESS_SECRET'],
  })
  .refine((env) => env.NODE_ENV !== 'production' || Boolean(env.SMTP_HOST), {
    error: 'Configure SMTP_HOST em produção: sem ele, ninguém recupera a senha',
    path: ['SMTP_HOST'],
  });

export type Env = z.infer<typeof envSchema>;

/** Valida as variáveis de ambiente e falha cedo, com mensagens claras. */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variáveis de ambiente inválidas (confira apps/api/.env):\n${issues}`);
  }
  return result.data;
}
