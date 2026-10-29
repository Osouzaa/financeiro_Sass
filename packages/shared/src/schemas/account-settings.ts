import { z } from 'zod';
import { isValidBrMobile, toE164 } from '../phone';

/** Versão dos termos e da política aceitos no cadastro. Mude ao publicar uma nova. */
export const TERMS_VERSION = '2026-10-28';

/**
 * Celular para o assistente no WhatsApp, cadastrado depois do cadastro e só se a
 * pessoa quiser. O consentimento é explícito (LGPD e regras do WhatsApp Business):
 * sem ele o número fica guardado, mas nenhuma mensagem é enviada.
 */
export const phoneInputSchema = z.object({
  phone: z
    .string({ error: 'Informe o celular' })
    .trim()
    .max(20, { error: 'Celular inválido' })
    .refine(isValidBrMobile, { error: 'Informe um celular com DDD, ex.: (11) 99999-8888' })
    .transform(toE164),
  whatsappOptIn: z.boolean({ error: 'Informe se aceita receber mensagens' }),
});
export type PhoneInput = z.input<typeof phoneInputSchema>;
export type PhoneInputParsed = z.output<typeof phoneInputSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/, { error: 'Link inválido ou incompleto' }),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

/** Excluir a conta pede a senha e a palavra EXCLUIR: não dá para fazer por engano. */
export const deleteAccountSchema = z.object({
  password: z.string().min(1, { error: 'Informe sua senha' }).max(200),
  confirmation: z.literal('EXCLUIR', { error: 'Digite EXCLUIR para confirmar' }),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
