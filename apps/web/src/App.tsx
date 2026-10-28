import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { GuestOnly, RequireAuth } from '@/features/auth/route-guards';
import { InvoicesPage } from '@/features/invoices/InvoicesPage';
import { ProjectionPage } from '@/features/projection/ProjectionPage';
import { RecurrencesPage } from '@/features/recurrences/RecurrencesPage';
import { AccountsPage } from '@/features/accounts/AccountsPage';
import { BudgetPage } from '@/features/budget/BudgetPage';
import { CategoriesPage } from '@/features/categories/CategoriesPage';
import { AlertsPage } from '@/features/settings/AlertsPage';
import { ProfilePage } from '@/features/settings/ProfilePage';
import { SecurityPage } from '@/features/settings/SecurityPage';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { TransactionsPage } from '@/features/transactions/TransactionsPage';
import { AppLayout } from '@/layout/AppLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

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
          { path: 'lancamentos', element: <TransactionsPage /> },
          { path: 'contas', element: <AccountsPage /> },
          { path: 'faturas', element: <InvoicesPage /> },
          { path: 'orcamento', element: <BudgetPage /> },
          { path: 'projecao', element: <ProjectionPage /> },
          { path: 'recorrencias', element: <RecurrencesPage /> },
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
