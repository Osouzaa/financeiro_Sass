import type { CategoryDto } from '@financeiro/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/layout/AppLayout';

export function CategoriesPage() {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<CategoryDto[]>('/categories'),
  });

  return (
    <>
      <PageHeader
        title="Categorias"
        description="Usadas para classificar receitas e despesas. Criamos estas para começar; edição e novas categorias chegam na próxima etapa."
      />

      {isPending ? (
        <p className="text-ink-faint" role="status">
          Carregando categorias…
        </p>
      ) : error ? (
        <div role="alert" className="text-[15px]">
          <p className="text-expense">{error.message}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-2 font-semibold text-accent"
          >
            Tentar de novo
          </button>
        </div>
      ) : (
        <div className="grid gap-8 md:grid-cols-2">
          <CategoryGroup title="Despesas" categories={data.filter((c) => c.type === 'EXPENSE')} />
          <CategoryGroup title="Receitas" categories={data.filter((c) => c.type === 'INCOME')} />
        </div>
      )}
    </>
  );
}

function CategoryGroup({ title, categories }: { title: string; categories: CategoryDto[] }) {
  return (
    <section aria-labelledby={`grupo-${title}`}>
      <h2 id={`grupo-${title}`} className="mb-3 text-lg font-semibold">
        {title} <span className="tabular font-normal text-ink-faint">({categories.length})</span>
      </h2>
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {categories.map((category) => (
          <li key={category.id} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: category.color ?? 'var(--color-ink-faint)' }}
                aria-hidden="true"
              />
              <span className="font-medium">{category.name}</span>
            </div>
            {category.children.length > 0 ? (
              <p className="mt-1 pl-5.5 text-sm text-ink-soft">
                {category.children.map((child) => child.name).join(', ')}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
