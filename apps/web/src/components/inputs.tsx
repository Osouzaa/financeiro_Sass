import { useId, type ComponentProps, type ReactNode } from 'react';

/** Rótulo + mensagem de erro/ajuda para controles que não são <input> simples. */
export function Field({
  label,
  error,
  hint,
  children,
  htmlFor,
  labelAside,
}: {
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  /** Conteúdo à direita do rótulo (ex.: atalho para criar um item). */
  labelAside?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-sm font-medium text-graphite">
          {label}
        </label>
        {labelAside}
      </div>
      {children}
      {error ? (
        <p className="text-[13px] text-negative">{error}</p>
      ) : hint ? (
        <div className="text-[13px] text-slate">{hint}</div>
      ) : null}
    </div>
  );
}

const controlClass = (error?: string) =>
  `h-12 w-full rounded-[10px] border bg-surface px-4 text-[15px] text-graphite transition-[border-color,box-shadow] placeholder:text-faint focus:outline-none focus:ring-4 ${
    error
      ? 'border-negative focus:ring-negative-soft'
      : 'border-line-strong hover:border-faint focus:border-ember focus:ring-ember-soft'
  }`;

export function Select({
  error,
  className = '',
  children,
  ...props
}: ComponentProps<'select'> & { error?: string }) {
  return (
    <select
      className={`${controlClass(error)} appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%237a7a80' stroke-width='1.75' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")] bg-[position:right_14px_center] bg-no-repeat pr-10 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function NumberInput({
  error,
  className = '',
  ...props
}: ComponentProps<'input'> & { error?: string }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      className={`${controlClass(error)} tabular ${className}`}
      {...props}
    />
  );
}

const brl = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Campo de valor em reais. Digita-se só números (como no app do banco):
 * "123456" vira R$ 1.234,56. O valor é sempre um inteiro em centavos.
 * Com allowNegative, o "-" alterna o sinal. O tamanho lg destaca o valor no topo de formulários.
 */
export function CurrencyInput({
  value,
  onChange,
  allowNegative = false,
  error,
  id,
  size = 'md',
  ...props
}: Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'size'> & {
  value: number | null | undefined;
  onChange: (cents: number) => void;
  allowNegative?: boolean;
  error?: string;
  size?: 'md' | 'lg';
}) {
  const fallbackId = useId();
  const cents = value ?? 0;
  const display = `${cents < 0 ? '-' : ''}${brl.format(Math.abs(cents) / 100)}`;

  return (
    <div className="relative">
      <span
        className={`pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate ${
          size === 'lg' ? 'text-lg' : 'text-[15px]'
        }`}
      >
        R$
      </span>
      <input
        id={id ?? fallbackId}
        type="text"
        inputMode="decimal"
        value={display}
        onChange={(event) => {
          const raw = event.target.value;
          const digits = raw.replace(/\D/g, '').slice(0, 13);
          const negative = allowNegative && raw.includes('-');
          const next = Number(digits || '0');
          onChange(negative ? -next : next);
        }}
        onKeyDown={(event) => {
          if (allowNegative && event.key === '-') {
            event.preventDefault();
            onChange(-cents);
          }
        }}
        className={`${controlClass(error)} tabular text-right ${
          size === 'lg'
            ? '!h-16 pl-14 font-display !text-[30px] font-semibold tracking-[-0.02em]'
            : 'pl-11'
        }`}
        {...props}
      />
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  id,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  id?: string;
  disabled?: boolean;
}) {
  const fallbackId = useId();
  const switchId = id ?? fallbackId;
  return (
    <div className="flex items-start justify-between gap-6">
      <label htmlFor={switchId} className="cursor-pointer">
        <span className="block font-medium">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-sm text-slate">{description}</span>
        ) : null}
      </label>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? 'bg-ember' : 'bg-line-strong'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}
