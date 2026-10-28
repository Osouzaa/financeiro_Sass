import { buildCategoryTree } from './category-tree';
import { DEFAULT_CATEGORIES } from './default-categories';

describe('buildCategoryTree', () => {
  it('aninha subcategorias e ordena por nome em pt-BR', () => {
    const tree = buildCategoryTree([
      { id: '3', name: 'Mercado', type: 'EXPENSE', color: null, icon: null, parentId: '1' },
      { id: '1', name: 'Alimentação', type: 'EXPENSE', color: null, icon: null, parentId: null },
      { id: '4', name: 'Delivery', type: 'EXPENSE', color: null, icon: null, parentId: '1' },
      { id: '2', name: 'Água', type: 'EXPENSE', color: null, icon: null, parentId: null },
    ]);

    expect(tree.map((c) => c.name)).toEqual(['Água', 'Alimentação']);
    expect(tree[1]?.children.map((c) => c.name)).toEqual(['Delivery', 'Mercado']);
  });

  it('subcategoria órfã (pai arquivado) aparece na raiz', () => {
    const tree = buildCategoryTree([
      { id: '3', name: 'Mercado', type: 'EXPENSE', color: null, icon: null, parentId: 'arquivada' },
    ]);
    expect(tree).toHaveLength(1);
  });
});

describe('DEFAULT_CATEGORIES', () => {
  it('não tem nomes repetidos', () => {
    const names = DEFAULT_CATEGORIES.flatMap((c) => [c.name, ...(c.children ?? [])]);
    expect(new Set(names).size).toBe(names.length);
  });
});
