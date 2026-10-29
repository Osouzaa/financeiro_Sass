import { parseIsoDate, parseYearMonth, type IsoDate, type YearMonth } from '@financeiro/shared';

// Datas de calendário são formatadas em UTC para o dia nunca "voltar" por causa do fuso
const utc = (iso: IsoDate) => {
  const { year, month, day } = parseIsoDate(iso);
  return new Date(Date.UTC(year, month - 1, day));
};

const dayHeading = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const monthTitle = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const monthShort = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });

/** "quarta-feira, 28 de outubro" */
export const formatDayHeading = (iso: IsoDate) => dayHeading.format(utc(iso));

/** "outubro de 2026" */
export const formatMonthTitle = (value: YearMonth) => {
  const { year, month } = parseYearMonth(value);
  return monthTitle.format(new Date(Date.UTC(year, month - 1, 1)));
};

/** "dez" (mês de referência de fatura) */
export const formatMonthShort = (value: YearMonth) => {
  const { year, month } = parseYearMonth(value);
  return monthShort.format(new Date(Date.UTC(year, month - 1, 1))).replace('.', '');
};

/** "28/10" */
export const formatShortDate = (iso: IsoDate) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const weekdays = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const monthNames = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });

/** "Todo dia 5", "Toda segunda", "Todo 10 de mar" (a partir da data de início). */
export function describeFrequency(
  frequency: 'WEEKLY' | 'MONTHLY' | 'YEARLY',
  startDate: IsoDate,
): string {
  const { year, month, day } = parseIsoDate(startDate);
  if (frequency === 'MONTHLY') return `Todo dia ${day}`;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (frequency === 'WEEKLY') {
    const weekday = date.getUTCDay();
    return `${weekday === 0 || weekday === 6 ? 'Todo' : 'Toda'} ${weekdays[weekday]}`;
  }
  return `Todo ${day} de ${monthNames.format(date).replace('.', '')}`;
}
