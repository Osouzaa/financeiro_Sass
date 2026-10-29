import type { AccountDto, AccountRefDto, AccountType } from '@financeiro/shared';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Landmark, WalletMinimal, type LucideIcon } from 'lucide-react';
import { api } from '@/lib/api';

export const ACCOUNT_TYPES: {
  type: AccountType;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    type: 'CHECKING',
    label: 'Conta corrente',
    description: 'Banco ou conta digital',
    icon: Landmark,
  },
  { type: 'WALLET', label: 'Carteira', description: 'Dinheiro em espécie', icon: WalletMinimal },
  {
    type: 'CREDIT_CARD',
    label: 'Cartão de crédito',
    description: 'Com fatura e limite',
    icon: CreditCard,
  },
];

export const accountTypeMeta = (type: AccountType) =>
  ACCOUNT_TYPES.find((item) => item.type === type) ?? ACCOUNT_TYPES[0]!;

/** Paleta das contas: tons que funcionam como faixa e como fundo de cartão. */
export const ACCOUNT_COLORS = [
  '#ff682c',
  '#1d1d1f',
  '#8a05be',
  '#ec7000',
  '#cc092f',
  '#005ca9',
  '#00a868',
  '#816729',
];

export function useAccounts(includeArchived = false) {
  return useQuery({
    queryKey: ['accounts', { includeArchived }],
    queryFn: () => api<AccountDto[]>(`/accounts${includeArchived ? '?includeArchived=true' : ''}`),
  });
}

/** Contas ativas, mais a do lançamento em edição caso tenha sido arquivada depois. */
export function selectableAccounts(
  accounts: AccountDto[],
  keep: (AccountRefDto | null | undefined)[],
) {
  const list: AccountRefDto[] = [...accounts];
  for (const account of keep) {
    if (account && !list.some((item) => item.id === account.id)) list.push(account);
  }
  return list;
}
