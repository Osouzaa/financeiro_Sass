/**
 * CPF: guardado e comparado só com os 11 dígitos; exibido com máscara.
 * A validação confere os dois dígitos verificadores e recusa sequências
 * repetidas (111.111.111-11), que passam na conta mas não existem.
 */

/** Só os dígitos: "123.456.789-09" -> "12345678909". */
export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, '');
}

function checkDigit(digits: string, length: number): number {
  let sum = 0;
  for (let index = 0; index < length; index++) {
    sum += Number(digits[index]) * (length + 1 - index);
  }
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

export function isValidCpf(value: string): boolean {
  const digits = normalizeCpf(value);
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  return (
    checkDigit(digits, 9) === Number(digits[9]) && checkDigit(digits, 10) === Number(digits[10])
  );
}

/** "12345678909" -> "123.456.789-09". Formata também o que ainda está sendo digitado. */
export function formatCpf(value: string): string {
  const digits = normalizeCpf(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

/** Versão para exibir sem expor o documento inteiro: "***.456.789-**". */
export function maskCpf(value: string): string {
  const digits = normalizeCpf(value);
  if (digits.length !== 11) return '***.***.***-**';
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

/**
 * Login aceita e-mail ou CPF no mesmo campo. Com "@" é e-mail; senão, se tiver
 * 11 dígitos válidos (com ou sem pontuação), é CPF. Qualquer outra coisa: null.
 */
export function parseLoginIdentifier(value: string): { email: string } | { cpf: string } | null {
  const text = value.trim();
  if (text.includes('@')) return { email: text.toLowerCase() };
  if (/^[\d.\-\s]+$/.test(text) && isValidCpf(text)) return { cpf: normalizeCpf(text) };
  return null;
}
