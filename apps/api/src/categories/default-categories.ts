import { CategoryType } from '@financeiro/shared';

/**
 * Categorias criadas para todo usuário novo. Ele pode editar, arquivar ou criar outras.
 * Ícones seguem os nomes do lucide-react (usado no front).
 */
export interface DefaultCategory {
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  children?: string[];
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // Despesas
  {
    name: 'Moradia',
    type: 'EXPENSE',
    color: '#8B5CF6',
    icon: 'house',
    children: ['Aluguel', 'Condomínio', 'Energia', 'Água', 'Internet e telefone', 'Manutenção'],
  },
  {
    name: 'Alimentação',
    type: 'EXPENSE',
    color: '#F97316',
    icon: 'utensils',
    children: ['Mercado', 'Restaurantes', 'Delivery', 'Padaria e lanches'],
  },
  {
    name: 'Transporte',
    type: 'EXPENSE',
    color: '#0EA5E9',
    icon: 'car',
    children: [
      'Combustível',
      'Transporte público',
      'Aplicativos',
      'Estacionamento',
      'Manutenção do veículo',
      'Seguro e IPVA',
    ],
  },
  {
    name: 'Saúde',
    type: 'EXPENSE',
    color: '#EF4444',
    icon: 'heart-pulse',
    children: ['Plano de saúde', 'Farmácia', 'Consultas e exames', 'Academia'],
  },
  {
    name: 'Educação',
    type: 'EXPENSE',
    color: '#14B8A6',
    icon: 'graduation-cap',
    children: ['Cursos', 'Livros', 'Mensalidade escolar'],
  },
  {
    name: 'Lazer',
    type: 'EXPENSE',
    color: '#EC4899',
    icon: 'party-popper',
    children: ['Assinaturas e streaming', 'Viagens', 'Passeios', 'Hobbies'],
  },
  {
    name: 'Compras',
    type: 'EXPENSE',
    color: '#F59E0B',
    icon: 'shopping-bag',
    children: ['Roupas', 'Eletrônicos', 'Casa', 'Presentes'],
  },
  { name: 'Cuidados pessoais', type: 'EXPENSE', color: '#A855F7', icon: 'sparkles' },
  { name: 'Pets', type: 'EXPENSE', color: '#84CC16', icon: 'paw-print' },
  { name: 'Impostos e taxas', type: 'EXPENSE', color: '#64748B', icon: 'landmark' },
  { name: 'Juros e tarifas', type: 'EXPENSE', color: '#DC2626', icon: 'percent' },
  { name: 'Outras despesas', type: 'EXPENSE', color: '#6B7280', icon: 'circle-ellipsis' },
  // Receitas
  { name: 'Salário', type: 'INCOME', color: '#22C55E', icon: 'briefcase' },
  { name: 'Freelance', type: 'INCOME', color: '#10B981', icon: 'laptop' },
  { name: 'Rendimentos', type: 'INCOME', color: '#059669', icon: 'trending-up' },
  { name: 'Reembolsos', type: 'INCOME', color: '#06B6D4', icon: 'undo-2' },
  { name: 'Outras receitas', type: 'INCOME', color: '#16A34A', icon: 'circle-plus' },
];
