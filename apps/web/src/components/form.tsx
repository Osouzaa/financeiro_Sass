import { useId, type ButtonHTMLAttributes, type ComponentProps } from 'react';

interface TextFieldProps extends ComponentProps<'input'> {
  label: string;
  error?: string;
  hint?: string;
}

// No React 19, `ref` é uma prop comum: o `register` do react-hook-form funciona direto.
export function TextField({
  label,
  error,
  hint,
  id,
  className = '',
  ref,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`h-11 rounded-md border bg-surface px-3 text-[15px] text-ink placeholder:text-ink-faint transition-colors focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent-soft ${
          error ? 'border-expense' : 'border-line-strong'
        } ${className}`}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-expense">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'quiet';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  loading,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const styles =
    variant === 'primary'
      ? 'bg-ink text-white hover:bg-accent-strong'
      : 'text-ink-soft hover:bg-line/60 hover:text-ink';
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function FormAlert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-expense/30 bg-expense-soft px-3 py-2.5 text-sm text-expense"
    >
      {message}
    </p>
  );
}
