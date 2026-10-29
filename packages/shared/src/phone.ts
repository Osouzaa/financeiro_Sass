/**
 * Celular brasileiro para o WhatsApp. Guardado em E.164 ("+5511999998888"),
 * aceito como o usuário digita: "(11) 99999-8888", "11999998888", "+55 11 9...".
 * Só celular (9 dígitos começando com 9) e só DDDs que existem.
 */

const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77,
  79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** DDD + número (11 dígitos), sem o 55; null se não for um celular válido. */
function nationalDigits(value: string): string | null {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) digits = digits.slice(2);
  if (digits.length !== 11) return null;
  if (!DDDS.has(Number(digits.slice(0, 2))) || digits[2] !== '9') return null;
  return digits;
}

export function isValidBrMobile(value: string): boolean {
  return nationalDigits(value) !== null;
}

/** "+5511999998888". Lança erro se o número não for válido (valide antes). */
export function toE164(value: string): string {
  const digits = nationalDigits(value);
  if (!digits) throw new Error(`Celular inválido: "${value}"`);
  return `+55${digits}`;
}

/** "(11) 99999-8888". Formata também o que ainda está sendo digitado. */
export function formatPhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.length > 11 && digits.startsWith('55')) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
