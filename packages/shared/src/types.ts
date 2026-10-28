import type {
  AccountType,
  CategoryType,
  InvoiceStatus,
  RecurrenceFrequency,
  TransactionStatus,
  TransactionType,
} from './enums';
import type { AlertPreferences } from './schemas/profile';

/** Contratos de resposta da API (o que o front recebe). */

export interface UserDto {
  id: string;
  name: string;
  email: string;
  /** Muda sempre que a foto muda; null quando não há foto. Usado para invalidar cache. */
  avatarVersion: string | null;
}

export interface ProfileDto extends UserDto {
  alerts: AlertPreferences;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  /** Validade do access token em segundos. */
  expiresIn: number;
  user: UserDto;
}

export interface SessionDto {
  id: string;
  userAgent: string | null;
  createdAt: string;
  current: boolean;
}

export interface CategoryDto {
  id: string;
  name: string;
  type: CategoryType;
  color: string | null;
  icon: string | null;
  parentId: string | null;
  archived: boolean;
  /** Lançamentos, recorrências e orçamentos que usam a categoria (sem contar subcategorias). */
  usageCount: number;
  children: CategoryDto[];
}

export interface AccountDto {
  id: string;
  name: string;
  type: AccountType;
  color: string | null;
  initialBalanceCents: number;
  initialBalanceDate: string;
  archived: boolean;
  /** Conta corrente/carteira: saldo atual. Cartão: total em aberto (dívida). */
  balanceCents: number;
  closingDay: number | null;
  dueDay: number | null;
  creditLimitCents: number | null;
  /** Limite − total em aberto. Só para cartão. */
  availableLimitCents: number | null;
  paymentAccountId: string | null;
}

/** Conta resumida, embutida em lançamentos. */
export interface AccountRefDto {
  id: string;
  name: string;
  type: AccountType;
  color: string | null;
}

export interface CategoryRefDto {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  parentId: string | null;
}

export interface TransactionDto {
  id: string;
  type: TransactionType;
  /** Sempre positivo; o tipo define o sinal. */
  amountCents: number;
  description: string;
  notes: string | null;
  /** Data de competência: quando aconteceu. */
  date: string;
  /** Quando o dinheiro entra ou sai. Nula em compras no cartão. */
  cashDate: string | null;
  status: TransactionStatus;
  account: AccountRefDto;
  category: CategoryRefDto | null;
  /** Só em transferências. */
  transfer: {
    groupId: string;
    /** IN: o dinheiro entra na `account`. OUT: sai dela. */
    direction: 'IN' | 'OUT';
    counterpart: AccountRefDto | null;
  } | null;
  /** Só em lançamentos no cartão de crédito. */
  invoice: { referenceMonth: string; dueDate: string } | null;
  /** Parcela de uma compra parcelada. */
  installment: { groupId: string; number: number; total: number } | null;
  /** Ocorrência gerada por uma recorrência. */
  recurrenceId: string | null;
}

export interface CategoryTotalDto {
  /** Categoria principal (subcategorias somam na categoria-mãe). */
  categoryId: string;
  name: string;
  color: string | null;
  icon: string | null;
  totalCents: number;
}

export interface TransactionSummaryDto {
  incomeCents: number;
  expenseCents: number;
  /** Receitas − despesas. Transferências não entram. */
  netCents: number;
  /** Parte das receitas/despesas que ainda está prevista. */
  plannedIncomeCents: number;
  plannedExpenseCents: number;
  /** Despesas por categoria, da maior para a menor. */
  expensesByCategory: CategoryTotalDto[];
}

export interface TransactionListDto {
  items: TransactionDto[];
  summary: TransactionSummaryDto;
  /** true quando o período tem mais lançamentos do que o limite da resposta. */
  truncated: boolean;
}

export interface InvoiceDto {
  id: string;
  account: AccountRefDto;
  /** Conta padrão de pagamento do cartão. */
  paymentAccountId: string | null;
  /** Mês do vencimento, `YYYY-MM`. */
  referenceMonth: string;
  closingDate: string;
  dueDate: string;
  /** Calculado na leitura a partir das datas e dos pagamentos. */
  status: InvoiceStatus;
  /** Vencida sem pagamento completo. */
  overdue: boolean;
  purchasesCents: number;
  /** Estornos abatidos na fatura. */
  refundsCents: number;
  /** Compras − estornos. */
  totalCents: number;
  /** Pagamentos realizados. */
  paidCents: number;
  /** Pagamentos agendados (previstos). */
  scheduledCents: number;
  /** Quanto falta pagar (nunca negativo). */
  remainingCents: number;
}

export interface InvoiceDetailDto extends InvoiceDto {
  /** Compras, estornos e pagamentos da fatura. */
  items: TransactionDto[];
}

export interface RecurrenceDto {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  account: AccountRefDto;
  category: CategoryRefDto | null;
  amountCents: number;
  description: string;
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate: string | null;
  /** Próxima ocorrência a partir de hoje; null se já terminou. */
  nextDate: string | null;
  /** Peso mensal do valor (semanal × 52 ÷ 12, anual ÷ 12). */
  monthlyCents: number;
  active: boolean;
}

export interface BudgetItemDto {
  id: string;
  category: CategoryRefDto;
  limitCents: number;
  /** Despesas realizadas no mês (no cartão, toda compra conta como realizada). */
  spentCents: number;
  /** Despesas ainda previstas no mês. */
  plannedCents: number;
  /** Realizado + previsto: o que o mês vai consumir. */
  usedCents: number;
}

export interface BudgetMonthDto {
  month: string;
  /** Percentual de alerta das preferências; null se o alerta de orçamento está desligado. */
  alertPercent: number | null;
  items: BudgetItemDto[];
  /** Categorias com gasto no mês e sem limite definido. */
  unbudgeted: { category: CategoryRefDto; usedCents: number }[];
  totals: { limitCents: number; spentCents: number; usedCents: number };
}

export interface ProjectionPointDto {
  date: string;
  balanceCents: number;
  inCents: number;
  outCents: number;
}

export interface ProjectionEventDto {
  date: string;
  description: string;
  /** Com sinal: positivo entra, negativo sai. */
  amountCents: number;
  kind: 'transaction' | 'invoice';
  accountName: string;
  /** Previsto para antes de hoje e ainda não realizado: entra na projeção como hoje. */
  overdue: boolean;
}

export interface ProjectionDto {
  from: string;
  to: string;
  /** Saldo atual das contas consideradas. */
  startBalanceCents: number;
  endBalanceCents: number;
  points: ProjectionPointDto[];
  lowest: { date: string; balanceCents: number };
  /** Primeiro dia em que o saldo ficaria negativo; null se não fica. */
  firstNegativeDate: string | null;
  events: ProjectionEventDto[];
}

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  /** Erros por campo, quando a validação falha. */
  fields?: Record<string, string[]>;
}
