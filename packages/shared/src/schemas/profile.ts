import { z } from 'zod';
import { cpfSchema, passwordSchema } from './auth';

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: 'O nome deve ter pelo menos 2 caracteres' })
    .max(100, { error: 'Nome muito longo' }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Informe um e-mail válido' })),
  /** Opcional para contas antigas, criadas antes do CPF ser pedido no cadastro. */
  cpf: z.union([cpfSchema, z.literal('').transform(() => undefined)]).optional(),
  /** Obrigatória quando o e-mail ou o CPF muda: os dois servem para entrar. */
  currentPassword: z.string().optional(),
});
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
export type UpdateProfileInputParsed = z.output<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: 'Informe a senha atual' }),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, { error: 'Confirme a nova senha' }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: 'As senhas não conferem',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    error: 'A nova senha deve ser diferente da atual',
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const alertPreferencesSchema = z.object({
  dueSoon: z.boolean(),
  dueDays: z.int().min(1, { error: 'Mínimo de 1 dia' }).max(15, { error: 'Máximo de 15 dias' }),
  budget: z.boolean(),
  budgetPercent: z.int().min(50, { error: 'Mínimo de 50%' }).max(100, { error: 'Máximo de 100%' }),
  negativeBalance: z.boolean(),
});
export type AlertPreferences = z.infer<typeof alertPreferencesSchema>;

/** Tipos de imagem aceitos para a foto do perfil. */
export const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const AVATAR_MAX_BYTES = 1_000_000;
