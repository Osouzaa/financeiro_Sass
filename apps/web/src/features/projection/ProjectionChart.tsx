import { formatBRL, type ProjectionDto } from '@financeiro/shared';
import { useId } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { formatDayHeading, formatShortDate } from '@/lib/dates';

/** Cores do gráfico: série única na cor da marca; o trecho negativo usa o vermelho de valor. */
const LINE = '#ff682c';
const NEGATIVE = '#c8382f';
const GRID = '#e7e4de';
const AXIS = '#7a7a80';

const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

interface Point {
  date: string;
  balance: number;
  inCents: number;
  outCents: number;
}

/**
 * Saldo previsto dia a dia: uma série só (o título nomeia, sem legenda), linha de 2px,
 * área suave, linha do zero quando o saldo cruza e marcador no menor saldo.
 * O tooltip segue o cursor com o saldo e o movimento do dia.
 */
export function ProjectionChart({
  projection,
  height = 300,
}: {
  projection: ProjectionDto;
  height?: number;
}) {
  const gradientId = useId().replace(/:/g, '');
  const data: Point[] = projection.points.map((point) => ({
    date: point.date,
    balance: point.balanceCents / 100,
    inCents: point.inCents,
    outCents: point.outCents,
  }));
  const values = data.map((point) => point.balance);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  // Onde o zero cai no eixo, para a cor virar vermelha abaixo dele
  const zeroAt = max === min ? 1 : max / (max - min);
  const crossesZero = min < 0;
  const tickEvery = Math.max(1, Math.round(data.length / 7));

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`${gradientId}-stroke`} x1="0" y1="0" x2="0" y2="1">
              <stop offset={zeroAt} stopColor={LINE} />
              <stop offset={zeroAt} stopColor={NEGATIVE} />
            </linearGradient>
            <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset={0} stopColor={LINE} stopOpacity={0.22} />
              <stop offset={zeroAt} stopColor={LINE} stopOpacity={0.02} />
              <stop offset={zeroAt} stopColor={NEGATIVE} stopOpacity={0.04} />
              <stop offset={1} stopColor={NEGATIVE} stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: AXIS }}
            tickFormatter={(date: string) => formatShortDate(date)}
            interval={tickEvery - 1}
            minTickGap={12}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: AXIS }}
            tickFormatter={(value: number) => compact.format(value)}
            width={48}
          />
          {crossesZero ? (
            <ReferenceLine y={0} stroke={NEGATIVE} strokeDasharray="4 4" strokeOpacity={0.6} />
          ) : null}
          <Tooltip
            cursor={{ stroke: AXIS, strokeDasharray: '3 3' }}
            content={(props) => <ProjectionTooltip {...props} />}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke={`url(#${gradientId}-stroke)`}
            strokeWidth={2}
            fill={`url(#${gradientId}-fill)`}
            activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffffff', fill: LINE }}
            isAnimationActive={false}
          />
          <ReferenceDot
            x={projection.lowest.date}
            y={projection.lowest.balanceCents / 100}
            r={5}
            fill={projection.lowest.balanceCents < 0 ? NEGATIVE : LINE}
            stroke="#ffffff"
            strokeWidth={2}
            ifOverflow="extendDomain"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProjectionTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  const point = payload?.[0]?.payload as Point | undefined;
  if (!active || !point) return null;
  const cents = Math.round(point.balance * 100);
  return (
    <div className="rounded-[12px] border border-line bg-surface px-3.5 py-2.5 text-sm shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)]">
      <p className="text-[12px] text-slate first-letter:uppercase">
        {formatDayHeading(point.date)}
      </p>
      <p
        className={`tabular font-display text-base font-semibold ${cents < 0 ? 'text-negative' : ''}`}
      >
        {formatBRL(cents)}
      </p>
      {point.inCents || point.outCents ? (
        <p className="tabular mt-0.5 text-[12px] text-steel">
          {point.inCents ? `+${formatBRL(point.inCents)}` : ''}
          {point.inCents && point.outCents ? ' · ' : ''}
          {point.outCents ? `−${formatBRL(point.outCents)}` : ''}
        </p>
      ) : (
        <p className="text-[12px] text-faint">Sem movimento</p>
      )}
    </div>
  );
}
