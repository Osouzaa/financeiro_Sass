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
        description="Classificam receitas e despesas. Estas foram criadas para começar; edição e novas categorias chegam na próxima etapa."
      />

      {isPending ? (
        <p className="text-slate" role="status">
          Carregando categorias…
        </p>
      ) : error ? (
        <div role="alert" className="border-l-2 border-ember bg-ember-wash px-5 py-4">
          <p className="text-ember-deep">{error.message}</p>
          <button type="button" onClick={() => void refetch()} className="link-ember mt-2 text-sm">
            Tentar de novo
          </button>
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
          <CategoryGroup title="Despesas" categories={data.filter((c) => c.type === 'EXPENSE')} />
          <CategoryGroup title="Receitas" categories={data.filter((c) => c.type === 'INCOME')} />
        </div>
      )}
    </>
  );
}

function CategoryGroup({ title, categories }: { title: string; categories: CategoryDto[] }) {
  const headingId = `grupo-${title.toLowerCase()}`;
  return (
    <section aria-labelledby={headingId} className="card-editorial p-6 sm:p-10">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={headingId} className="text-2xl leading-tight">
          {title}
        </h2>
        <span className="tabular text-sm text-slate">
          {categories.length} {categories.length === 1 ? 'categoria' : 'categorias'}
        </span>
      </div>
      <ul className="mt-6 divide-y divide-mist border-t border-mist">
        {categories.map((category) => (
          <li key={category.id} className="py-4">
            <div className="flex items-center gap-3">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: category.color ?? 'var(--color-slate)' }}
                aria-hidden="true"
              />
              <span className="font-medium">{category.name}</span>
              {category.children.length > 0 ? (
                <span className="tabular ml-auto text-[13px] text-slate">
                  {category.children.length}
                </span>
              ) : null}
            </div>
            {category.children.length > 0 ? (
              <ul
                className="mt-3 flex flex-wrap gap-1.5 pl-5"
                aria-label={`Subcategorias de ${category.name}`}
              >
                {category.children.map((child) => (
                  <li
                    key={child.id}
                    className="rounded-[20px] bg-canvas px-3 py-1 text-[13px] text-steel"
                  >
                    {child.name}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
