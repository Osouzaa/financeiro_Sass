import { z } from 'zod';
import { isValidCpf, normalizeCpf } from '../cpf';

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

/** CPF com ou sem pontuação; sai só com os 11 dígitos. */
export const cpfSchema = z
  .string({ error: 'Informe o CPF' })
  .trim()
  .min(1, { error: 'Informe o CPF' })
  .max(14, { error: 'CPF inválido' })
  .refine(isValidCpf, { error: 'CPF inválido' })
  .transform(normalizeCpf);

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: 'O nome deve ter pelo menos 2 caracteres' })
    .max(100, { error: 'Nome muito longo' }),
  email,
  cpf: cpfSchema,
  password: passwordSchema,
  /** Aceite dos Termos de uso e da Política de privacidade (versão em TERMS_VERSION). */
  acceptTerms: z
    .boolean({ error: 'Aceite os termos para criar a conta' })
    .refine((accepted) => accepted, { error: 'Aceite os termos para criar a conta' }),
});
export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterInputParsed = z.output<typeof registerSchema>;

/** E-mail ou CPF no mesmo campo; quem decide qual é o servidor (parseLoginIdentifier). */
const identifier = z
  .string({ error: 'Informe seu e-mail ou CPF' })
  .trim()
  .min(1, { error: 'Informe seu e-mail ou CPF' })
  .max(254, { error: 'E-mail ou CPF inválido' });

export const loginSchema = z.object({
  identifier,
  password: z.string().min(1, { error: 'Informe a senha' }).max(200, { error: 'Senha inválida' }),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ identifier });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/** O token do link é base64url de 32 bytes (43 caracteres). */
export const resetPasswordSchema = z
  .object({
    token: z
      .string({ error: 'Link inválido' })
      .regex(/^[A-Za-z0-9_-]{32,128}$/, { error: 'Link inválido ou incompleto' }),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, { error: 'Confirme a nova senha' }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: 'As senhas não conferem',
    path: ['confirmPassword'],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
