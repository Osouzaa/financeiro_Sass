export interface PasswordStrength {
  /** 0 a 4 */
  score: number;
  label: string;
}

const LABELS = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte'];

/** Estimativa simples de força da senha para orientar o usuário durante o cadastro. */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  if (password.length < 8) score = Math.min(score, 1);
  return { score, label: LABELS[score] ?? '' };
}
