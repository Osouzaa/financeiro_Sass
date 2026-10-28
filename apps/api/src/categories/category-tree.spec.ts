import { buildCategoryTree } from './category-tree';
import { DEFAULT_CATEGORIES } from './default-categories';

const row = (id: string, name: string, parentId: string | null = null) => ({
  id,
  name,
  type: 'EXPENSE',
  color: null,
  icon: null,
  parentId,
  archived: false,
  usageCount: 0,
});

describe('buildCategoryTree', () => {
  it('aninha subcategorias e ordena por nome em pt-BR', () => {
    const tree = buildCategoryTree([
      row('3', 'Mercado', '1'),
      row('1', 'Alimentação'),
      row('4', 'Delivery', '1'),
      row('2', 'Água'),
    ]);

    expect(tree.map((c) => c.name)).toEqual(['Água', 'Alimentação']);
    expect(tree[1]?.children.map((c) => c.name)).toEqual(['Delivery', 'Mercado']);
  });

  it('subcategoria órfã (pai arquivado) aparece na raiz', () => {
    const tree = buildCategoryTree([row('3', 'Mercado', 'arquivada')]);
    expect(tree).toHaveLength(1);
  });
});

describe('DEFAULT_CATEGORIES', () => {
  it('não tem nomes repetidos', () => {
    const names = DEFAULT_CATEGORIES.flatMap((c) => [c.name, ...(c.children ?? [])]);
    expect(new Set(names).size).toBe(names.length);
  });
});
