import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { GuestOnly, RequireAuth } from '@/features/auth/route-guards';
import { AccountsPage } from '@/features/accounts/AccountsPage';
import { CategoriesPage } from '@/features/categories/CategoriesPage';
import { AlertsPage } from '@/features/settings/AlertsPage';
import { ProfilePage } from '@/features/settings/ProfilePage';
import { SecurityPage } from '@/features/settings/SecurityPage';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { AppLayout } from '@/layout/AppLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { UpcomingPage } from '@/pages/UpcomingPage';

const router = createBrowserRouter([
  {
    element: <GuestOnly />,
    children: [
      { path: '/entrar', element: <LoginPage /> },
      { path: '/cadastro', element: <RegisterPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          {
            path: 'lancamentos',
            element: (
              <UpcomingPage
                title="Lançamentos"
                description="Receitas, despesas e transferências do mês, com filtros por conta, categoria e status."
              />
            ),
          },
          { path: 'contas', element: <AccountsPage /> },
          {
            path: 'orcamento',
            element: (
              <UpcomingPage
                title="Orçamento"
                description="Limite mensal por categoria e quanto já foi consumido."
              />
            ),
          },
          {
            path: 'projecao',
            element: (
              <UpcomingPage
                title="Projeção"
                description="Saldo dia a dia dos próximos meses, com o menor saldo e a data em que ficaria negativo."
              />
            ),
          },
          {
            path: 'recorrencias',
            element: (
              <UpcomingPage
                title="Recorrências"
                description="Salário, aluguel e assinaturas que geram lançamentos previstos todo mês."
              />
            ),
          },
          {
            path: 'configuracoes',
            element: <SettingsLayout />,
            children: [
              { index: true, element: <Navigate to="perfil" replace /> },
              { path: 'perfil', element: <ProfilePage /> },
              { path: 'seguranca', element: <SecurityPage /> },
              { path: 'alertas', element: <AlertsPage /> },
              { path: 'categorias', element: <CategoriesPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);

export function App() {
  return <RouterProvider router={router} />;
}
