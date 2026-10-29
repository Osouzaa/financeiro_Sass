import { Gauge, Layers, ScrollText, Users, type LucideIcon } from 'lucide-react';
import { Navigate, NavLink, Outlet } from 'react-router';
import { useAuth } from '@/features/auth/auth-context';
import { PageHeader } from '@/layout/AppLayout';

const TABS: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/admin', label: 'Visão geral', icon: Gauge, end: true },
  { to: '/admin/usuarios', label: 'Usuários', icon: Users },
  { to: '/admin/planos', label: 'Planos', icon: Layers },
  { to: '/admin/auditoria', label: 'Auditoria', icon: ScrollText },
];

/**
 * Área do super administrador. Esconder no front é só conforto: quem garante
 * o acesso é a API, que confere o papel no banco a cada requisição.
 */
export function AdminLayout() {
  const { user } = useAuth();
  if (user?.role !== 'SUPER_ADMIN') return <Navigate to="/" replace />;

  return (
    <>
      <PageHeader
        title="Administração"
        description="Contas, planos e o registro de tudo o que foi alterado por aqui."
      />
      <nav
        aria-label="Seções da administração"
        className="mb-6 overflow-x-auto border-b border-line"
      >
        <ul className="flex w-max gap-1">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
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
