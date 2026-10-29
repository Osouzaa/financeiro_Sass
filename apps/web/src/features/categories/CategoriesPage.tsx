import type { CategoryDto, CategoryType } from '@financeiro/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, Pencil, Plus, Shapes, Trash2 } from 'lucide-react';
import { createElement, useState } from 'react';
import { Button } from '@/components/form';
import { Switch } from '@/components/inputs';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { categoryIcon } from './category-icons';
import { CategoryFormModal } from './CategoryFormModal';
import { useCategories } from './use-categories';

const TABS: { type: CategoryType; label: string }[] = [
  { type: 'EXPENSE', label: 'Despesas' },
  { type: 'INCOME', label: 'Receitas' },
];

type Editing =
  { mode: 'create'; parentId?: string } | { mode: 'edit'; category: CategoryDto } | null;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const totalUsage = (category: CategoryDto): number =>
  category.usageCount + category.children.reduce((sum, child) => sum + child.usageCount, 0);

function useInvalidateCategories() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['categories'] }),
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
    ]);
}

export function CategoriesPage() {
  const [tab, setTab] = useState<CategoryType>('EXPENSE');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<CategoryDto | null>(null);
  const { data, isPending, error, refetch } = useCategories(showArchived);

  const visible = (data ?? []).filter((category) => category.type === tab);
  const count = (type: CategoryType) =>
    (data ?? []).filter((c) => c.type === type && !c.archived).length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-[60ch] text-sm text-slate">
          Classificam receitas e despesas. Subcategorias somam na categoria principal nos gráficos e
          herdam a cor dela. Categorias já usadas não são excluídas: arquive para tirá-las das
          listas sem perder o histórico.
        </p>
        <Button type="button" onClick={() => setEditing({ mode: 'create' })}>
          <Plus size={18} aria-hidden="true" /> Nova categoria
        </Button>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-line">
        <div role="tablist" aria-label="Tipo de categoria" className="flex gap-1">
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
        <div className="pb-3">
          <Switch checked={showArchived} onChange={setShowArchived} label="Mostrar arquivadas" />
        </div>
      </div>

      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="card h-[148px] animate-pulse bg-sunken/40" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="card px-6 py-10">
          <p className="text-negative">{error.message}</p>
          <button type="button" onClick={() => void refetch()} className="link-ember mt-2 text-sm">
            Tentar de novo
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-ember-soft text-ember-deep">
            <Shapes size={26} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <p className="mt-5 font-display text-xl font-semibold">
            Nenhuma categoria de {tab === 'INCOME' ? 'receita' : 'despesa'}
          </p>
          <Button type="button" className="mt-6" onClick={() => setEditing({ mode: 'create' })}>
            <Plus size={18} aria-hidden="true" /> Nova categoria
          </Button>
        </div>
      ) : (
        <ul role="tabpanel" className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {visible.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onEdit={(target) => setEditing({ mode: 'edit', category: target })}
              onAddChild={() => setEditing({ mode: 'create', parentId: category.id })}
              onDelete={() => setDeleting(category)}
            />
          ))}
        </ul>
      )}

      {editing ? (
        <CategoryFormModal
          type={tab}
          category={editing.mode === 'edit' ? editing.category : undefined}
          parentId={editing.mode === 'create' ? editing.parentId : undefined}
          onClose={() => setEditing(null)}
          extraActions={
            editing.mode === 'edit' && editing.category.parentId ? (
              <SubcategoryActions
                category={editing.category}
                onDone={() => setEditing(null)}
                onDelete={() => {
                  setDeleting(editing.category);
                  setEditing(null);
                }}
              />
            ) : undefined
          }
        />
      ) : null}
      {deleting ? <DeleteModal category={deleting} onClose={() => setDeleting(null)} /> : null}
    </>
  );
}

function useArchive(category: CategoryDto, onDone?: () => void) {
  const invalidate = useInvalidateCategories();
  const notify = useToast();
  return useMutation({
    mutationFn: () =>
      api<CategoryDto>(
        `/categories/${category.id}/${category.archived ? 'unarchive' : 'archive'}`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      void invalidate();
      notify(category.archived ? `${category.name} reativada` : `${category.name} arquivada`);
      onDone?.();
    },
    onError: (error) => notify(error.message, 'error'),
  });
}

