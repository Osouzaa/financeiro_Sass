import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '@/lib/api';
import { useAuth } from './auth-context';
import { AuthLayout } from './AuthLayout';

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{32,128}$/;

/** Abre pelo link do e-mail. Funciona logado ou não. */
export function VerifyEmailPage() {
  const [params, setParams] = useSearchParams();
  const { status, reloadUser } = useAuth();
  const [token] = useState(() => params.get('token') ?? '');
  const [result, setResult] = useState<'loading' | 'ok' | 'error'>(
    TOKEN_FORMAT.test(token) ? 'loading' : 'error',
  );
  const sent = useRef(false);

  useEffect(() => {
    if (params.has('token')) setParams({}, { replace: true });
  }, [params, setParams]);

  useEffect(() => {
    // StrictMode monta duas vezes; o link só pode ser usado uma
    if (sent.current || !TOKEN_FORMAT.test(token)) return;
    sent.current = true;
    api('/auth/verify-email', { method: 'POST', body: { token }, retryOnUnauthorized: false })
      .then(() => setResult('ok'))
      .catch(() => setResult('error'));
  }, [token]);

  useEffect(() => {
    if (result === 'ok' && status === 'authenticated') void reloadUser();
  }, [result, status, reloadUser]);

  const authenticated = status === 'authenticated';
  return (
    <AuthLayout
      title={
        result === 'ok'
          ? 'E-mail confirmado'
          : result === 'error'
            ? 'Não foi possível confirmar'
            : 'Confirmando seu e-mail…'
      }
      subtitle={
        result === 'ok'
          ? 'Pronto. Avisos e a recuperação de senha vão para este e-mail.'
          : result === 'error'
            ? 'O link expirou, já foi usado ou é de um e-mail que não está mais na conta.'
            : 'Só um instante.'
      }
      footer={
        <Link to={authenticated ? '/' : '/entrar'} className="link-ember">
          {authenticated ? 'Ir para o painel' : 'Ir para o login'}
        </Link>
      }
    >
      <div className="flex flex-col items-center gap-4 rounded-[14px] border border-line bg-canvas p-6 text-center text-sm text-steel">
        {result === 'loading' ? (
          <LoaderCircle size={28} className="animate-spin text-ember" aria-hidden="true" />
        ) : result === 'ok' ? (
          <CircleCheck size={32} className="text-positive" aria-hidden="true" />
        ) : (
          <>
            <CircleAlert size={32} className="text-negative" aria-hidden="true" />
            <p>
              {authenticated
                ? 'Peça um novo link pelo aviso no topo do painel.'
                : 'Entre na sua conta e peça um novo link pelo aviso no topo do painel.'}
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
