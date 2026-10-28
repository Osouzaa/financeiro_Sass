import type { AccountRefDto } from '@financeiro/shared';

/** Opções de conta para um <select>, separando contas e cartões. */
export function AccountOptions({ accounts }: { accounts: AccountRefDto[] }) {
  const cash = accounts.filter((a) => a.type !== 'CREDIT_CARD');
  const cards = accounts.filter((a) => a.type === 'CREDIT_CARD');
  return (
    <>
      {cash.length ? (
        <optgroup label="Contas">
          {cash.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </optgroup>
      ) : null}
      {cards.length ? (
        <optgroup label="Cartões de crédito">
          {cards.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </optgroup>
      ) : null}
    </>
  );
}
