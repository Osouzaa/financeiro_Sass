import {
  addDays,
  type IsoDate,
  type ProjectionDto,
  type ProjectionEventDto,
} from '@financeiro/shared';

/**
 * Saldo dia a dia de `from` a `to`, partindo do saldo atual e aplicando os
 * movimentos previstos. O que estava previsto para antes de hoje e não foi
 * realizado entra como hoje (ainda vai acontecer) e fica marcado como atrasado.
 */
export function buildProjection(
  startBalanceCents: number,
  from: IsoDate,
  to: IsoDate,
  events: Omit<ProjectionEventDto, 'overdue'>[],
): ProjectionDto {
  const normalized: ProjectionEventDto[] = events
    .map((event) =>
      event.date < from ? { ...event, date: from, overdue: true } : { ...event, overdue: false },
    )
    .filter((event) => event.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || b.amountCents - a.amountCents);

  const byDate = new Map<IsoDate, { inCents: number; outCents: number }>();
  for (const event of normalized) {
    const day = byDate.get(event.date) ?? { inCents: 0, outCents: 0 };
    if (event.amountCents >= 0) day.inCents += event.amountCents;
    else day.outCents += -event.amountCents;
    byDate.set(event.date, day);
  }

  const points: ProjectionDto['points'] = [];
  let balance = startBalanceCents;
  let lowest = { date: from, balanceCents: Number.POSITIVE_INFINITY };
  let firstNegativeDate: IsoDate | null = null;

  for (let date = from; date <= to; date = addDays(date, 1)) {
    const day = byDate.get(date) ?? { inCents: 0, outCents: 0 };
    balance += day.inCents - day.outCents;
    points.push({ date, balanceCents: balance, ...day });
    if (balance < lowest.balanceCents) lowest = { date, balanceCents: balance };
    if (balance < 0 && firstNegativeDate === null) firstNegativeDate = date;
  }

  return {
    from,
    to,
    startBalanceCents,
    endBalanceCents: balance,
    points,
    lowest,
    firstNegativeDate,
    events: normalized,
  };
}
