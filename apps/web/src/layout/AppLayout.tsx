import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/features/auth/auth-context';

const NAV_ITEMS = [
  { to: '/', label: 'Visão geral' },
  { to: '/lancamentos', label: 'Lançamentos' },
  { to: '/contas', label: 'Contas e cartões' },
  { to: '/orcamento', label: 'Orçamento' },
  { to: '/projecao', label: 'Projeção' },
  { to: '/recorrencias', label: 'Recorrências' },
  { to: '/configuracoes', label: 'Configurações' },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const initials = user?.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-graphite focus:px-4 focus:py-2 focus:text-canvas"
      >
        Pular para o conteúdo
      </a>

      <header className="border-b border-mist">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 sm:px-8">
          <Link to="/" aria-label="Financeiro, visão geral" className="shrink-0">
            <Logo size={28} />
          </Link>

          <nav
            aria-label="Principal"
            className="order-last -mx-5 w-[calc(100%+2.5rem)] overflow-x-auto px-5 sm:-mx-8 sm:w-[calc(100%+4rem)] sm:px-8 xl:order-none xl:mx-auto xl:w-auto xl:overflow-visible xl:px-0"
          >
            <ul className="flex w-max gap-1 rounded-[200px] bg-ash p-1.5">
              {NAV_ITEMS.map(({ to, label }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      `block rounded-[200px] px-4 py-2 font-display text-[15px] leading-none tracking-[-0.02em] whitespace-nowrap transition-colors ${
                        isActive
                          ? 'bg-canvas text-graphite'
                          : 'text-steel hover:bg-canvas/60 hover:text-graphite'
                      }`
                    }
                  >
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-1 xl:ml-0">
            <span
              className="grid size-9 place-items-center rounded-full bg-ivory font-display text-sm text-graphite"
              title={`${user?.name ?? ''} · ${user?.email ?? ''}`}
            >
              <span aria-hidden="true">{initials}</span>
              <span className="sr-only">
                Conectado como {user?.name} ({user?.email})
              </span>
            </span>
            <button
              type="button"
              onClick={() => void logout()}
              className="grid size-9 place-items-center rounded-full text-steel transition-colors hover:bg-ash hover:text-graphite"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      <main id="conteudo" className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8 lg:py-16">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  aside,
}: {
  title: string;
  description?: string;
  aside?: ReactNode;
}) {
  return (
    <header className="mb-10 flex flex-wrap items-end justify-between gap-6 lg:mb-14">
      <div>
        <h1 className="text-[clamp(2rem,4vw,2.5rem)] leading-[1.2]">{title}</h1>
        {description ? (
          <p className="mt-3 max-w-[62ch] text-lg leading-snug text-steel">{description}</p>
        ) : null}
      </div>
      {aside}
    </header>
  );
}
