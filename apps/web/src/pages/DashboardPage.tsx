import { formatBRL, type CategoryDto } from '@financeiro/shared';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Check,
  CreditCard,
  Landmark,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '@/features/auth/auth-context';
import { PageHeader } from '@/layout/AppLayout';
import { api } from '@/lib/api';

const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
  new Date(),
);

/** Curva ilustrativa exibida esmaecida enquanto não há lançamentos. */
const SAMPLE_PROJECTION = Array.from({ length: 31 }, (_, index) => {
  const day = index + 1;
  const salary = day >= 5 ? 6200 : 0;
  const invoice = day >= 10 ? -2300 : 0;
  const rent = day >= 5 ? -1850 : 0;
  const daily = -day * 48;
  return { day, value: 3400 + salary + invoice + rent + daily };
});

const FIRST_STEPS = [
  { title: 'Cadastre suas contas e cartões', to: '/contas' },
  { title: 'Registre as recorrências', to: '/recorrencias' },
  { title: 'Lance os gastos do mês', to: '/lancamentos' },
  { title: 'Defina o orçamento por categoria', to: '/orcamento' },
];

export function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.name.split(' ')[0];

  return (
    <>
      <PageHeader
        title={`Olá, ${firstName}`}
        description={`Resumo de ${monthLabel}. Os números aparecem assim que você cadastrar contas e lançamentos.`}
        actions={
          <Link
            to="/lancamentos"
            className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-graphite px-4 text-sm font-medium text-white transition-colors hover:bg-black"
          >
            <Plus size={18} aria-hidden="true" /> Novo lançamento
          </Link>
        }
      />

      <section aria-label="Indicadores do mês" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Landmark}
          label="Saldo em contas"
          value={0}
          note="Nenhuma conta cadastrada"
        />
        <StatCard
          icon={ArrowDownLeft}
          label="Receitas do mês"
          value={0}
          note="Realizado + previsto"
          tone="positive"
        />
        <StatCard
          icon={ArrowUpRight}
          label="Despesas do mês"
          value={0}
          note="Por data da compra"
          tone="negative"
        />
        <StatCard icon={CreditCard} label="Faturas em aberto" value={0} note="Nenhum cartão" />
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <ProjectionCard />
        <FirstStepsCard />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <CategoriesCard />
        <UpcomingCard />
      </div>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  note,
  tone = 'neutral',
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  note: string;
  tone?: 'neutral' | 'positive' | 'negative';
}) {
  const chip = {
    neutral: 'bg-sunken text-steel',
    positive: 'bg-positive-soft text-positive',
    negative: 'bg-negative-soft text-negative',
  }[tone];
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate">{label}</span>
        <span className={`grid size-9 place-items-center rounded-[10px] ${chip}`}>
          <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
        </span>
      </div>
      <p className="tabular mt-3 font-display text-[28px] leading-none font-semibold tracking-[-0.02em]">
        {formatBRL(value)}
      </p>
      <p className="mt-2 text-[13px] text-faint">{note}</p>
    </div>
  );
}

function ProjectionCard() {
  return (
    <section
      aria-labelledby="titulo-projecao"
      className="card relative overflow-hidden p-6 xl:col-span-2"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="titulo-projecao" className="text-lg font-semibold">
            Projeção de saldo
          </h2>
          <p className="text-sm text-slate">Saldo previsto dia a dia até o fim do mês</p>
        </div>
        <span className="rounded-full border border-line bg-sunken px-2.5 py-1 text-[12px] text-slate">
          Exemplo
        </span>
      </div>

      <div className="mt-6 h-[260px] opacity-35 saturate-50" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={SAMPLE_PROJECTION} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <defs>
              <linearGradient id="dash-projection" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff682c" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#ff682c" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e7e4de" vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: '#7a7a80' }}
              interval={4}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: '#7a7a80' }}
              tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
              width={40}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#ff682c"
              strokeWidth={2}
              fill="url(#dash-projection)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="absolute inset-x-6 top-1/2 mx-auto mt-4 max-w-sm -translate-y-1/2 rounded-[14px] border border-line bg-surface/95 p-5 text-center backdrop-blur-sm">
        <p className="font-semibold">Sua projeção aparece aqui</p>
        <p className="mt-1 text-sm text-slate">
          Cadastre uma conta e suas recorrências para ver quanto vai sobrar no fim do mês.
        </p>
        <Link to="/contas" className="link-ember mt-3 inline-block text-sm">
          Cadastrar primeira conta
        </Link>
      </div>
    </section>
  );
}

