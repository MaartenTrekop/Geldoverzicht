import { BankTransaction } from '../models/transaction';
import { OWN_TRANSFER_CODE } from './rules';

/** Prefix of keys that group transfers to/from one of the user's own accounts. */
export const ACCOUNT_KEY_PREFIX = 'rek:';

export function accountKey(iban: string): string {
  return ACCOUNT_KEY_PREFIX + iban;
}

export function isAccountKey(key: string): boolean {
  return key.startsWith(ACCOUNT_KEY_PREFIX);
}

/** A transfer between two of the user's own accounts. */
export function isOwnAccountTransfer(
  tx: BankTransaction,
  ownAccounts: ReadonlySet<string>,
): boolean {
  return (
    !!tx.counterpartyIban && (tx.code === OWN_TRANSFER_CODE || ownAccounts.has(tx.counterpartyIban))
  );
}

/**
 * Key that groups transactions with the same counterparty. Store numbers are dropped, so
 * "Albert Heijn 1352" and "Albert Heijn 8812" are one counterparty. Own-account transfers
 * are grouped per account, because several of them often carry the same holder name.
 */
export function counterpartyKey(tx: BankTransaction, ownAccounts: ReadonlySet<string>): string {
  if (isOwnAccountTransfer(tx, ownAccounts)) return accountKey(tx.counterpartyIban);
  const name = tx.counterpartyName
    .toLowerCase()
    .replace(/[0-9*#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (name) return name;
  if (tx.counterpartyIban) return tx.counterpartyIban;
  return tx.description.toLowerCase().slice(0, 30).trim() || 'onbekend';
}

export function shortIban(iban: string): string {
  return `${iban.slice(0, 4)} …${iban.slice(-4)}`;
}

/** "Spaarrekening", "W. de Vries (NL33 …5555)" or "Rekening NL33 …5555". */
export function accountLabel(
  iban: string,
  accountNames: Readonly<Record<string, string>>,
  holderName = '',
): string {
  const name = accountNames[iban];
  if (name) return name;
  return holderName ? `${holderName} (${shortIban(iban)})` : `Rekening ${shortIban(iban)}`;
}

/** Counterparty name for overviews, without trailing store numbers. */
export function displayName(
  tx: BankTransaction,
  key: string,
  accountNames: Readonly<Record<string, string>>,
): string {
  if (isAccountKey(key))
    return accountLabel(tx.counterpartyIban, accountNames, tx.counterpartyName);
  const name = tx.counterpartyName.replace(/\s+[0-9]{3,}\b.*$/, '');
  return name || tx.description.slice(0, 40) || tx.counterpartyIban || '—';
}
