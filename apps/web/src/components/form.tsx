import { Eye, EyeOff, LoaderCircle, type LucideIcon } from 'lucide-react';
import {
  useId,
  useState,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type ReactNode,
} from 'react';

interface TextFieldProps extends ComponentProps<'input'> {
  label: string;
  error?: string;
  hint?: ReactNode;
  icon?: LucideIcon;
  /** Conteúdo à direita do campo (ex.: botão de mostrar senha). */
  trailing?: ReactNode;
  /** Conteúdo à direita do rótulo (ex.: link). */
  labelAside?: ReactNode;
}

// No React 19, `ref` é uma prop comum: o `register` do react-hook-form funciona direto.
export function TextField({
  label,
  error,
  hint,
  icon: Icon,
  trailing,
  labelAside,
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
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-medium text-graphite">
          {label}
        </label>
        {labelAside}
      </div>
      <div
        className={`group relative flex h-12 items-center rounded-[10px] border bg-surface transition-[border-color,box-shadow] focus-within:ring-4 ${
          error
            ? 'border-negative focus-within:ring-negative-soft'
            : 'border-line-strong hover:border-faint focus-within:border-ember focus-within:ring-ember-soft'
        }`}
      >
        {Icon ? (
          <Icon
            size={18}
            strokeWidth={1.75}
            className={`pointer-events-none absolute left-3.5 transition-colors ${
              error ? 'text-negative' : 'text-faint group-focus-within:text-ember'
            }`}
            aria-hidden="true"
          />
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`h-full w-full rounded-[10px] bg-transparent text-[15px] text-graphite placeholder:text-faint focus:outline-none focus-visible:outline-none ${
            Icon ? 'pl-11' : 'pl-4'
          } ${trailing ? 'pr-12' : 'pr-4'} ${className}`}
          {...props}
        />
        {trailing ? <div className="absolute right-1.5">{trailing}</div> : null}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-[13px] text-negative">
          {error}
        </p>
      ) : hint ? (
        <div id={`${inputId}-hint`} className="text-[13px] text-slate">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/** Campo de senha com botão para mostrar/ocultar. */
export function PasswordField(props: Omit<TextFieldProps, 'type' | 'trailing'>) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="grid size-9 place-items-center rounded-[8px] text-faint transition-colors hover:bg-sunken hover:text-graphite"
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
        </button>
      }
    />
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'lg';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const styles = {
    primary: 'bg-graphite text-white hover:bg-black shadow-[0_1px_0_rgb(255_255_255/0.12)_inset]',
    secondary: 'border border-line-strong bg-surface text-graphite hover:bg-sunken',
    ghost: 'text-steel hover:bg-sunken hover:text-graphite',
  }[variant];
  const sizes = size === 'lg' ? 'h-12 px-5 text-[15px]' : 'h-10 px-4 text-sm';
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${sizes} ${styles} ${className}`}
      {...props}
    >
      {loading ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function FormAlert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-[10px] border border-negative/25 bg-negative-soft px-4 py-3 text-sm text-negative"
    >
      {message}
    </p>
  );
}
