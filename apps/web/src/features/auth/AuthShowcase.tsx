import {
  ArrowUpRight,
  CalendarClock,
  CreditCard,
  LineChart,
  PieChart as PieIcon,
} from 'lucide-react';
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

/*
 * Painel ilustrativo da tela de entrada: uma composição de telas do produto
 * com dados de exemplo. Não representa a conta de ninguém.
 */

const BALANCE = [
  { d: 1, v: 8200 },
  { d: 5, v: 7400 },
  { d: 8, v: 13900 },
  { d: 11, v: 13100 },
  { d: 14, v: 12500 },
  { d: 17, v: 10200 },
  { d: 20, v: 10800 },
  { d: 23, v: 11900 },
  { d: 26, v: 11300 },
  { d: 30, v: 12480 },
];

const CATEGORIES = [
  { name: 'Moradia', value: 38, color: '#ff682c' },
  { name: 'Alimentação', value: 24, color: '#f2a07b' },
  { name: 'Transporte', value: 16, color: '#c9a86a' },
  { name: 'Outros', value: 22, color: '#5a5a5e' },
];

const BILLS = [
  { name: 'Aluguel', date: '05 dez', amount: 'R$ 1.850,00' },
  { name: 'Fatura do cartão', date: '10 dez', amount: 'R$ 2.312,47' },
  { name: 'Internet', date: '15 dez', amount: 'R$ 119,90' },
];

export function AuthShowcase() {
  return (
    <div className="dot-grid relative flex h-full flex-col overflow-hidden rounded-[24px] bg-night px-10 py-10 text-white xl:px-14">
      {/* Brilho da marca */}
      <div
        className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-ember/25 blur-[120px]"
        aria-hidden="true"
      />

      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full border border-night-line bg-night-raised/80 px-3 py-1 text-[13px] text-white/70">
          <span className="size-1.5 rounded-full bg-ember" aria-hidden="true" />
          Controle financeiro pessoal
        </span>
        <p className="mt-6 max-w-[22ch] font-display text-[34px] leading-[1.1] font-medium tracking-[-0.02em] text-balance">
          Suas finanças organizadas, do extrato à projeção.
        </p>
      </div>

      {/* Composição de telas */}
      <div className="relative mt-10 flex-1" aria-hidden="true">
        <div className="relative mx-auto grid max-w-[560px] grid-cols-[1.35fr_1fr] gap-4">
          {/* Saldo projetado */}
          <div className="col-span-2 rounded-[18px] bg-surface p-5 text-graphite shadow-[0_24px_60px_-20px_rgb(0_0_0/0.6)]">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-[13px] text-slate">
                <LineChart size={15} strokeWidth={1.75} /> Saldo projetado · 31 dez
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-positive-soft px-2 py-0.5 text-[12px] font-medium text-positive">
                <ArrowUpRight size={13} /> 8,2%
              </span>
            </div>
            <p className="tabular mt-2 font-display text-[30px] leading-none font-semibold tracking-[-0.02em]">
              R$ 12.480<span className="text-slate">,35</span>
            </p>
            <div className="mt-3 h-[92px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={BALANCE} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="showcase-balance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ff682c" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#ff682c" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="#ff682c"
                    strokeWidth={2}
                    fill="url(#showcase-balance)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Próximas contas */}
          <div className="rounded-[18px] border border-night-line bg-night-raised p-5">
            <span className="inline-flex items-center gap-2 text-[13px] text-white/60">
              <CalendarClock size={15} strokeWidth={1.75} /> Próximas contas
            </span>
            <ul className="mt-3 divide-y divide-night-line">
              {BILLS.map((bill) => (
                <li key={bill.name} className="flex items-center justify-between gap-3 py-2.5">
                  <span>
                    <span className="block text-[13px] text-white">{bill.name}</span>
                    <span className="block text-[12px] text-white/45">{bill.date}</span>
                  </span>
                  <span className="tabular text-[13px] text-white/85">{bill.amount}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Gastos por categoria */}
          <div className="rounded-[18px] border border-night-line bg-night-raised p-5">
            <span className="inline-flex items-center gap-2 text-[13px] text-white/60">
              <PieIcon size={15} strokeWidth={1.75} /> Gastos do mês
            </span>
            <div className="mt-2 flex items-center gap-3">
              <div className="size-[76px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={CATEGORIES}
                      dataKey="value"
                      innerRadius={24}
                      outerRadius={37}
                      paddingAngle={3}
                      stroke="none"
                      isAnimationActive={false}
                    >
                      {CATEGORIES.map((c) => (
                        <Cell key={c.name} fill={c.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1">
                {CATEGORIES.map((c) => (
                  <li key={c.name} className="flex items-center gap-1.5 text-[12px] text-white/70">
                    <span className="size-1.5 rounded-full" style={{ background: c.color }} />
                    {c.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Cartão de crédito */}
        <div className="absolute right-2 bottom-6 hidden w-[240px] rotate-[-8deg] rounded-[16px] bg-gradient-to-br from-[#2b2b2e] via-[#1b1b1d] to-[#3a2116] p-4 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.7)] ring-1 ring-white/10 lg:block">
          <div className="flex items-center justify-between">
            <span className="h-6 w-8 rounded-[5px] bg-gradient-to-br from-[#e9c98f] to-[#b38b4d]" />
            <CreditCard size={18} className="text-white/50" />
          </div>
          <p className="tabular mt-6 text-[15px] tracking-[0.18em] text-white/85">•••• 4821</p>
          <div className="mt-2 flex justify-between text-[11px] text-white/45">
            <span>Fecha dia 25</span>
            <span>Vence dia 05</span>
          </div>
        </div>
      </div>
    </div>
  );
}
