import { formatBRL, type PlanDto, type PlanLimits } from '@financeiro/shared';
import { Check, ChevronDown, Menu, Minus, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Logo } from '@/components/Logo';
import { formatPlanPrice, usePublicPlans } from '@/features/plans/plan-api';
import { MonthRibbon } from './MonthRibbon';

/*
 * Página de divulgação. Promete só o que o sistema já faz; o que está a caminho
 * aparece como "em breve". Os números das telas são de exemplo.
 */

const CONTAINER = 'mx-auto w-full max-w-[1120px] px-6 sm:px-8';
const SECTION = 'py-16 sm:py-24';

const NAV = [
  { href: '#recursos', label: 'Recursos' },
  { href: '#seguranca', label: 'Segurança' },
  { href: '#planos', label: 'Planos' },
  { href: '#perguntas', label: 'Perguntas' },
];

export function LandingPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Financeiro: veja o seu mês inteiro antes de ele acontecer';
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-surface text-graphite">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-[10px] focus:bg-graphite focus:px-4 focus:py-2 focus:text-white"
      >
        Pular para o conteúdo
      </a>
      <TopNav />
      <main id="conteudo">
        <Hero />
        <Features />
        <Steps />
        <Security />
        <Pricing />
        <Faq />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ Topo */

function TopNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <div className={`${CONTAINER} flex h-16 items-center justify-between gap-6`}>
        <Link to="/" aria-label="Financeiro, início">
          <Logo size={26} />
        </Link>
        <nav aria-label="Seções" className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[15px] text-steel hover:text-graphite"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/entrar"
            className="hidden h-10 items-center px-3 text-[15px] font-medium text-steel hover:text-graphite sm:inline-flex"
          >
            Entrar
          </Link>
          <Link
            to="/cadastro"
            className="inline-flex h-10 items-center rounded-[10px] bg-graphite px-4 text-[15px] font-medium text-white hover:bg-black"
          >
            Criar conta
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="grid size-10 place-items-center rounded-[10px] text-steel hover:bg-sunken md:hidden"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={open}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open ? (
        <nav
          aria-label="Seções"
          className="border-t border-line md:hidden"
          onClick={() => setOpen(false)}
        >
          <div className={`${CONTAINER} flex flex-col py-2`}>
            {[...NAV, { href: '/entrar', label: 'Entrar' }].map((item) =>
              item.href.startsWith('#') ? (
                <a key={item.href} href={item.href} className="py-3 text-[15px] text-steel">
                  {item.label}
                </a>
              ) : (
                <Link key={item.href} to={item.href} className="py-3 text-[15px] text-steel">
                  {item.label}
                </Link>
              ),
            )}
          </div>
        </nav>
      ) : null}
    </header>
  );
}