function CategoryCard({
  category,
  onEdit,
  onAddChild,
  onDelete,
}: {
  category: CategoryDto;
  onEdit: (category: CategoryDto) => void;
  onAddChild: () => void;
  onDelete: () => void;
}) {
  const archive = useArchive(category);
  const color = category.color ?? '#7a7a80';
  const usage = totalUsage(category);
  const action =
    'grid size-8 place-items-center rounded-[8px] text-slate transition-colors hover:bg-sunken hover:text-graphite';

  return (
    <li className={`card flex flex-col overflow-hidden ${category.archived ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3 p-4 pb-3">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-[12px] text-white"
          style={{ background: color }}
        >
          {createElement(categoryIcon(category.icon), {
            size: 20,
            strokeWidth: 1.75,
            'aria-hidden': true,
          })}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{category.name}</h3>
          <p className="text-[13px] text-slate">
            {category.archived
              ? 'Arquivada'
              : usage > 0
                ? `Usada ${plural(usage, 'vez', 'vezes')}`
                : 'Ainda não usada'}
          </p>
        </div>
        <div className="flex gap-0.5">
          <button
            type="button"
            onClick={() => onEdit(category)}
            className={action}
            aria-label={`Editar ${category.name}`}
            title="Editar"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={() => archive.mutate()}
            disabled={archive.isPending}
            className={action}
            aria-label={`${category.archived ? 'Reativar' : 'Arquivar'} ${category.name}`}
            title={category.archived ? 'Reativar' : 'Arquivar'}
          >
            {category.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className={action}
            aria-label={`Excluir ${category.name}`}
            title="Excluir"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="mt-auto border-t border-line px-4 py-3" style={{ background: `${color}0a` }}>
        <ul className="flex flex-wrap gap-1.5" aria-label={`Subcategorias de ${category.name}`}>
          {category.children.map((child) => (
            <li key={child.id}>
              <button
                type="button"
                onClick={() => onEdit(child)}
                className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[13px] text-steel transition-colors hover:border-line-strong hover:text-graphite ${
                  child.archived ? 'line-through opacity-60' : ''
                }`}
                title={`Editar ${child.name}`}
              >
                <span className="size-1.5 rounded-full" style={{ background: color }} />
                {child.name}
                {child.usageCount > 0 ? (
                  <span className="tabular text-[11px] text-faint">{child.usageCount}</span>
                ) : null}
              </button>
            </li>
          ))}
          {!category.archived ? (
            <li>
              <button
                type="button"
                onClick={onAddChild}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-line-strong px-3 py-1 text-[13px] text-slate transition-colors hover:border-ember hover:text-ember-deep"
              >
                <Plus size={13} aria-hidden="true" /> Subcategoria
              </button>
            </li>
          ) : null}
        </ul>
      </div>
    </li>
  );
}

function SubcategoryActions({
  category,
  onDone,
  onDelete,
}: {
  category: CategoryDto;
  onDone: () => void;
  onDelete: () => void;
}) {
  const archive = useArchive(category, onDone);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        loading={archive.isPending}
        onClick={() => archive.mutate()}
      >
        {category.archived ? 'Reativar' : 'Arquivar'}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="!text-negative hover:!bg-negative-soft"
        onClick={onDelete}
      >
        Excluir
      </Button>
    </>
  );
}

function DeleteModal({ category, onClose }: { category: CategoryDto; onClose: () => void }) {
  const invalidate = useInvalidateCategories();
  const notify = useToast();
  const archive = useArchive(category, onClose);
  const usage = totalUsage(category);
  const remove = useMutation({
    mutationFn: () => api(`/categories/${category.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void invalidate();
      notify('Categoria excluída');
      onClose();
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={usage > 0 ? `${category.name} já foi usada` : `Excluir ${category.name}?`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          {usage > 0 ? (
            !category.archived ? (
              <Button type="button" loading={archive.isPending} onClick={() => archive.mutate()}>
                <Archive size={16} aria-hidden="true" /> Arquivar
              </Button>
            ) : null
          ) : (
            <Button
              type="button"
              className="!bg-negative hover:!bg-[#a92e26]"
              loading={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Excluir
            </Button>
          )}
        </>
      }
    >
      <p className="text-[15px] text-steel">
        {usage > 0
          ? `Ela aparece em ${plural(usage, 'lançamento', 'lançamentos')}${
              category.children.length ? ' (somando as subcategorias)' : ''
            }. Para não bagunçar o histórico, arquive: ela some dos seletores e continua nos relatórios.`
          : category.children.length
            ? `As ${category.children.length} subcategorias também serão excluídas. Não dá para desfazer.`
            : 'A exclusão não pode ser desfeita.'}
      </p>
      {remove.error ? (
        <p
          role="alert"
          className="mt-4 rounded-[10px] bg-negative-soft px-4 py-3 text-sm text-negative"
        >
          {remove.error.message}
        </p>
      ) : null}
    </Modal>
  );
}
