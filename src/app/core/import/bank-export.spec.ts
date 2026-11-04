import { bankTx } from '../testing/builders';
import { parseCsv } from './csv';
import {
  UnsupportedExportError,
  mergeTransactions,
  normalizeHeader,
  parseAmount,
  parseBankExport,
  parseDate,
} from './bank-export';

const RABO_HEADER =
  '"IBAN/BBAN","Munt","BIC","Volgnr","Datum","Rentedatum","Bedrag","Saldo na trn","Tegenrekening IBAN/BBAN","Naam tegenpartij","Naam uiteindelijke partij","Naam initiërende partij","BIC tegenpartij","Code","Batch ID","Transactiereferentie","Machtigingskenmerk","Incassant ID","Betalingskenmerk","Omschrijving-1","Omschrijving-2","Omschrijving-3","Reden retour","Oorspr bedrag","Oorspr munt","Koers"';

const raboRow = (
  seq: string,
  date: string,
  amount: string,
  iban: string,
  name: string,
  code: string,
  d1: string,
  d2 = '',
) =>
  `"NL11RABO0123456789","EUR","RABONL2U","${seq}","${date}","${date}","${amount}","+1000,00","${iban}","${name}","","","","${code}","","","","","","${d1}","${d2}","","","","",""`;

describe('parseAmount', () => {
  it('reads Dutch and plain notations', () => {
    expect(parseAmount('+1.234,56')).toBe(1234.56);
    expect(parseAmount('-12,50')).toBe(-12.5);
    expect(parseAmount('12.50')).toBe(12.5);
    expect(parseAmount('€ 3,00')).toBe(3);
  });

  it('returns null for empty or invalid input', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
  });
});

describe('parseDate', () => {
  it('accepts ISO, compact (ING) and Dutch dates', () => {
    expect(parseDate('2026-10-03')).toBe('2026-10-03');
    expect(parseDate('20261003')).toBe('2026-10-03');
    expect(parseDate('03-10-2026')).toBe('2026-10-03');
    expect(parseDate('3 okt')).toBeNull();
  });
});

describe('normalizeHeader', () => {
  it('removes accents and repairs mis-decoded characters', () => {
    expect(normalizeHeader(' Naam Initiërende Partij ')).toBe('naam initierende partij');
    expect(normalizeHeader('Naam initi\uFFFDrende partij')).toBe('naam initierende partij');
  });
});

describe('parseBankExport', () => {
  it('maps a Rabobank export', () => {
    const rows = parseCsv(
      [
        RABO_HEADER,
        raboRow(
          '000000000000000001',
          '2026-10-01',
          '-1268,32',
          'NL44RABO0300000001',
          'Rabobank Hypotheken',
          'ei',
          'Hypotheek',
          'termijn 10',
        ),
        raboRow(
          '000000000000000002',
          '2026-10-24',
          '+3185,40',
          'NL55INGB0001234567',
          'Werkgever Noord BV',
          'cb',
          'Salaris',
        ),
      ].join('\n'),
    );
    const [mortgage, salary] = parseBankExport(rows, 'rabo.csv');

    expect(mortgage).toMatchObject({
      id: 'NL11RABO0123456789#000000000000000001',
      date: '2026-10-01',
      month: '2026-10',
      amount: -1268.32,
      balanceAfter: 1000,
      account: 'NL11RABO0123456789',
      counterpartyIban: 'NL44RABO0300000001',
      counterpartyName: 'Rabobank Hypotheken',
      description: 'Hypotheek termijn 10',
      code: 'ei',
    });
    expect(salary.amount).toBe(3185.4);
    expect(salary.order).toBe(1);
  });

  it('maps an ING export with Af/Bij and compact dates', () => {
    const rows = parseCsv(
      [
        '"Datum";"Naam / Omschrijving";"Rekening";"Tegenrekening";"Code";"Af Bij";"Bedrag (EUR)";"Mutatiesoort";"Mededelingen"',
        '"20261003";"Albert Heijn 1352";"NL01INGB0001234567";"";"BA";"Af";"23,45";"Betaalautomaat";"Pasvolgnr: 001"',
        '"20261024";"Werkgever";"NL01INGB0001234567";"NL55INGB0001234567";"OV";"Bij";"2500,00";"Overschrijving";"Salaris"',
      ].join('\n'),
    );
    const [groceries, salary] = parseBankExport(rows, 'ing.csv');

    expect(groceries).toMatchObject({
      date: '2026-10-03',
      amount: -23.45,
      counterpartyName: 'Albert Heijn 1352',
      code: 'ba',
    });
    expect(salary).toMatchObject({
      amount: 2500,
      description: 'Salaris',
      account: 'NL01INGB0001234567',
    });
  });

  it('gives identical rows without sequence numbers distinct, stable ids', () => {
    const csv = [
      '"Datum";"Naam / Omschrijving";"Af Bij";"Bedrag (EUR)"',
      '"20261003";"Koffie";"Af";"3,00"',
      '"20261003";"Koffie";"Af";"3,00"',
    ].join('\n');
    const first = parseBankExport(parseCsv(csv), 'a.csv').map((t) => t.id);
    const second = parseBankExport(parseCsv(csv), 'a.csv').map((t) => t.id);

    expect(first[0]).not.toBe(first[1]);
    expect(second).toEqual(first);
  });

  it('skips rows without a valid date or amount', () => {
    const rows = parseCsv(
      [RABO_HEADER, raboRow('1', 'gisteren', '-1,00', '', 'X', 'bc', '')].join('\n'),
    );
    expect(parseBankExport(rows, 'x.csv')).toEqual([]);
  });

  it('rejects files that are not bank exports', () => {
    expect(() => parseBankExport(parseCsv('naam,leeftijd\nAnna,4'), 'personen.csv')).toThrow(
      UnsupportedExportError,
    );
    expect(() => parseBankExport([], 'leeg.csv')).toThrow(UnsupportedExportError);
  });
});

describe('mergeTransactions', () => {
  it('adds new transactions and skips ones already imported', () => {
    const a = bankTx({ id: 'a' });
    const b = bankTx({ id: 'b' });
    const c = bankTx({ id: 'c' });

    const result = mergeTransactions([a, b], [b, c]);

    expect(result.added).toBe(1);
    expect(result.duplicates).toBe(1);
    expect(result.transactions.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(result.transactions[2].order).toBe(2);
  });
});
