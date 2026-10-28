import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';
import { AuthShowcase } from './AuthShowcase';

/** Tela de entrada: formulário à esquerda, painel ilustrativo do produto à direita. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-16 xl:px-24">
        <Logo size={30} />

        <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">
          <h1 className="text-[30px] leading-tight font-semibold">{title}</h1>
          <p className="mt-2 text-[15px] text-slate">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-8 text-center text-sm text-slate">{footer}</div>
        </main>

        <p className="text-[13px] text-faint">© {new Date().getFullYear()} Financeiro</p>
      </div>

      <div className="hidden p-3 lg:block">
        <AuthShowcase />
      </div>
    </div>
  );
}
