import { Bell, Shapes, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { PageHeader } from '@/layout/AppLayout';

const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: 'perfil', label: 'Perfil', icon: UserRound },
  { to: 'seguranca', label: 'Segurança', icon: ShieldCheck },
  { to: 'alertas', label: 'Alertas', icon: Bell },
  { to: 'categorias', label: 'Categorias', icon: Shapes },
];

export function SettingsLayout() {
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Seu perfil, a segurança da conta e como o sistema avisa você."
      />
      <nav
        aria-label="Seções de configurações"
        className="mb-6 overflow-x-auto border-b border-line"
      >
        <ul className="flex w-max gap-1">
          {TABS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `-mb-px flex items-center gap-2 border-b-2 px-3 pb-3 text-sm transition-colors ${
                    isActive
                      ? 'border-ember font-medium text-graphite'
                      : 'border-transparent text-slate hover:text-graphite'
                  }`
                }
              >
                <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </>
  );
}

/** Bloco de configurações: título e descrição à esquerda, conteúdo à direita. */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card grid gap-6 p-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10 lg:p-8">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-slate">{description}</p>
      </div>
      <div className="min-w-0 max-w-2xl">{children}</div>
    </section>
  );
}
