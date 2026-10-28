import {
  ArrowLeftRight,
  CalendarRange,
  LayoutDashboard,
  LogOut,
  PiggyBank,
  Settings,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { useAuth } from '@/features/auth/auth-context';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard },
  { to: '/lancamentos', label: 'Lançamentos', icon: ArrowLeftRight },
  { to: '/contas', label: 'Contas e cartões', icon: Wallet },
  { to: '/orcamento', label: 'Orçamento', icon: PiggyBank },
  { to: '/projecao', label: 'Projeção', icon: TrendingUp },
  { to: '/recorrencias', label: 'Recorrências', icon: CalendarRange },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        Pular para o conteúdo
      </a>

      <aside className="border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-r">
        <div className="flex h-16 items-center justify-between border-b border-line px-5 lg:border-b-0">
          <span className="text-[17px] font-semibold tracking-tight">Financeiro</span>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-md p-2 text-ink-soft hover:bg-paper hover:text-ink lg:hidden"
            aria-label="Sair"
          >
            <LogOut size={18} />
          </button>
        </div>

        <nav
          aria-label="Principal"
          className="overflow-x-auto border-b border-line lg:flex-1 lg:border-b-0"
        >
          <ul className="flex gap-1 px-3 py-2 lg:flex-col lg:py-4">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-md px-3 py-2 text-[15px] whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-accent-soft font-semibold text-accent-strong'
                        : 'text-ink-soft hover:bg-paper hover:text-ink'
                    }`
                  }
                >
                  <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden border-t border-line p-4 lg:block">
          <p className="truncate text-sm font-semibold">{user?.name}</p>
          <p className="truncate text-sm text-ink-faint">{user?.email}</p>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-3 inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink"
          >
            <LogOut size={16} aria-hidden="true" />
            Sair
          </button>
        </div>
      </aside>

      <main id="conteudo" className="min-w-0 px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
        <div className="mx-auto max-w-5xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-8">
      <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
      {description ? <p className="mt-2 max-w-[60ch] text-ink-soft">{description}</p> : null}
    </header>
  );
}
