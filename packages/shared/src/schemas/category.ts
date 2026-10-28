import { z } from 'zod';
import { CategoryType } from '../enums';

/**
 * Ícones aceitos (nomes do lucide). A lista é fechada: o banco só guarda
 * nomes conhecidos e o front tem um componente para cada um.
 */
export const CATEGORY_ICONS = [
  'house',
  'utensils',
  'coffee',
  'car',
  'fuel',
  'bus',
  'bike',
  'plane',
  'heart-pulse',
  'pill',
  'stethoscope',
  'dumbbell',
  'graduation-cap',
  'book-open',
  'party-popper',
  'music',
  'gamepad-2',
  'tv',
  'shopping-bag',
  'shirt',
  'gift',
  'cake',
  'sparkles',
  'baby',
  'paw-print',
  'smartphone',
  'wifi',
  'zap',
  'droplet',
  'wrench',
  'building-2',
  'landmark',
  'percent',
  'receipt',
  'briefcase',
  'laptop',
  'trending-up',
  'piggy-bank',
  'hand-coins',
  'banknote',
  'wallet',
  'undo-2',
  'circle-plus',
  'circle-ellipsis',
  'tag',
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

/**
 * Cadastro e edição de categoria. Subcategorias (com `parentId`) herdam cor
 * e ícone da categoria principal, então esses campos só valem na raiz.
 */
export const categoryInputSchema = z.object({
  name: z
    .string({ error: 'Informe um nome' })
    .trim()
    .min(1, { error: 'Informe um nome' })
    .max(60, { error: 'Nome muito longo' }),
  type: z.enum([CategoryType.INCOME, CategoryType.EXPENSE], {
    error: 'Escolha receita ou despesa',
  }),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, { error: 'Cor inválida' })
    .nullish(),
  icon: z.enum(CATEGORY_ICONS, { error: 'Ícone inválido' }).nullish(),
  parentId: z.guid({ error: 'Categoria inválida' }).nullish(),
});
export type CategoryInput = z.input<typeof categoryInputSchema>;
export type CategoryInputParsed = z.output<typeof categoryInputSchema>;
