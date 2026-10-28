import { Link } from 'react-router';
import { Logo } from '@/components/Logo';

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col px-6 py-8 sm:px-10">
      <Logo />
      <div className="my-auto max-w-xl py-16">
        <p className="font-display text-[clamp(4rem,12vw,8rem)] leading-[0.91] tracking-[-0.02em] text-slate">
          404
        </p>
        <h1 className="mt-6 text-[32px] leading-[1.19]">Página não encontrada</h1>
        <p className="mt-3 text-lg text-steel">O endereço pode ter mudado ou estar incorreto.</p>
        <Link to="/" className="link-ember mt-8 inline-block">
          Voltar para a visão geral
        </Link>
      </div>
    </div>
  );
}
