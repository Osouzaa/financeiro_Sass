import {
  MAX_INSTALLMENTS,
  formatBRL,
  invoiceAfter,
  invoiceForPurchase,
  isValidIsoDate,
  splitInstallments,
  type CardCycle,
  type RecurrenceFrequency,
  type TransactionDto,
} from '@financeiro/shared';
import { CalendarSync, Layers, Repeat } from 'lucide-react';
import { useId } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { TextField } from '@/components/form';
import { Field, NumberInput } from '@/components/inputs';
import { describeFrequency, formatMonthTitle, formatShortDate } from '@/lib/dates';

export type RepeatMode = 'once' | 'installments' | 'recurring';
export type Scope = 'this' | 'future';

const MODES: { value: RepeatMode; label: string }[] = [
  { value: 'once', label: 'Única' },
  { value: 'installments', label: 'Parcelada' },
  { value: 'recurring', label: 'Recorrente' },
];

/** Única, parcelada (só despesa) ou recorrente. Só no cadastro. */
export function RepeatPicker({
  value,
  onChange,
  allowInstallments,
}: {
  value: RepeatMode;
  onChange: (mode: RepeatMode) => void;
  allowInstallments: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Repetição"
      className="flex gap-1 rounded-[12px] border border-line p-1"
    >
      {MODES.map((mode) => {
        const disabled = mode.value === 'installments' && !allowInstallments;
        const selected = value === mode.value;
        return (
          <button
            key={mode.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            title={disabled ? 'Só despesas podem ser parceladas' : undefined}
            onClick={() => onChange(mode.value)}
            className={`h-9 flex-1 rounded-[9px] text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              selected ? 'bg-graphite text-white' : 'text-slate hover:bg-sunken hover:text-graphite'
            }`}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}

const monthName = (referenceMonth: string) => formatMonthTitle(referenceMonth).split(' ')[0];

export function InstallmentsPanel({
  totalCents,
  count,
  date,
  cycle,
  error,
  registration,
}: {
  totalCents: number;
  count: number;
  date: string;
  /** Ciclo do cartão; sem ele, as parcelas são mensais na conta. */
  cycle: CardCycle | null;
  error?: string;
  registration: UseFormRegisterReturn;
}) {
  const valid =
    Number.isInteger(count) && count >= 2 && count <= MAX_INSTALLMENTS && totalCents > 0;
  const parts = valid ? splitInstallments(totalCents, count) : [];
  const first = cycle && isValidIsoDate(date) ? invoiceForPurchase(date, cycle) : null;
  const last = first && valid ? invoiceAfter(first, count - 1, cycle!) : null;

  return (
    <div className="grid items-start gap-4 rounded-[14px] border border-line bg-canvas p-4 sm:grid-cols-[120px_minmax(0,1fr)]">
      <Field label="Parcelas" error={error}>
        <NumberInput min={2} max={MAX_INSTALLMENTS} error={error} {...registration} />
      </Field>
      <div className="flex items-start gap-3 text-sm sm:pt-7">
        <Layers size={18} className="mt-0.5 shrink-0 text-ember-deep" aria-hidden="true" />
        {valid ? (
          <p className="text-steel">
            <strong className="tabular text-graphite">
              {count}x de {formatBRL(parts[1]!)}
            </strong>
            {parts[0] !== parts[1] ? (
              <span className="tabular"> (a primeira de {formatBRL(parts[0]!)})</span>
            ) : null}
            .{' '}
            {first && last ? (
              <>
                A 1ª entra na fatura de {monthName(first.referenceMonth)} e a última na de{' '}
                {monthName(last.referenceMonth)}.
              </>
            ) : (
              'Uma por mês, no mesmo dia, como lançamentos previstos.'
            )}
          </p>
        ) : (
          <p className="text-slate">De 2 a {MAX_INSTALLMENTS} parcelas sobre o valor total.</p>
        )}
      </div>
    </div>
  );
}

const FREQUENCIES: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'MONTHLY', label: 'Mensal' },
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'YEARLY', label: 'Anual' },
];

export function RecurringPanel({
  frequency,
  onFrequency,
  endDate,
  onEndDate,
  startDate,
  endError,
}: {
  frequency: RecurrenceFrequency;
  onFrequency: (frequency: RecurrenceFrequency) => void;
  endDate: string;
  onEndDate: (date: string) => void;
  startDate: string;
  endError?: string;
}) {
  return (
    <div className="space-y-4 rounded-[14px] border border-line bg-canvas p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Frequência</legend>
          <div className="flex h-12 gap-1 rounded-[10px] border border-line-strong bg-surface p-1">
            {FREQUENCIES.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={frequency === option.value}
                onClick={() => onFrequency(option.value)}
                className={`flex-1 rounded-[7px] text-sm transition-colors ${
                  frequency === option.value
                    ? 'bg-ember-soft font-medium text-ember-deep'
                    : 'text-slate hover:text-graphite'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
        <TextField
          label="Termina em (opcional)"
          type="date"
          value={endDate}
          min={startDate}
          error={endError}
          onChange={(event) => onEndDate(event.target.value)}
        />
      </div>
      <p className="flex items-start gap-3 text-sm text-steel">
        <Repeat size={18} className="mt-0.5 shrink-0 text-ember-deep" aria-hidden="true" />
        <span>
          {isValidIsoDate(startDate) ? (
            <>
              <strong className="text-graphite">{describeFrequency(frequency, startDate)}</strong>,
              a partir de {formatShortDate(startDate)}
              {endDate ? ` até ${formatShortDate(endDate)}` : ', sem data para acabar'}.{' '}
            </>
          ) : null}
          Os lançamentos nascem previstos e entram na projeção; marque como realizado quando
          acontecer.
        </span>
      </p>
    </div>
  );
}

/** Na edição de parcela ou ocorrência: aplicar só a esta ou a esta e às próximas. */
export function ScopePicker({
  transaction,
  value,
  onChange,
}: {
  transaction: TransactionDto;
  value: Scope;
  onChange: (scope: Scope) => void;
}) {
  const name = useId();
  const installment = transaction.installment;
  const options: { value: Scope; label: string; hint: string }[] = [
    {
      value: 'this',
      label: installment ? 'Só esta parcela' : 'Só esta ocorrência',
      hint: installment
        ? 'As outras parcelas continuam como estão.'
        : 'Fica editada à mão; a recorrência não a sobrescreve.',
    },
    {
      value: 'future',
      label: installment
        ? `Esta e as próximas (${installment.number} a ${installment.total})`
        : 'Esta e as próximas',
      hint: installment
        ? 'Descrição, categoria, observação e valor da parcela.'
        : 'A recorrência muda a partir desta data; as anteriores ficam como estão.',
    },
  ];

  return (
    <fieldset className="rounded-[14px] border border-line bg-canvas p-4">
      <legend className="flex items-center gap-2 px-1 text-sm font-medium">
        <CalendarSync size={16} className="text-ember-deep" aria-hidden="true" />
        {installment
          ? `Parcela ${installment.number} de ${installment.total}`
          : 'Lançamento recorrente'}
      </legend>
      <div className="mt-1 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer gap-3 rounded-[10px] border p-3 transition-colors ${
              value === option.value
                ? 'border-ember bg-surface ring-1 ring-ember'
                : 'border-line-strong bg-surface hover:bg-sunken'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="mt-0.5 accent-[var(--color-ember)]"
            />
            <span>
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="mt-0.5 block text-[12px] text-slate">{option.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
