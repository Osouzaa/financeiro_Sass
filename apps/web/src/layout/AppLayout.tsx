import {
  ArrowLeftRight,
  CalendarRange,
  LayoutDashboard,
  LogOut,
  Menu,
  PiggyBank,
  ReceiptText,
  Settings,
  ShieldCheck,
  TrendingUp,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { Avatar } from '@/components/Avatar';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/features/auth/auth-context';
import { EmailVerificationBanner } from './EmailVerificationBanner';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Principal',
    items: [
      { to: '/', label: 'Visão geral', icon: LayoutDashboard },
      { to: '/lancamentos', label: 'Lançamentos', icon: ArrowLeftRight },
      { to: '/contas', label: 'Contas e cartões', icon: Wallet },
      { to: '/faturas', label: 'Faturas', icon: ReceiptText },
      { to: '/projecao', label: 'Projeção', icon: TrendingUp },
    ],
  },
  {
    title: 'Planejamento',
    items: [
      { to: '/orcamento', label: 'Orçamento', icon: PiggyBank },
      { to: '/recorrencias', label: 'Recorrências', icon: CalendarRange },
    ],
  },
];

const today = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
}).format(new Date());

export function AppLayout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Fecha o menu do celular ao clicar em qualquer link dele
  const closeOnNavigate = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest('a')) setMenuOpen(false);
  };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-[10px] focus:bg-graphite focus:px-4 focus:py-2 focus:text-white"
      >
        Pular para o conteúdo
      </a>

      {/* Fundo escurecido do menu no celular */}
      {menuOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={`dot-grid fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col bg-night text-white transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Menu"
        onClick={closeOnNavigate}
      >
        <div className="flex h-16 items-center justify-between px-6">
          <Link to="/" aria-label="Financeiro, visão geral">
            <Logo size={28} tone="light" />
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="grid size-9 place-items-center rounded-[10px] text-white/60 hover:bg-night-raised hover:text-white lg:hidden"
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav aria-label="Principal" className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="mb-6">
              <p className="px-3 pb-2 text-[12px] font-medium text-white/35">{group.title}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <SidebarLink {...item} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="space-y-0.5 border-t border-night-line px-3 py-3">
          {user?.role === 'SUPER_ADMIN' ? (
            <SidebarLink to="/admin" label="Administração" icon={ShieldCheck} />
          ) : null}
          <SidebarLink to="/configuracoes" label="Configurações" icon={Settings} />
        </div>

        <div className="flex items-center gap-2 border-t border-night-line px-3 py-3">
          <Link
            to="/configuracoes/perfil"
            className="flex min-w-0 flex-1 items-center gap-3 rounded-[10px] px-2 py-1.5 transition-colors hover:bg-night-raised"
            title="Meu perfil"
          >
            <Avatar user={user} size={36} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{user?.name}</span>
              <span className="block truncate text-[12px] text-white/45">{user?.email}</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="grid size-9 place-items-center rounded-[10px] text-white/55 transition-colors hover:bg-night-raised hover:text-white"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut size={18} strokeWidth={1.75} />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <EmailVerificationBanner />
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-canvas/85 px-5 backdrop-blur sm:px-8">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="grid size-10 place-items-center rounded-[10px] border border-line bg-surface text-steel lg:hidden"
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
          >
            <Menu size={20} />
          </button>
          <Link to="/" className="lg:hidden" aria-label="Financeiro, visão geral">
            <Logo size={26} />
          </Link>
          <p className="ml-auto hidden text-sm text-slate first-letter:uppercase sm:block lg:ml-0">
            {today}
          </p>
        </header>

        <main id="conteudo" className="w-full flex-1 px-5 pt-5 pb-10 sm:px-8 lg:px-10 lg:pt-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarLink({ to, label, icon: Icon }: NavItem) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] transition-colors ${
          isActive
            ? 'bg-night-raised font-medium text-white before:absolute before:top-2 before:bottom-2 before:-left-3 before:w-[3px] before:rounded-r-full before:bg-ember'
            : 'text-white/60 hover:bg-night-raised/60 hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={18}
            strokeWidth={1.75}
            className={isActive ? 'text-ember' : ''}
            aria-hidden="true"
          />
          {label}
        </>
      )}
    </NavLink>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold sm:text-[32px]">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-[64ch] text-[15px] text-slate">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </header>
  );
}
