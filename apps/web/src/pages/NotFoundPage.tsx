import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Página não encontrada</h1>
        <p className="mt-2 text-ink-soft">O endereço pode ter mudado ou estar incorreto.</p>
        <Link
          to="/"
          className="mt-6 inline-block font-semibold text-accent underline-offset-4 hover:underline"
        >
          Voltar para a visão geral
        </Link>
      </div>
    </div>
  );
}
