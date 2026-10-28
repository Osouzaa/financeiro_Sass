import { Navigate, Outlet, useLocation } from 'react-router';
import { LogoMark } from '@/components/Logo';
import { useAuth } from './auth-context';

function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status">
      <div className="flex flex-col items-center gap-4 text-sm text-slate">
        <LogoMark size={40} className="animate-pulse motion-reduce:animate-none" />
        Carregando…
      </div>
    </div>
  );
}

/** Rotas que exigem login. Guarda a página pedida para voltar a ela depois. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'anonymous')
    return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Telas de login/cadastro: quem já está logado vai direto para o app. */
export function GuestOnly() {
  const { status } = useAuth();
  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <Outlet />;
}