function FirstStepsCard() {
  const done = 0;
  return (
    <section aria-labelledby="titulo-passos" className="card p-6">
      <h2 id="titulo-passos" className="text-lg font-semibold">
        Primeiros passos
      </h2>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
          <div
            className="h-full rounded-full bg-ember"
            style={{ width: `${(done / FIRST_STEPS.length) * 100}%` }}
          />
        </div>
        <span className="tabular text-[13px] text-slate">
          {done} de {FIRST_STEPS.length}
        </span>
      </div>
      <ol className="mt-5 space-y-1">
        {FIRST_STEPS.map((step, index) => (
          <li key={step.to}>
            <Link
              to={step.to}
              className="group flex items-center gap-3 rounded-[10px] px-2 py-2.5 transition-colors hover:bg-sunken"
            >
              <span className="tabular grid size-7 shrink-0 place-items-center rounded-full border border-line-strong text-[12px] text-slate group-hover:border-ember group-hover:text-ember">
                {index < done ? <Check size={14} /> : index + 1}
              </span>
              <span className="text-sm">{step.title}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CategoriesCard() {
  const { data } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<CategoryDto[]>('/categories'),
  });
  const expenses = (data ?? []).filter((c) => c.type === 'EXPENSE').slice(0, 5);

  return (
    <section aria-labelledby="titulo-categorias" className="card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="titulo-categorias" className="text-lg font-semibold">
            Gastos por categoria
          </h2>
          <p className="text-sm text-slate">Distribuição das despesas do mês</p>
        </div>
        <Link to="/configuracoes/categorias" className="link-ember text-sm">
          Ver categorias
        </Link>
      </div>

      <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row">
        <div className="relative size-[160px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[{ value: 1 }]}
                dataKey="value"
                innerRadius={56}
                outerRadius={76}
                stroke="none"
                isAnimationActive={false}
              >
                <Cell fill="#f1efea" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="tabular font-display text-lg font-semibold">{formatBRL(0)}</p>
              <p className="text-[12px] text-faint">no mês</p>
            </div>
          </div>
        </div>
        <ul className="w-full flex-1 divide-y divide-line">
          {expenses.map((category) => (
            <li key={category.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span
                className="size-2.5 rounded-full"
                style={{ background: category.color ?? '#a3a3a8' }}
                aria-hidden="true"
              />
              <span className="flex-1">{category.name}</span>
              <span className="tabular text-slate">{formatBRL(0)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function UpcomingCard() {
  return (
    <section aria-labelledby="titulo-vencimentos" className="card flex flex-col p-6">
      <h2 id="titulo-vencimentos" className="text-lg font-semibold">
        Próximos vencimentos
      </h2>
      <p className="text-sm text-slate">Contas e faturas dos próximos 7 dias</p>
      <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-[12px] border border-dashed border-line-strong px-6 py-10 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-ember-soft text-ember-deep">
          <CalendarClock size={22} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <p className="mt-4 font-medium">Nenhum vencimento por perto</p>
        <p className="mt-1 max-w-[36ch] text-sm text-slate">
          Quando houver contas recorrentes ou faturas de cartão, elas aparecem aqui com a data e o
          valor.
        </p>
      </div>
    </section>
  );
}
