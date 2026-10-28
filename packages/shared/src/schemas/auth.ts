import { z } from 'zod';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Informe um e-mail válido' }));

export const passwordSchema = z
  .string()
  .min(8, { error: 'A senha deve ter pelo menos 8 caracteres' })
  .max(72, { error: 'A senha deve ter no máximo 72 caracteres' })
  .regex(/[A-Za-z]/, { error: 'A senha deve conter pelo menos uma letra' })
  .regex(/\d/, { error: 'A senha deve conter pelo menos um número' });

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: 'O nome deve ter pelo menos 2 caracteres' })
    .max(100, { error: 'Nome muito longo' }),
  email,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: 'Informe a senha' }),
});
export type LoginInput = z.infer<typeof loginSchema>;
