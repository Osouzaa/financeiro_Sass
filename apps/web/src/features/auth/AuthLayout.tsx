import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';

/**
 * Tela de entrada: à esquerda, sobre papel marfim, a pergunta que o produto
 * responde e um gráfico ilustrativo; à direita, o formulário no branco.
 */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.15fr_1fr]">
      <aside className="flex flex-col bg-ivory px-6 py-8 sm:px-10 lg:px-16 lg:py-12">
        <Logo />

        <div className="mt-12 lg:mt-auto">
          <h1 className="max-w-[14ch] text-balance text-[clamp(2.75rem,6vw,4.125rem)] leading-[0.91] tracking-[-0.02em]">
            Quanto você vai ter no dia 30?
          </h1>
          <p className="mt-6 max-w-[44ch] text-lg leading-snug text-steel">
            Contas, cartões e recorrências num só lugar, com o saldo projetado dia a dia antes de o
            mês fechar no vermelho.
          </p>
        </div>

        <ProjectionPreview />
      </aside>

      <main className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-[380px]">
          <h2 className="mb-10 text-[32px] leading-[1.19]">{title}</h2>
          {children}
        </div>
      </main>
    </div>
  );
}

/**
 * Card ilustrativo de projeção (dados de exemplo, rotulados como tal):
 * o saldo sobe com o salário e cai no vencimento da fatura.
 */
function ProjectionPreview() {
  return (
    <figure className="mt-12 hidden max-w-[520px] rounded-[20px] bg-canvas p-8 lg:mt-14 lg:mb-auto lg:block">
      <figcaption className="flex items-baseline justify-between gap-4">
        <span className="text-sm text-steel">Saldo projetado em 30/11</span>
        <span className="font-display text-sm tracking-[-0.02em] text-brass">exemplo</span>
      </figcaption>
      <p className="tabular mt-2 font-display text-[40px] leading-[1.2] tracking-[-0.02em]">
        R$ 2.418,90
      </p>
      <svg viewBox="-4 0 448 120" className="mt-6 w-full" aria-hidden="true" fill="none">
        <line x1="0" y1="104" x2="440" y2="104" stroke="#e8e8e8" />
        {/* Linha secundária (latão): gastos acumulados */}
        <path
          d="M0 98 L60 92 L120 86 L180 74 L240 70 L300 58 L360 52 L440 44"
          stroke="#816729"
          strokeWidth="1.25"
          strokeDasharray="2 4"
          strokeLinecap="round"
        />
        {/* Linha principal (laranja): saldo */}
        <path
          d="M0 70 L60 66 L90 24 L150 30 L210 36 L240 82 L300 78 L340 30 L400 36 L440 48"
          stroke="#ff682c"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx="440" cy="48" r="4" fill="#ff682c" />
      </svg>
      <div className="mt-4 flex gap-6 text-[13px] text-steel">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 bg-ember" aria-hidden="true" /> Saldo
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0 w-4 border-t border-dashed border-brass" aria-hidden="true" /> Gastos
          do mês
        </span>
      </div>
    </figure>
  );
}