function Hero() {
  return (
    <section aria-labelledby="titulo-principal" className="pt-14 pb-16 sm:pt-20 sm:pb-24">
      <div className={CONTAINER}>
        <h1
          id="titulo-principal"
          className="max-w-[15ch] font-display text-[44px] leading-[1.02] font-semibold tracking-[-0.035em] sm:text-[64px]"
        >
          Veja o seu mês inteiro antes de ele acontecer.
        </h1>
        <div className="mt-8 grid gap-8 sm:mt-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <p className="max-w-[56ch] text-[17px] leading-[1.6] text-steel sm:text-[19px]">
            Lance suas contas, cartões e o que se repete todo mês. O Financeiro calcula o saldo de
            cada dia e mostra quando o dinheiro vai apertar, a tempo de você mudar o plano.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/cadastro"
              className="inline-flex h-12 items-center justify-center rounded-[12px] bg-ember px-6 text-[15px] font-semibold text-white hover:bg-ember-strong"
            >
              Criar conta grátis
            </Link>
            <a
              href="#planos"
              className="inline-flex h-12 items-center justify-center rounded-[12px] border border-line-strong px-6 text-[15px] font-medium hover:bg-sunken"
            >
              Ver planos
            </a>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate lg:text-right">
          Plano grátis para sempre. Não pedimos cartão de crédito.
        </p>

        <div className="mt-14 sm:mt-16">
          <MonthRibbon />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Recursos */

function SectionTitle({ id, children, text }: { id: string; children: ReactNode; text?: string }) {
  return (
    <div className="max-w-[40rem]">
      <h2
        id={id}
        className="font-display text-[32px] leading-[1.1] font-semibold tracking-[-0.025em] sm:text-[44px]"
      >
        {children}
      </h2>
      {text ? <p className="mt-4 text-[17px] leading-[1.6] text-steel">{text}</p> : null}
    </div>
  );
}

function Spread({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="grid gap-8 border-t border-line py-12 first:border-t-0 first:pt-0 sm:py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
      <div className="max-w-[34rem]">
        <h3 className="font-display text-[24px] leading-[1.2] font-semibold tracking-[-0.015em] sm:text-[28px]">
          {title}
        </h3>
        <p className="mt-3 text-[17px] leading-[1.6] text-steel">{text}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

const INVOICES = [
  {
    month: 'Novembro',
    detail: 'Paga em 05/11',
    amount: 1980.4,
    state: 'Paga',
    tone: 'text-positive',
  },
  {
    month: 'Dezembro',
    detail: 'Fechou em 25/11, vence 05/12',
    amount: 2312.47,
    state: 'Fechada',
    tone: 'text-graphite',
  },
  {
    month: 'Janeiro',
    detail: 'Fecha em 25/12',
    amount: 640.1,
    state: 'Aberta',
    tone: 'text-slate',
  },
];

const PARCELS = ['dez', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set'];

const BUDGETS = [
  { name: 'Moradia', used: 2100, limit: 2300 },
  { name: 'Alimentação', used: 812, limit: 1000 },
  { name: 'Lazer', used: 460, limit: 400 },
];

function Features() {
  return (
    <section
      aria-labelledby="titulo-recursos"
      id="recursos"
      className={`scroll-mt-16 border-t border-line bg-canvas ${SECTION}`}
    >
      <div className={CONTAINER}>
        <SectionTitle
          id="titulo-recursos"
          text="Feito para o mês de verdade: salário no dia 5, cartão que fecha no 25, compra parcelada e conta de luz que nunca vem igual."
        >
          O que o Financeiro faz por você
        </SectionTitle>

        <div className="mt-14 sm:mt-20">
          <Spread
            title="A fatura certa, sem planilha"
            text="Cada compra no cartão vai para a fatura do mês certo, pelo dia de fechamento. Você paga total, parte ou agenda, e acompanha o limite que sobra."
          >
            <ul className="divide-y divide-line rounded-[14px] border border-line bg-surface">
              {INVOICES.map((invoice) => (
                <li key={invoice.month} className="flex items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">Fatura de {invoice.month.toLowerCase()}</p>
                    <p className="text-sm text-slate">{invoice.detail}</p>
                  </div>
                  <p className="tabular text-right font-display text-[17px] font-semibold">
                    {formatBRL(Math.round(invoice.amount * 100))}
                  </p>
                  <span className={`w-16 text-right text-sm font-medium ${invoice.tone}`}>
                    {invoice.state}
                  </span>
                </li>
              ))}
            </ul>
          </Spread>

          <Spread
            title="Compra em 10x? Lance uma vez"
            text="Informe o total e o número de parcelas. Cada parcela cai na fatura do mês dela, com os centavos do arredondamento resolvidos na primeira."
          >
            <div className="rounded-[14px] border border-line bg-surface p-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium">Geladeira</p>
                <p className="tabular text-sm text-slate">10 × R$ 349,90</p>
              </div>
              <ol className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
                {PARCELS.map((month, index) => (
                  <li
                    key={month}
                    className={`rounded-[8px] border px-2 py-2 text-center ${
                      index === 0
                        ? 'border-graphite bg-graphite text-white'
                        : 'border-line text-steel'
                    }`}
                  >
                    <span className="tabular block text-[13px] font-semibold">{index + 1}/10</span>
                    <span className="block text-[12px] opacity-75">{month}</span>
                  </li>
                ))}
              </ol>
            </div>
          </Spread>

          <Spread
            title="Um limite por categoria, com aviso antes"
            text="Defina quanto quer gastar em cada categoria no mês. O orçamento separa o que já foi gasto do que ainda está previsto e avisa quando chega perto do limite."
          >
            <ul className="space-y-5 rounded-[14px] border border-line bg-surface p-5">
              {BUDGETS.map((budget) => {
                const share = budget.used / budget.limit;
                const state = share > 1 ? 'Passou' : share >= 0.8 ? 'Perto do limite' : 'No ritmo';
                return (
                  <li key={budget.name}>
                    <div className="flex items-baseline justify-between gap-3 text-[15px]">
                      <span className="font-medium">{budget.name}</span>
                      <span className="tabular text-steel">
                        {formatBRL(budget.used * 100)} de {formatBRL(budget.limit * 100)}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunken">
                      <span
                        className={`block h-full rounded-full ${
                          share > 1 ? 'bg-negative' : share >= 0.8 ? 'bg-[#d69a1c]' : 'bg-graphite'
                        }`}
                        style={{ width: `${Math.min(100, share * 100)}%` }}
                      />
                    </div>
                    <p
                      className={`mt-1.5 text-[13px] ${
                        share > 1 ? 'text-negative' : share >= 0.8 ? 'text-brass' : 'text-slate'
                      }`}
                    >
                      {state}
                    </p>
                  </li>
                );
              })}
            </ul>
          </Spread>
        </div>

        <dl className="mt-4 grid gap-x-16 gap-y-8 border-t border-line pt-12 sm:grid-cols-2 sm:pt-16 lg:grid-cols-3">
          {[
            [
              'Recorrências',
              'Salário, aluguel e assinaturas viram lançamentos previstos dos próximos 12 meses. Reajustou? Mude desta data em diante.',
            ],
            [
              'Categorias do seu jeito',
              'Categorias e subcategorias com cor e ícone. As subcategorias somam na principal nos relatórios.',
            ],
            [
              'Transferências',
              'Passe dinheiro entre contas e pague o cartão sem duplicar receita nem despesa.',
            ],
            [
              'Busca e filtros',
              'Encontre qualquer lançamento por descrição, conta, categoria ou status, mês a mês.',
            ],
            [
              'Celular e computador',
              'Funciona no navegador de qualquer aparelho, com a mesma conta e os mesmos dados.',
            ],
            [
              'Assistente no WhatsApp',
              'Em breve: avisos de vencimento, resumos e gastos lançados por mensagem.',
            ],
          ].map(([title, text]) => (
            <div key={title}>
              <dt className="font-semibold">{title}</dt>
              <dd className="mt-1.5 text-[15px] leading-[1.6] text-steel">{text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Passos */

function Steps() {
  const steps = [
    [
      'Cadastre contas e cartões',
      'O saldo de hoje e, nos cartões, os dias de fechamento e vencimento.',
    ],
    [
      'Lance o fixo e o dia a dia',
      'Recorrências para o que se repete, lançamentos para o resto. Leva minutos.',
    ],
    [
      'Decida com antecedência',
      'O painel mostra o mês, a projeção e o que vence nos próximos dias.',
    ],
  ];
  return (
    <section aria-labelledby="titulo-passos" className={`border-t border-line ${SECTION}`}>
      <div className={CONTAINER}>
        <SectionTitle id="titulo-passos">Comece em três passos</SectionTitle>
        <ol className="mt-12 grid gap-10 sm:mt-16 md:grid-cols-3 md:gap-12">
          {steps.map(([title, text], index) => (
            <li key={title} className="border-t-2 border-graphite pt-5">
              <p className="tabular text-sm font-semibold text-slate">Passo {index + 1}</p>
              <h3 className="mt-2 font-display text-[20px] font-semibold tracking-[-0.01em]">
                {title}
              </h3>
              <p className="mt-2 text-[15px] leading-[1.6] text-steel">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Segurança */

function Security() {
  const items = [
    'Não pedimos senha de banco e não movimentamos dinheiro.',
    'Senhas guardadas só como hash, com limite de tentativas de login.',
    'O CPF nunca aparece inteiro nas telas.',
    'Você vê onde a conta está aberta e encerra qualquer dispositivo.',
    'Cada pessoa só acessa os próprios dados, conferido pelo servidor.',
    'Baixe todos os seus dados ou exclua a conta quando quiser (LGPD).',
  ];
  return (
    <section
      aria-labelledby="titulo-seguranca"
      id="seguranca"
      className={`scroll-mt-16 border-t border-line bg-canvas ${SECTION}`}
    >
      <div
        className={`${CONTAINER} grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16`}
      >
        <SectionTitle
          id="titulo-seguranca"
          text="Você registra o que quiser, do jeito que quiser. O que fica com a gente é tratado com o cuidado de dado financeiro."
        >
          Seus dados, sob seu controle
        </SectionTitle>
        <ul className="grid content-start gap-x-10 gap-y-6 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item} className="flex gap-3 text-[15px] leading-[1.6] text-steel">
              <Check
                size={18}
                className="mt-1 shrink-0 text-positive"
                strokeWidth={2.25}
                aria-hidden="true"
              />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Planos */

type Row = { label: string; value: (limits: PlanLimits, plan: PlanDto) => string | boolean };

const ROWS: Row[] = [
  { label: 'Lançamentos', value: () => 'Ilimitados' },
  {
    label: 'Teste grátis',
    value: (_limits, plan) =>
      plan.priceCents === 0 ? '—' : plan.trialDays ? `${plan.trialDays} dias` : false,
  },
  {
    label: 'Contas e carteiras',
    value: (l) => (l.maxAccounts === null ? 'Ilimitadas' : String(l.maxAccounts)),
  },
  {
    label: 'Cartões de crédito',
    value: (l) => (l.maxCards === null ? 'Ilimitados' : String(l.maxCards)),
  },
  {
    label: 'Recorrências ativas',
    value: (l) => (l.maxRecurrences === null ? 'Ilimitadas' : String(l.maxRecurrences)),
  },
  {
    label: 'Categorias no orçamento',
    value: (l) => (l.maxBudgets === null ? 'Todas' : `Até ${l.maxBudgets}`),
  },
  {
    label: 'Projeção de saldo',
    value: (l) => (l.projectionDays >= 365 ? '1 ano' : `${l.projectionDays} dias`),
  },
  { label: 'Assistente no WhatsApp (em breve)', value: (l) => l.whatsapp },
];

function Pricing() {
  const { data: plans, isPending, error } = usePublicPlans();
  return (
    <section
      aria-labelledby="titulo-planos"
      id="planos"
      className={`scroll-mt-16 border-t border-line ${SECTION}`}
    >
      <div className={CONTAINER}>
        <SectionTitle
          id="titulo-planos"
          text="Comece no grátis e mude quando precisar de mais. Sem fidelidade: o plano pago vale até o fim do período e você pode cancelar quando quiser."
        >
          Planos
        </SectionTitle>

        {error ? (
          <p className="mt-10 text-[15px] text-steel">
            Não foi possível carregar os planos agora.{' '}
            <Link to="/cadastro" className="link-ember">
              Crie sua conta grátis
            </Link>{' '}
            e compare os planos em Configurações.
          </p>
        ) : isPending || !plans ? (
          <div
            className="mt-12 h-[420px] animate-pulse rounded-[16px] bg-sunken/60"
            aria-hidden="true"
          />
        ) : (
          <>
            <ul className="mt-12 grid gap-6 sm:mt-16 md:grid-cols-2">
              {plans.map((plan) => (
                <PriceCard key={plan.id} plan={plan} />
              ))}
            </ul>
            <ComparisonTable plans={plans} />
          </>
        )}
        <p className="mt-6 text-sm text-slate">
          Planos pagos no cartão de crédito, pelo Mercado Pago, com renovação automática.
        </p>
      </div>
    </section>
  );
}

function PriceCard({ plan }: { plan: PlanDto }) {
  const free = plan.priceCents === 0;
  const [price, period] = formatPlanPrice(plan).split('/');
  const featured = plan.highlighted;
  return (
    <li
      className={`flex flex-col rounded-[16px] border p-7 sm:p-8 ${
        featured ? 'border-graphite bg-graphite text-white' : 'border-line bg-surface'
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-[22px] font-semibold">{plan.name}</h3>
        {featured ? <span className="text-sm text-white/60">Mais completo</span> : null}
      </div>
      <p className={`mt-2 text-[15px] leading-[1.6] ${featured ? 'text-white/70' : 'text-steel'}`}>
        {plan.description}
      </p>
      <p className="mt-8 flex items-baseline gap-1.5">
        <span className="tabular font-display text-[44px] leading-none font-semibold tracking-[-0.03em]">
          {price}
        </span>
        {period ? (
          <span className={featured ? 'text-white/60' : 'text-slate'}>por {period}</span>
        ) : null}
      </p>
      {!free && plan.trialDays > 0 ? (
        <p className={`mt-2 text-[15px] ${featured ? 'text-white/80' : 'text-positive'}`}>
          {plan.trialDays} dias grátis para experimentar
        </p>
      ) : null}
      <ul className="mt-8 flex-1 space-y-3 text-[15px]">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-3">
            <Check
              size={18}
              strokeWidth={2.25}
              className={`mt-0.5 shrink-0 ${featured ? 'text-ember' : 'text-positive'}`}
              aria-hidden="true"
            />
            {feature}
          </li>
        ))}
      </ul>
      <Link
        to={free ? '/cadastro' : `/cadastro?plano=${encodeURIComponent(plan.code)}`}
        className={`mt-10 inline-flex h-12 items-center justify-center rounded-[12px] text-[15px] font-semibold ${
          featured
            ? 'bg-ember text-white hover:bg-ember-strong'
            : 'border border-line-strong hover:bg-sunken'
        }`}
      >
        {free
          ? 'Começar grátis'
          : plan.trialDays > 0
            ? `Experimentar ${plan.trialDays} dias grátis`
            : `Assinar o ${plan.name}`}
      </Link>
    </li>
  );
}

/** A mesma informação dos cards, linha a linha, para comparar sem caçar diferenças. */
function ComparisonTable({ plans }: { plans: PlanDto[] }) {
  return (
    <div className="mt-12 overflow-x-auto sm:mt-16">
      <table className="w-full min-w-[520px] text-left text-[15px]">
        <caption className="sr-only">Comparação dos planos</caption>
        <thead>
          <tr className="border-b border-graphite">
            <th scope="col" className="py-3 pr-6 font-semibold">
              Recurso
            </th>
            {plans.map((plan) => (
              <th key={plan.id} scope="col" className="py-3 pr-6 font-semibold">
                {plan.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {ROWS.map((row) => (
            <tr key={row.label}>
              <th scope="row" className="py-3.5 pr-6 font-normal text-steel">
                {row.label}
              </th>
              {plans.map((plan) => {
                const value = row.value(plan.limits, plan);
                return (
                  <td key={plan.id} className="tabular py-3.5 pr-6">
                    {value === true ? (
                      <Check size={18} className="text-positive" aria-label="Incluso" />
                    ) : value === false ? (
                      <Minus size={18} className="text-faint" aria-label="Não incluso" />
                    ) : (
                      value
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ Perguntas */

const QUESTIONS = [
  [
    'Preciso conectar minha conta do banco?',
    'Não. Você registra contas, cartões e lançamentos do seu jeito. Não pedimos senha de banco e não movimentamos dinheiro.',
  ],
  [
    'O plano grátis tem prazo?',
    'Não. Ele continua grátis enquanto você quiser, com os limites da tabela acima.',
  ],
  [
    'Posso cancelar quando quiser?',
    'Sim, sem multa. O plano pago vale até o fim do período já pago; depois a conta volta ao grátis, com os seus dados preservados.',
  ],
  [
    'Funciona no celular?',
    'Funciona no navegador do celular, do tablet e do computador, com a mesma conta.',
  ],
  [
    'Como meus dados são protegidos?',
    'Senhas guardadas só como hash, limite de tentativas de login, controle das sessões abertas e acesso de cada pessoa restrito aos próprios dados. Você pode baixar ou excluir tudo quando quiser.',
  ],
  [
    'Quando chega o assistente no WhatsApp?',
    'Está em desenvolvimento. Quem cadastrar o celular no perfil e autorizar as mensagens recebe primeiro.',
  ],
];

function Faq() {
  return (
    <section
      aria-labelledby="titulo-perguntas"
      id="perguntas"
      className={`scroll-mt-16 border-t border-line bg-canvas ${SECTION}`}
    >
      <div
        className={`${CONTAINER} grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16`}
      >
        <SectionTitle id="titulo-perguntas">Perguntas frequentes</SectionTitle>
        <div className="border-t border-line">
          {QUESTIONS.map(([question, answer]) => (
            <details
              key={question}
              className="group border-b border-line [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[17px] font-medium">
                {question}
                <ChevronDown
                  size={20}
                  className="shrink-0 text-slate transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="max-w-[60ch] pb-6 text-[15px] leading-[1.6] text-steel">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Fechamento */

function Closing() {
  return (
    <section aria-labelledby="titulo-fechamento" className={`border-t border-line ${SECTION}`}>
      <div
        className={`${CONTAINER} flex flex-col gap-8 md:flex-row md:items-end md:justify-between`}
      >
        <div className="max-w-[36rem]">
          <h2
            id="titulo-fechamento"
            className="font-display text-[32px] leading-[1.1] font-semibold tracking-[-0.025em] sm:text-[44px]"
          >
            Comece pelo mês que vem.
          </h2>
          <p className="mt-4 text-[17px] leading-[1.6] text-steel">
            A conta fica pronta em menos de um minuto, com as categorias já criadas.
          </p>
        </div>
        <Link
          to="/cadastro"
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-[12px] bg-ember px-7 text-[15px] font-semibold text-white hover:bg-ember-strong"
        >
          Criar conta grátis
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line bg-canvas">
      <div
        className={`${CONTAINER} flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between`}
      >
        <div className="flex items-center gap-4">
          <Logo size={24} />
          <p className="text-sm text-slate">© {new Date().getFullYear()} Financeiro</p>
        </div>
        <nav aria-label="Rodapé" className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-steel">
          <a href="#planos" className="hover:text-graphite">
            Planos
          </a>
          <Link to="/termos" className="hover:text-graphite">
            Termos de uso
          </Link>
          <Link to="/privacidade" className="hover:text-graphite">
            Privacidade
          </Link>
          <Link to="/entrar" className="hover:text-graphite">
            Entrar
          </Link>
        </nav>
      </div>
    </footer>
  );
}
