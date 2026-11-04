import { Owner } from './owner';
import { YearMonth } from '../period/months';

/** A single row from a bank export, normalised but not yet interpreted. */
export interface BankTransaction {
  /** Stable id, so importing the same export twice does not duplicate rows. */
  readonly id: string;
  /** Position in import order; breaks ties between rows on the same date. */
  readonly order: number;
  /** Booking date, `YYYY-MM-DD`. */
  readonly date: string;
  readonly month: YearMonth;
  /** Signed amount in euros: negative is money going out. */
  readonly amount: number;
  /** Account balance after this transaction, when the export provides it. */
  readonly balanceAfter: number | null;
  /** IBAN of the user's own account this row was booked on. */
  readonly account: string;
  readonly counterpartyIban: string;
  readonly counterpartyName: string;
  readonly description: string;
  /** Bank transaction code, lower case (Rabobank: `tb` own-account transfer, `ga` ATM, ...). */
  readonly code: string;
}

/** A bank transaction after categorisation and the user's overrides have been applied. */
export interface Transaction extends BankTransaction {
  /** Groups transactions with the same counterparty (rules and overrides are stored per key). */
  readonly key: string;
  readonly displayName: string;
  /** Category chosen by the built-in rules, before any user override. */
  readonly autoCategory: string;
  readonly category: string;
  readonly owner: Owner;
  /** True when the user changed the category or owner of this transaction or its counterparty. */
  readonly overridden: boolean;
}
