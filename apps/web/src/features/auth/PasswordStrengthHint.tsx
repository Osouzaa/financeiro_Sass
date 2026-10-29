import { passwordStrength } from './password-strength';

const STRENGTH_COLORS = ['bg-negative', 'bg-negative', 'bg-ember', 'bg-positive', 'bg-positive'];

/** Barra de força da senha (ou a dica de como montar uma boa), embaixo do campo. */
export function PasswordStrengthHint({ password }: { password: string }) {
  if (!password) {
    return <>Use letras e números. Maiúsculas e símbolos deixam a senha mais forte.</>;
  }
  const strength = passwordStrength(password);
  return (
    <div className="flex items-center gap-3">
      <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={`h-1 rounded-full transition-colors ${
              strength.score >= step ? STRENGTH_COLORS[strength.score] : 'bg-line'
            }`}
          />
        ))}
      </div>
      <span className="w-20 text-right" aria-live="polite">
        {strength.label}
      </span>
    </div>
  );
}
