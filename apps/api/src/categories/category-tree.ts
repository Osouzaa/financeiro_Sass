import type { CategoryDto, CategoryType } from '@financeiro/shared';

export interface CategoryRow {
  id: string;
  name: string;
  type: string;
  color: string | null;
  icon: string | null;
  parentId: string | null;
  archived: boolean;
  usageCount: number;
}

/** Monta a árvore categoria > subcategorias, ordenada por nome (pt-BR). */
export function buildCategoryTree(rows: CategoryRow[]): CategoryDto[] {
  const nodes = new Map<string, CategoryDto>();
  for (const row of rows) {
    nodes.set(row.id, { ...row, type: row.type as CategoryType, children: [] });
  }

  const roots: CategoryDto[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const collator = new Intl.Collator('pt-BR');
  const sort = (list: CategoryDto[]) => {
    list.sort((a, b) => collator.compare(a.name, b.name));
    list.forEach((item) => sort(item.children));
  };
  sort(roots);
  return roots;
}
