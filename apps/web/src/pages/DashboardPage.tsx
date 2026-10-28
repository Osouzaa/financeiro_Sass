import { Link } from 'react-router';
import { useAuth } from '@/features/auth/auth-context';
import { PageHeader } from '@/layout/AppLayout';

/**
 * Primeiros passos até o dashboard real existir.
 * A ordem segue o que o sistema precisa para calcular a projeção.
 */
const FIRST_STEPS = [
  {
    title: 'Cadastre suas contas e cartões',
    detail: 'Conta corrente, carteira e cartões de crédito com dia de fechamento e vencimento.',
    to: '/contas',
  },
  {
    title: 'Registre as recorrências',
    detail: 'Salário, aluguel e assinaturas: tudo o que se repete todo mês.',
    to: '/recorrencias',
  },
  {
    title: 'Lance os gastos do mês',
    detail: 'Compras no débito, Pix e cartão, inclusive parceladas.',
    to: '/lancamentos',
  },
  {
    title: 'Veja a projeção',
    detail: 'O saldo dia a dia dos próximos meses, com o menor saldo destacado.',
    to: '/projecao',
  },
];

export function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.name.split(' ')[0];

  return (
    <>
      <PageHeader
        title={`Olá, ${firstName}`}
        description="Ainda não há dados para mostrar. Siga estes passos para montar sua primeira projeção de saldo."
      />

      <ol className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {FIRST_STEPS.map((step, index) => (
          <li key={step.to}>
            <Link
              to={step.to}
              className="flex gap-4 px-5 py-4 transition-colors hover:bg-paper sm:px-6 sm:py-5"
            >
              <span
                className="tabular grid size-8 shrink-0 place-items-center rounded-full border border-line-strong text-sm font-semibold text-ink-soft"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span>
                <span className="block font-semibold">{step.title}</span>
                <span className="mt-0.5 block text-[15px] text-ink-soft">{step.detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
