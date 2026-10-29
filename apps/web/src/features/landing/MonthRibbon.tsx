import { formatBRL } from '@financeiro/shared';

/*
 * O mês inteiro numa régua: o saldo atravessa os 30 dias e os eventos ficam
 * marcados no dia em que acontecem. É o que o produto faz, com dados de exemplo;
 * a curva é calculada a partir desses eventos, não desenhada à mão.
 */

const DAYS = 30;
const START = 118_000;
/** Gasto miúdo de todo dia (padaria, transporte, app). */
const DAILY = -4_200;

interface MonthEvent {
  day: number;
  label: string;
  cents: number;
  /** Linha da trilha de saídas, para rótulos próximos não se sobreporem. */
  row?: 0 | 1;
}

const EVENTS: MonthEvent[] = [
  { day: 3, label: 'Escola', cents: -78_000, row: 0 },
  { day: 5, label: 'Salário', cents: 620_000 },
  { day: 5, label: 'Aluguel', cents: -185_000, row: 1 },
  { day: 10, label: 'Fatura do cartão', cents: -231_247, row: 0 },
  { day: 15, label: 'Internet', cents: -11_990, row: 1 },
  { day: 18, label: 'Mercado', cents: -64_000, row: 0 },
  { day: 25, label: 'Freela', cents: 90_000 },
];

const balances = (() => {
  let balance = START;
  return Array.from({ length: DAYS }, (_, index) => {
    const day = index + 1;
    balance += DAILY + EVENTS.filter((e) => e.day === day).reduce((sum, e) => sum + e.cents, 0);
    return { day, balance };
  });
})();

const max = Math.max(START, ...balances.map((p) => p.balance));
const min = Math.min(...balances.map((p) => p.balance));
const lowest = balances.reduce((low, point) => (point.balance < low.balance ? point : low));
const end = balances.at(-1)!.balance;

/** Posições em % da área do gráfico. */
const xOf = (day: number) => 2 + (96 * (day - 1)) / (DAYS - 1);
const yOf = (cents: number) => 8 + (84 * (max - cents)) / (max - min);

const line = balances
  .map(
    (point, index) => `${index === 0 ? 'M' : 'L'} ${xOf(point.day) * 10} ${yOf(point.balance) * 2}`,
  )
  .join(' ');
const area = `${line} L ${xOf(DAYS) * 10} 200 L ${xOf(1) * 10} 200 Z`;

const signed = (cents: number) => `${cents > 0 ? '+' : '−'}${formatBRL(Math.abs(cents))}`;

/** Rótulo preso ao dia, sem escapar das bordas. */
function anchor(day: number) {
  if (day <= 3) return { left: `${xOf(day)}%`, transform: 'translateX(-8px)' };
  if (day >= DAYS - 2) return { left: `${xOf(day)}%`, transform: 'translateX(calc(-100% + 8px))' };
  return { left: `${xOf(day)}%`, transform: 'translateX(-50%)' };
}

