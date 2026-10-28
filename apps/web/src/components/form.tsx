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
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-medium text-graphite">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`h-12 border bg-canvas px-4 text-[15px] text-graphite transition-colors placeholder:text-slate focus:border-graphite focus:outline-none focus-visible:outline-none focus:ring-1 focus:ring-graphite ${
          error ? 'border-ember' : 'border-slate/60 hover:border-slate'
        } ${className}`}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-[13px] text-ember-deep">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-[13px] text-slate">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost';
  loading?: boolean;
}

/** Botões retos (raio 0): contraste deliberado com os cards e a navegação arredondada. */
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
      ? 'bg-graphite text-canvas hover:bg-steel'
      : 'border border-graphite text-graphite hover:bg-ash';
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex h-12 items-center justify-center gap-2 px-5 font-display text-base leading-none tracking-[-0.02em] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
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
      className="border-l-2 border-ember bg-ember-wash px-4 py-3 text-sm text-ember-deep"
    >
      {message}
    </p>
  );
}
