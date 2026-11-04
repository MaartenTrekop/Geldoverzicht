import { accountLabel, isAccountKey } from '../categorization/counterparty';
import { Owner } from '../models/owner';
import { Transaction } from '../models/transaction';

/** One of the user's other accounts that the main account transfers money to. */
export interface OwnAccountSummary {
  readonly iban: string;
  readonly key: string;
  readonly label: string;
  /** Name the bank shows for the account holder, used as a placeholder. */
  readonly holderName: string;
  /** The account's own export is imported too. */
  readonly inExport: boolean;
  /** Net amount moved to this account per month over the history. */
  readonly monthlyNet: number;
  readonly category: string;
  readonly owner: Owner;
}

interface LedgerView {
  readonly transactions: readonly Transaction[];
  readonly ownAccounts: ReadonlySet<string>;
  readonly mainAccount: string | null;
}

export function summarizeOwnAccounts(
  ledger: LedgerView,
  history: readonly Transaction[],
  historyMonths: number,
  accountNames: Readonly<Record<string, string>>,
): OwnAccountSummary[] {
  const fromMain = (tx: Transaction) =>
    isAccountKey(tx.key) && (!ledger.mainAccount || tx.account === ledger.mainAccount);

  const accounts = new Map<
    string,
    { iban: string; key: string; holder: string; category: string; owner: Owner }
  >();
  for (const tx of ledger.transactions) {
    if (!fromMain(tx)) continue;
    accounts.set(tx.counterpartyIban, {
      iban: tx.counterpartyIban,
      key: tx.key,
      holder: tx.counterpartyName,
      category: tx.category,
      owner: tx.owner,
    });
  }

  const net = new Map<string, number>();
  for (const tx of history) {
    if (fromMain(tx)) net.set(tx.counterpartyIban, (net.get(tx.counterpartyIban) ?? 0) - tx.amount);
  }

  return [...accounts.values()]
    .map((a) => ({
      iban: a.iban,
      key: a.key,
      label: accountLabel(a.iban, accountNames, a.holder),
      holderName: a.holder,
      inExport: ledger.ownAccounts.has(a.iban),
      monthlyNet: (net.get(a.iban) ?? 0) / Math.max(1, historyMonths),
      category: a.category,
      owner: a.owner,
    }))
    .sort((a, b) => b.monthlyNet - a.monthlyNet);
}

/** Accounts a savings pot can be linked to: every own account except the main one. */
export function linkableAccounts(
  ledger: LedgerView,
  accountNames: Readonly<Record<string, string>>,
): { iban: string; label: string }[] {
  const accounts = new Map<string, string>();
  for (const iban of ledger.ownAccounts) {
    if (iban !== ledger.mainAccount) accounts.set(iban, accountLabel(iban, accountNames));
  }
  for (const tx of ledger.transactions) {
    if (isAccountKey(tx.key) && tx.counterpartyIban !== ledger.mainAccount) {
      accounts.set(
        tx.counterpartyIban,
        accountLabel(tx.counterpartyIban, accountNames, tx.counterpartyName),
      );
    }
  }
  return [...accounts].map(([iban, label]) => ({ iban, label }));
}