export function MonthRibbon() {
  const incomes = EVENTS.filter((e) => e.cents > 0);
  const expenses = EVENTS.filter((e) => e.cents < 0);

  return (
    <figure className="rounded-[20px] border border-line bg-surface">
      <figcaption className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4 border-b border-line px-5 py-5 sm:px-8">
        <div>
          <p className="text-sm text-slate">Exemplo de projeção</p>
          <p className="font-display text-[20px] font-semibold tracking-[-0.01em]">Novembro</p>
        </div>
        <dl className="flex flex-wrap gap-x-10 gap-y-3">
          <div>
            <dt className="text-sm text-slate">Começa com</dt>
            <dd className="tabular font-display text-[20px] font-semibold">{formatBRL(START)}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate">Menor saldo, dia {lowest.day}</dt>
            <dd className="tabular font-display text-[20px] font-semibold text-ember-deep">
              {formatBRL(lowest.balance)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-slate">Termina com</dt>
            <dd className="tabular font-display text-[20px] font-semibold">{formatBRL(end)}</dd>
          </div>
        </dl>
      </figcaption>

      {/* Rola na horizontal no celular, para o texto não encolher */}
      <div className="overflow-x-auto">
        <div className="min-w-[720px] px-5 pt-6 pb-6 sm:px-8">
          {/* Entradas */}
          <div className="relative h-12" aria-hidden="true">
            {incomes.map((event) => (
              <div
                key={`${event.day}-${event.label}`}
                className="absolute top-0"
                style={anchor(event.day)}
              >
                <p className="text-[13px] whitespace-nowrap text-steel">{event.label}</p>
                <p className="tabular text-[13px] font-semibold whitespace-nowrap text-positive">
                  {signed(event.cents)}
                </p>
              </div>
            ))}
          </div>

          {/* Curva */}
          <div className="relative h-[200px]">
            <svg
              viewBox="0 0 1000 200"
              preserveAspectRatio="none"
              className="absolute inset-0 size-full"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="ribbon-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff682c" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#ff682c" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((share) => (
                <line
                  key={share}
                  x1="0"
                  x2="1000"
                  y1={share * 200}
                  y2={share * 200}
                  stroke="#efece6"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {EVENTS.map((event) => (
                <line
                  key={`guide-${event.day}-${event.label}`}
                  x1={xOf(event.day) * 10}
                  x2={xOf(event.day) * 10}
                  y1="0"
                  y2="200"
                  stroke={event.cents > 0 ? '#bfe3cf' : '#ead9d4'}
                  strokeDasharray="3 4"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <path d={area} fill="url(#ribbon-fill)" />
              {/* Sem vector-effect aqui: com ele, a animação pelo pathLength vira tracejado */}
              <path
                d={line}
                pathLength={1}
                className="ribbon-line"
                fill="none"
                stroke="#ff682c"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            </svg>
            {/* Marcadores em HTML: círculos de verdade, sem achatar com o gráfico */}
            {EVENTS.map((event) => {
              const point = balances[event.day - 1]!;
              return (
                <span
                  key={`dot-${event.day}-${event.label}`}
                  className={`absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface ${
                    event.cents > 0 ? 'bg-positive' : 'bg-graphite'
                  }`}
                  style={{ left: `${xOf(event.day)}%`, top: `${yOf(point.balance)}%` }}
                  aria-hidden="true"
                />
              );
            })}
            <span
              className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-surface bg-ember shadow-[0_0_0_1px_#ff682c]"
              style={{ left: `${xOf(lowest.day)}%`, top: `${yOf(lowest.balance)}%` }}
              aria-hidden="true"
            />
            <p
              className="tabular absolute -translate-y-[calc(100%+12px)] rounded-[8px] bg-graphite px-2.5 py-1.5 text-[12px] font-medium whitespace-nowrap text-white"
              style={{ ...anchor(lowest.day), top: `${yOf(lowest.balance)}%` }}
              aria-hidden="true"
            >
              Menor saldo do mês
            </p>
          </div>

          {/* Eixo dos dias */}
          <div className="relative mt-3 h-5 border-t border-line" aria-hidden="true">
            {[1, 5, 10, 15, 20, 25, 30].map((day) => (
              <span
                key={day}
                className="tabular absolute top-1.5 -translate-x-1/2 text-[12px] text-faint"
                style={{ left: `${xOf(day)}%` }}
              >
                {day}
              </span>
            ))}
          </div>

          {/* Saídas, em duas linhas para não encostar */}
          <div className="relative mt-3 h-[92px]" aria-hidden="true">
            {expenses.map((event) => (
              <div
                key={`${event.day}-${event.label}`}
                className="absolute"
                style={{ ...anchor(event.day), top: event.row === 1 ? 46 : 0 }}
              >
                <p className="text-[13px] whitespace-nowrap text-steel">{event.label}</p>
                <p className="tabular text-[13px] font-semibold whitespace-nowrap">
                  {signed(event.cents)}
                </p>
              </div>
            ))}
          </div>

          {/* Versão em texto para leitor de tela */}
          <p className="sr-only">
            Exemplo: o mês começa com {formatBRL(START)}, chega ao menor saldo de{' '}
            {formatBRL(lowest.balance)} no dia {lowest.day}, antes do salário, e termina com{' '}
            {formatBRL(end)}. Movimentos:{' '}
            {EVENTS.map((event) => `dia ${event.day}, ${event.label}, ${signed(event.cents)}`).join(
              '; ',
            )}
            .
          </p>
        </div>
      </div>
    </figure>
  );
}
