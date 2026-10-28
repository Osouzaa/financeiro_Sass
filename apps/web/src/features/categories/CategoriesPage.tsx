import type { CategoryDto, CategoryType } from '@financeiro/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { categoryIcon } from './category-icons';

const TABS: { type: CategoryType; label: string }[] = [
  { type: 'EXPENSE', label: 'Despesas' },
  { type: 'INCOME', label: 'Receitas' },
];

export function CategoriesPage() {
  const [tab, setTab] = useState<CategoryType>('EXPENSE');
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<CategoryDto[]>('/categories'),
  });

  const visible = (data ?? []).filter((category) => category.type === tab);
  const count = (type: CategoryType) => (data ?? []).filter((c) => c.type === type).length;

  return (
    <>
      <p className="mb-4 text-sm text-slate">
        Classificam receitas e despesas. Estas foram criadas para começar; edição e novas categorias
        chegam numa próxima etapa.
      </p>

      <div className="card overflow-hidden">
        <div
          role="tablist"
          aria-label="Tipo de categoria"
          className="flex gap-1 border-b border-line px-4 pt-3"
        >
          {TABS.map(({ type, label }) => (
            <button
              key={type}
              role="tab"
              type="button"
              aria-selected={tab === type}
              onClick={() => setTab(type)}
              className={`relative -mb-px flex items-center gap-2 border-b-2 px-3 pb-3 text-sm transition-colors ${
                tab === type
                  ? 'border-ember font-medium text-graphite'
                  : 'border-transparent text-slate hover:text-graphite'
              }`}
            >
              {label}
              <span className="tabular rounded-full bg-sunken px-2 py-0.5 text-[12px] text-slate">
                {count(type)}
              </span>
            </button>
          ))}
        </div>

        {isPending ? (
          <p className="px-6 py-10 text-slate" role="status">
            Carregando categorias…
          </p>
        ) : error ? (
          <div role="alert" className="px-6 py-10">
            <p className="text-negative">{error.message}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="link-ember mt-2 text-sm"
            >
              Tentar de novo
            </button>
          </div>
        ) : (
          <ul role="tabpanel" className="divide-y divide-line">
            {visible.map((category) => {
              const Icon = categoryIcon(category.icon);
              const color = category.color ?? '#7a7a80';
              return (
                <li
                  key={category.id}
                  className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-[220px] items-center gap-3">
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-[10px]"
                      style={{ background: `${color}1f`, color }}
                    >
                      <Icon size={19} strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-medium">{category.name}</p>
                      <p className="text-[13px] text-faint">
                        {category.children.length
                          ? `${category.children.length} subcategorias`
                          : 'Sem subcategorias'}
                      </p>
                    </div>
                  </div>
                  {category.children.length > 0 ? (
                    <ul
                      className="flex flex-wrap gap-1.5 sm:justify-end sm:pl-4 lg:flex-1"
                      aria-label={`Subcategorias de ${category.name}`}
                    >
                      {category.children.map((child) => (
                        <li
                          key={child.id}
                          className="rounded-full border border-line bg-canvas px-3 py-1 text-[13px] text-steel"
                        >
                          {child.name}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
