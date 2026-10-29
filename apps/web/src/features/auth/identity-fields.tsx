import { formatCpf } from '@financeiro/shared';
import { IdCard, Mail } from 'lucide-react';
import type { ComponentProps } from 'react';
import { TextField } from '@/components/form';

type FieldProps = Omit<ComponentProps<typeof TextField>, 'value' | 'onChange' | 'label'> & {
  value: string | undefined;
  onChange: (value: string) => void;
  label?: string;
};

/** CPF com máscara enquanto digita (000.000.000-00). O valor guardado é o formatado. */
export function CpfField({ value, onChange, label = 'CPF', ...props }: FieldProps) {
  return (
    <TextField
      label={label}
      icon={IdCard}
      inputMode="numeric"
      autoComplete="off"
      placeholder="000.000.000-00"
      maxLength={14}
      value={value ?? ''}
      onChange={(event) => onChange(formatCpf(event.target.value))}
      {...props}
    />
  );
}

/** Só dígitos e pontuação de CPF: ainda não começou a digitar um e-mail. */
const looksLikeCpf = (value: string) => /^[\d.\-\s]+$/.test(value);

/**
 * Um campo só para e-mail ou CPF. Se o que foi digitado é só número, formata
 * como CPF e troca o ícone; com uma letra ou "@", vira e-mail.
 */
export function IdentifierField({
  value,
  onChange,
  label = 'E-mail ou CPF',
  ...props
}: FieldProps) {
  const text = value ?? '';
  const cpf = text.length > 0 && looksLikeCpf(text);
  return (
    <TextField
      label={label}
      icon={cpf ? IdCard : Mail}
      autoComplete="username"
      placeholder="voce@exemplo.com ou 000.000.000-00"
      maxLength={254}
      value={text}
      onChange={(event) => {
        const next = event.target.value;
        onChange(looksLikeCpf(next) ? formatCpf(next) : next);
      }}
      {...props}
    />
  );
}
