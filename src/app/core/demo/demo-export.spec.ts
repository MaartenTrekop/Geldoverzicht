import { buildLedger } from '../categorization/ledger';
import { parseBankExport } from '../import/bank-export';
import { parseCsv } from '../import/csv';
import {
  DEMO_HORSE_ACCOUNT,
  DEMO_SAVINGS_ACCOUNT,
  createDemoSettings,
  generateDemoExport,
} from './demo-export';

describe('demo export', () => {
  const today = new Date(2026, 10, 4); // 4 November 2026
  const csv = generateDemoExport(today);
  const transactions = parseBankExport(parseCsv(csv), 'demo.csv');
  const ledger = buildLedger(transactions, createDemoSettings(today));

  it('is deterministic', () => {
    expect(generateDemoExport(today)).toBe(csv);
  });

  it('goes through the real import: 13 months, main and savings account', () => {
    expect(ledger.months[0]).toBe('2025-11');
    expect(ledger.months[ledger.months.length - 1]).toBe('2026-11');
    expect([...ledger.ownAccounts].sort()).toEqual(['NL11RABO0123456789', DEMO_SAVINGS_ACCOUNT]);
    expect(ledger.mainAccount).toBe('NL11RABO0123456789');
  });

  it('assigns the horse account to Paard for the second person', () => {
    const horse = ledger.transactions.filter((t) => t.counterpartyIban === DEMO_HORSE_ACCOUNT);
    expect(horse.length).toBeGreaterThan(10);
    expect(horse.every((t) => t.category === 'Paard' && t.owner === 'person2')).toBe(true);
  });

  it('does not include future transactions in the running month', () => {
    expect(transactions.every((t) => t.date <= '2026-11-04')).toBe(true);
  });
});
