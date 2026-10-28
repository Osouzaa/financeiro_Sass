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

      <section aria-labelledby="primeiros-passos" className="card-editorial p-6 sm:p-10 lg:p-14">
        <h2 id="primeiros-passos" className="text-lg leading-tight text-steel">
          Primeiros passos
        </h2>
        <ol className="mt-8 grid gap-px bg-mist sm:grid-cols-2">
          {FIRST_STEPS.map((step, index) => (
            <li key={step.to} className="bg-ash">
              <Link
                to={step.to}
                className="group flex h-full flex-col gap-3 py-6 transition-colors sm:p-8 sm:hover:bg-fog"
              >
                <span
                  className="tabular font-display text-[40px] leading-none tracking-[-0.02em] text-slate transition-colors group-hover:text-ember"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="mt-2 font-display text-xl leading-tight tracking-[-0.02em]">
                  {step.title}
                </span>
                <span className="text-[15px] leading-relaxed text-steel">{step.detail}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
