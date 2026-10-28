import type { ReactNode } from 'react';

/**
 * Tela de entrada: à esquerda, a pergunta que o produto responde;
 * à direita, o formulário. No celular, a pergunta vira um cabeçalho compacto.
 */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative flex flex-col justify-between overflow-hidden bg-ink px-6 py-8 text-white sm:px-10 lg:px-16 lg:py-14">
        <p className="text-[15px] font-semibold tracking-tight text-white/90">Financeiro</p>

        <div className="my-10 lg:my-0">
          <h1 className="max-w-[12ch] text-[clamp(2.25rem,5.5vw,4.75rem)] leading-[0.98] font-semibold tracking-[-0.035em]">
            Quanto você vai ter no dia 30?
          </h1>
          <p className="mt-6 max-w-[42ch] text-base leading-relaxed text-white/70 lg:text-lg">
            Registre contas, cartões e lançamentos recorrentes. O saldo dos próximos meses aparece
            antes de o mês fechar no vermelho.
          </p>
        </div>

        <ProjectionLine />
      </aside>

      <main className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <h2 className="mb-8 text-2xl font-semibold tracking-tight">{title}</h2>
          {children}
        </div>
      </main>
    </div>
  );
}

/** Linha ilustrativa de saldo projetado: sobe com o salário, cai no vencimento da fatura. */
function ProjectionLine() {
  return (
    <svg
      viewBox="-6 0 612 120"
      className="hidden w-full max-w-xl text-[#7fa2f0] lg:block"
      aria-hidden="true"
      fill="none"
    >
      <line
        x1="0"
        y1="96"
        x2="600"
        y2="96"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeDasharray="3 6"
      />
      <path
        d="M0 70 L80 66 L120 30 L200 38 L260 44 L300 82 L360 80 L420 34 L500 40 L560 78 L600 76"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="600" cy="76" r="4" fill="currentColor" />
    </svg>
  );
}
