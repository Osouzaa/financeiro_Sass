import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { VerifyEmailPage } from '@/features/auth/VerifyEmailPage';
import { GuestOnly, RequireAuth } from '@/features/auth/route-guards';
import { InvoicesPage } from '@/features/invoices/InvoicesPage';
import { LandingPage } from '@/features/landing/LandingPage';
import { PrivacyPage, TermsPage } from '@/features/legal/LegalPages';
import { ProjectionPage } from '@/features/projection/ProjectionPage';
import { RecurrencesPage } from '@/features/recurrences/RecurrencesPage';
import { AccountsPage } from '@/features/accounts/AccountsPage';
import { AdminAuditPage } from '@/features/admin/AdminAuditPage';
import { AdminBillingPage } from '@/features/admin/AdminBillingPage';
import { AdminLayout } from '@/features/admin/AdminLayout';
import { AdminOverviewPage } from '@/features/admin/AdminOverviewPage';
import { AdminPlansPage } from '@/features/admin/AdminPlansPage';
import { AdminUsersPage } from '@/features/admin/AdminUsersPage';
import { BudgetPage } from '@/features/budget/BudgetPage';
import { CategoriesPage } from '@/features/categories/CategoriesPage';
import { AlertsPage } from '@/features/settings/AlertsPage';
import { PlanPage } from '@/features/settings/PlanPage';
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
      { path: '/recuperar-senha', element: <ForgotPasswordPage /> },
    ],
  },
  // Fora dos guards: o link do e-mail precisa abrir mesmo com alguém logado neste navegador
  { path: '/redefinir-senha', element: <ResetPasswordPage /> },
  { path: '/verificar-email', element: <VerifyEmailPage /> },
  // A divulgação também abre para quem está logado
  { path: '/inicio', element: <LandingPage /> },
  { path: '/termos', element: <TermsPage /> },
  { path: '/privacidade', element: <PrivacyPage /> },
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
              { path: 'plano', element: <PlanPage /> },
              { path: 'alertas', element: <AlertsPage /> },
              { path: 'categorias', element: <CategoriesPage /> },
            ],
          },
          {
            path: 'admin',
            element: <AdminLayout />,
            children: [
              { index: true, element: <AdminOverviewPage /> },
              { path: 'usuarios', element: <AdminUsersPage /> },
              { path: 'planos', element: <AdminPlansPage /> },
              { path: 'pagamentos', element: <AdminBillingPage /> },
              { path: 'auditoria', element: <AdminAuditPage /> },
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
