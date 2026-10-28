import {
  CATEGORY_ICONS,
  categoryInputSchema,
  type CategoryDto,
  type CategoryInput,
  type CategoryInputParsed,
  type CategoryType,
} from '@financeiro/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { createElement, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Button, FormAlert, TextField } from '@/components/form';
import { Field, Select } from '@/components/inputs';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/toast';
import { applyServerErrors } from '@/features/auth/apply-server-errors';
import { api, ApiError } from '@/lib/api';
import { CATEGORY_COLORS, CATEGORY_ICON_COMPONENTS, categoryIcon } from './category-icons';
import { useCategories } from './use-categories';

const FORM_ID = 'category-form';

/**
 * Cadastro e edição de categoria ou subcategoria. Montado só quando aberto.
 * Renderize fora de outros <form>: o <dialog> fica no DOM do componente pai.
 */
export function CategoryFormModal({
  category,
  type: initialType,
  parentId: presetParentId,
  lockType = false,
  onClose,
  onSaved,
  extraActions,
}: {
  /** Categoria em edição. */
  category?: CategoryDto;
  type: CategoryType;
  /** Abre já como subcategoria desta principal. */
  parentId?: string | null;
  /** Impede trocar entre receita e despesa (ex.: criada de dentro de um lançamento). */
  lockType?: boolean;
  onClose: () => void;
  onSaved?: (category: CategoryDto) => void;
  /** Ações extras no rodapé, na edição. */
  extraActions?: React.ReactNode;
}) {
  const notify = useToast();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories();
  const [formError, setFormError] = useState<string>();
  const editing = Boolean(category);
  const hasChildren = (category?.children.length ?? 0) > 0;

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CategoryInput, unknown, CategoryInputParsed>({
    resolver: zodResolver(categoryInputSchema),
    defaultValues: {
      name: category?.name ?? '',
      type: category?.type ?? initialType,
      color: category?.color ?? CATEGORY_COLORS[0],
      icon: (category?.icon as CategoryInput['icon']) ?? 'tag',
      parentId: category ? category.parentId : (presetParentId ?? null),
    },
  });

  const [type, name, color, icon, parentId] = useWatch({
    control,
    name: ['type', 'name', 'color', 'icon', 'parentId'],
  });
  const roots = categories.filter((c) => c.type === type && c.id !== category?.id);
  const parent = roots.find((c) => c.id === parentId);
  const isSub = Boolean(parentId);

  // A prévia mostra o que vai aparecer nas listas: subcategoria herda cor e ícone
  const previewColor = (isSub ? parent?.color : color) ?? '#7a7a80';
  const previewIcon = categoryIcon((isSub ? parent?.icon : icon) ?? null);
  const canPickType = !editing && !presetParentId && !lockType;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      const saved = await api<CategoryDto>(
        category ? `/categories/${category.id}` : '/categories',
        { method: category ? 'PUT' : 'POST', body: values },
      );
      // Nome e cor aparecem nos lançamentos: as duas listas precisam ser recarregadas
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['categories'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      ]);
      notify(editing ? 'Categoria atualizada' : isSub ? 'Subcategoria criada' : 'Categoria criada');
      onSaved?.(saved);
      onClose();
    } catch (error) {
      const message = applyServerErrors(error, setError);
      if (!(error instanceof ApiError) || Object.keys(error.fields).length === 0) {
        setFormError(message);
      }
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={
        editing
          ? `Editar ${category!.parentId ? 'subcategoria' : 'categoria'}`
          : isSub
            ? 'Nova subcategoria'
            : 'Nova categoria'
      }
      footer={
        <>
          {extraActions ? <div className="mr-auto flex gap-1">{extraActions}</div> : null}
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} loading={isSubmitting}>
            {editing ? 'Salvar' : 'Criar'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {/* Prévia ao vivo */}
        <div
          className="flex items-center gap-4 rounded-[14px] p-4 transition-colors"
          style={{ background: `${previewColor}14` }}
          aria-hidden="true"
        >
          <span
            className="grid size-12 shrink-0 place-items-center rounded-[12px] text-white shadow-sm transition-colors"
            style={{ background: previewColor }}
          >
            {createElement(previewIcon, { size: 22, strokeWidth: 1.75 })}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold">
              {name?.trim() || (isSub ? 'Nova subcategoria' : 'Nova categoria')}
            </p>
            <p className="text-[13px] text-slate">
              {type === 'INCOME' ? 'Receita' : 'Despesa'}
              {parent ? ` · dentro de ${parent.name}` : ''}
            </p>
          </div>
        </div>

        <FormAlert message={formError} />

        {canPickType ? (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Tipo</legend>
            <div className="flex gap-1 rounded-[12px] bg-sunken p-1">
              {(['EXPENSE', 'INCOME'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={type === value}
                  onClick={() => {
                    setValue('type', value);
                    setValue('parentId', null);
                  }}
                  className={`h-10 flex-1 rounded-[9px] text-sm font-medium transition-colors ${
                    type === value
                      ? `bg-surface shadow-sm ${value === 'INCOME' ? 'text-positive' : 'text-negative'}`
                      : 'text-slate hover:text-graphite'
                  }`}
                >
                  {value === 'INCOME' ? 'Receita' : 'Despesa'}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        <TextField
          label="Nome"
          placeholder={type === 'INCOME' ? 'Ex.: Aluguel recebido' : 'Ex.: Viagens, Academia'}
          autoComplete="off"
          maxLength={60}
          autoFocus
          error={errors.name?.message}
          {...register('name')}
        />

        <Field
          label="Dentro de"
          error={errors.parentId?.message}
          hint={
            hasChildren
              ? 'Tem subcategorias, então continua sendo uma categoria principal.'
              : 'Subcategorias somam no total da categoria principal nos gráficos.'
          }
        >
          <Select
            error={errors.parentId?.message}
            disabled={hasChildren}
            {...register('parentId', { setValueAs: (v) => v || null })}
          >
            <option value="">Nenhuma: é uma categoria principal</option>
            {roots.map((root) => (
              <option key={root.id} value={root.id}>
                {root.name}
              </option>
            ))}
          </Select>
        </Field>

        {isSub ? (
          <p className="-mt-2 text-[13px] text-slate">
            Cor e ícone vêm de {parent?.name ?? 'categoria principal'}.
          </p>
        ) : (
          <>
            <Controller
              control={control}
              name="color"
              render={({ field }) => (
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium">Cor</legend>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORY_COLORS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => field.onChange(value)}
                        className="grid size-8 place-items-center rounded-full ring-offset-2 transition-shadow aria-pressed:ring-2 aria-pressed:ring-graphite"
                        style={{ background: value }}
                        aria-pressed={field.value === value}
                        aria-label={`Cor ${value}`}
                      >
                        {field.value === value ? <Check size={15} className="text-white" /> : null}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
            />

            <Controller
              control={control}
              name="icon"
              render={({ field }) => (
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium">Ícone</legend>
                  <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-9">
                    {CATEGORY_ICONS.map((value) => {
                      const selected = field.value === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => field.onChange(value)}
                          aria-pressed={selected}
                          aria-label={`Ícone ${value}`}
                          title={value}
                          className={`grid aspect-square place-items-center rounded-[10px] border transition-colors ${
                            selected
                              ? 'border-transparent text-white'
                              : 'border-line text-steel hover:bg-sunken hover:text-graphite'
                          }`}
                          style={selected ? { background: color ?? '#1d1d1f' } : undefined}
                        >
                          {createElement(CATEGORY_ICON_COMPONENTS[value], {
                            size: 18,
                            strokeWidth: 1.75,
                          })}
                        </button>
                      );
                    })}
                  </div>
                  {errors.icon?.message ? (
                    <p className="mt-1.5 text-[13px] text-negative">{errors.icon.message}</p>
                  ) : null}
                </fieldset>
              )}
            />
          </>
        )}
      </form>
    </Modal>
  );
}
