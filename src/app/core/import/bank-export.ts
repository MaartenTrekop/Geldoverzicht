import { BankTransaction } from '../models/transaction';

/** Thrown when a file does not look like a supported bank export. */
export class UnsupportedExportError extends Error {
  constructor(readonly fileName: string) {
    super(
      `${fileName}: dit lijkt geen Rabobank- of ING-export. De kolommen "Datum" en "Bedrag" ontbreken.`,
    );
    this.name = 'UnsupportedExportError';
  }
}

/** Column names (lower case, without accents) per field, for Rabobank and ING exports. */
const COLUMNS = {
  account: ['iban/bban', 'rekening'],
  date: ['datum', 'boekdatum', 'transactiedatum'],
  amount: ['bedrag', 'bedrag (eur)'],
  debitCredit: ['af bij', 'af/bij'],
  counterpartyName: ['naam tegenpartij', 'naam / omschrijving', 'naam/omschrijving'],
  ultimateParty: ['naam uiteindelijke partij'],
  counterpartyIban: ['tegenrekening iban/bban', 'tegenrekening'],
  code: ['code'],
  sequence: ['volgnr'],
  balance: ['saldo na trn', 'saldo na mutatie'],
} as const;

const DESCRIPTION_COLUMNS = [
  'omschrijving-1',
  'omschrijving-2',
  'omschrijving-3',
  'mededelingen',
  'omschrijving',
];

type Field = keyof typeof COLUMNS;

/** Lower case, accents removed; a Windows-1252 mis-decode (U+FFFD) is read as "e" (initiërende). */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .replaceAll('\uFFFD', 'e')
    .trim();
}

/** Parses "+1.234,56", "-12,50", "12.50" or "€ 3,00". Returns `null` for anything else. */
export function parseAmount(value: string | undefined): number | null {
  let text = String(value ?? '').replace(/[\s€]/g, '');
  if (!text) return null;
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  const amount = Number(text);
  return Number.isFinite(amount) ? amount : null;
}

/** Accepts `YYYY-MM-DD`, `YYYYMMDD` (ING) and `DD-MM-YYYY`; returns `YYYY-MM-DD` or `null`. */
export function parseDate(value: string | undefined): string | null {
  const text = String(value ?? '').trim();
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = text.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return null;
}

const compactIban = (value: string | undefined) =>
  String(value ?? '')
    .replace(/\s/g, '')
    .toUpperCase();

/**
 * Maps the rows of a Rabobank (or ING) CSV export to bank transactions.
 * The first row must be the header. Rows without a valid date or amount are skipped.
 *
 * @param firstOrder order number for the first row, so ids/order stay unique across files
 */
export function parseBankExport(
  rows: readonly (readonly string[])[],
  fileName: string,
  firstOrder = 0,
): BankTransaction[] {
  if (rows.length < 2) throw new UnsupportedExportError(fileName);
  const header = rows[0].map(normalizeHeader);
  const column = (field: Field): number => {
    for (const name of COLUMNS[field]) {
      const index = header.indexOf(name);
      if (index >= 0) return index;
    }
    return -1;
  };
  const index = Object.fromEntries(
    (Object.keys(COLUMNS) as Field[]).map((field) => [field, column(field)]),
  ) as Record<Field, number>;
  const descriptionColumns = DESCRIPTION_COLUMNS.map((name) => header.indexOf(name)).filter(
    (i) => i >= 0,
  );
  if (index.date < 0 || index.amount < 0) throw new UnsupportedExportError(fileName);

  const cell = (row: readonly string[], i: number) => (i >= 0 ? (row[i] ?? '').trim() : '');
  const seen = new Map<string, number>();
  const result: BankTransaction[] = [];

  for (const row of rows.slice(1)) {
    const date = parseDate(row[index.date]);
    let amount = parseAmount(row[index.amount]);
    if (!date || amount === null) continue;
    if (/^af/i.test(cell(row, index.debitCredit))) amount = -Math.abs(amount);

    const account = compactIban(cell(row, index.account));
    const counterpartyIban = compactIban(cell(row, index.counterpartyIban));
    const counterpartyName = cell(row, index.counterpartyName) || cell(row, index.ultimateParty);
    const description = descriptionColumns
      .map((i) => cell(row, i))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ');
    const sequence = cell(row, index.sequence);

    // Rabobank numbers every row per account; other banks get a content-based id.
    // Identical rows within one file (two coffees on the same day) get an occurrence suffix.
    let id: string;
    if (sequence) {
      id = `${account}#${sequence}`;
    } else {
      const base = [account, date, amount, counterpartyName, description].join('|');
      const occurrence = (seen.get(base) ?? 0) + 1;
      seen.set(base, occurrence);
      id = `${base}|${occurrence}`;
    }

    result.push({
      id,
      order: firstOrder + result.length,
      date,
      month: date.slice(0, 7),
      amount,
      balanceAfter: parseAmount(cell(row, index.balance)),
      account,
      counterpartyIban,
      counterpartyName,
      description,
      code: cell(row, index.code).toLowerCase(),
    });
  }
  return result;
}

/** Adds new transactions to existing ones, skipping ids that are already present. */
export function mergeTransactions(
  existing: readonly BankTransaction[],
  incoming: readonly BankTransaction[],
): { transactions: BankTransaction[]; added: number; duplicates: number } {
  const ids = new Set(existing.map((t) => t.id));
  const transactions = [...existing];
  let duplicates = 0;
  for (const transaction of incoming) {
    if (ids.has(transaction.id)) {
      duplicates++;
      continue;
    }
    ids.add(transaction.id);
    transactions.push({ ...transaction, order: transactions.length });
  }
  return { transactions, added: transactions.length - existing.length, duplicates };
}
