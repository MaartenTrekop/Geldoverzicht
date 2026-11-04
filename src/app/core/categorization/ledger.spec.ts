import { DEFAULT_SETTINGS, Settings } from '../models/settings';
import { bankTx } from '../testing/builders';
import { autoCategory, buildLedger } from './ledger';

const MAIN = 'NL11RABO0123456789';
const SAVINGS_ACCOUNT = 'NL22RABO0987654321';
const context = { ownAccounts: new Set([MAIN, SAVINGS_ACCOUNT]), mainAccount: MAIN };

describe('autoCategory', () => {
  it('recognises common Dutch payees', () => {
    expect(autoCategory(bankTx({ counterpartyName: 'Albert Heijn 1352' }), context)).toBe(
      'Boodschappen',
    );
    expect(autoCategory(bankTx({ counterpartyName: 'Eneco Consumenten BV' }), context)).toBe(
      'Energie & water',
    );
    expect(autoCategory(bankTx({ counterpartyName: 'NS Groep IZ NS Reizigers' }), context)).toBe(
      'Vervoer',
    );
    expect(autoCategory(bankTx({ counterpartyName: 'Thuisbezorgd.nl' }), context)).toBe(
      'Eten & drinken',
    );
  });

  it('uses income rules for money coming in', () => {
    expect(autoCategory(bankTx({ amount: 3000, description: 'Salaris oktober' }), context)).toBe(
      'Salaris',
    );
    expect(
      autoCategory(bankTx({ amount: 120, counterpartyName: 'Belastingdienst' }), context),
    ).toBe('Toeslagen & uitkeringen');
    expect(
      autoCategory(bankTx({ amount: -120, counterpartyName: 'Belastingdienst' }), context),
    ).toBe('Belastingen & overheid');
  });

  it('nets refunds against the expense category', () => {
    expect(autoCategory(bankTx({ amount: 25, counterpartyName: 'bol.com' }), context)).toBe(
      'Winkelen',
    );
  });

  it('treats ATM withdrawals as cash', () => {
    expect(autoCategory(bankTx({ code: 'ga', counterpartyName: 'Utrecht Centrum' }), context)).toBe(
      'Contant geld',
    );
  });

  it('counts transfers to own accounts as saving on the main account and internal elsewhere', () => {
    const toSavings = bankTx({
      account: MAIN,
      counterpartyIban: SAVINGS_ACCOUNT,
      code: 'tb',
      amount: -500,
    });
    const onSavings = bankTx({
      account: SAVINGS_ACCOUNT,
      counterpartyIban: MAIN,
      code: 'tb',
      amount: 500,
    });

    expect(autoCategory(toSavings, context)).toBe('Sparen & beleggen');
    expect(autoCategory(onSavings, context)).toBe('Interne overboeking');
  });

  it('falls back to Overig / Overige inkomsten', () => {
    expect(autoCategory(bankTx({ counterpartyName: 'Onbekend BV' }), context)).toBe('Overig');
    expect(autoCategory(bankTx({ amount: 50, counterpartyName: 'Onbekend BV' }), context)).toBe(
      'Overige inkomsten',
    );
  });
});

describe('buildLedger', () => {
  const months = ['2026-07', '2026-08', '2026-09', '2026-10'];
  const salary = months.map((m) =>
    bankTx({ date: `${m}-24`, amount: 2900, counterpartyName: 'Werkgever Noord BV' }),
  );

  it('recognises regular large income from one counterparty as salary', () => {
    const ledger = buildLedger(salary, DEFAULT_SETTINGS);
    expect(ledger.transactions.every((t) => t.category === 'Salaris')).toBe(true);
    expect(ledger.months).toEqual(months);
    expect(ledger.mainAccount).toBe(MAIN);
  });

  it('applies counterparty overrides, with transaction overrides winning', () => {
    const shop = [
      bankTx({ id: 'a', counterpartyName: 'Hippisch Centrum' }),
      bankTx({ id: 'b', counterpartyName: 'Hippisch Centrum' }),
    ];
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      customCategories: [{ name: 'Paard', kind: 'expense', owner: 'person2' }],
      categoryByCounterparty: { 'hippisch centrum': 'Paard' },
      categoryByTransaction: { b: 'Winkelen' },
    };

    const [a, b] = buildLedger(shop, settings).transactions;

    expect(a).toMatchObject({
      category: 'Paard',
      owner: 'person2',
      overridden: true,
      autoCategory: 'Overig',
    });
    expect(b).toMatchObject({ category: 'Winkelen', owner: 'shared' });
  });

  it('lets an explicit owner win over the owner of a custom category', () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      customCategories: [{ name: 'Paard', kind: 'expense', owner: 'person2' }],
      categoryByCounterparty: { manege: 'Paard' },
      ownerByCounterparty: { manege: 'shared' },
    };
    const [manege] = buildLedger([bankTx({ counterpartyName: 'Manege' })], settings).transactions;
    expect(manege.owner).toBe('shared');
  });

  it('ignores overrides that point to a category that no longer exists', () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      categoryByCounterparty: { jumbo: 'Verwijderd' },
    };
    const [jumbo] = buildLedger([bankTx({ counterpartyName: 'Jumbo' })], settings).transactions;
    expect(jumbo.category).toBe('Boodschappen');
  });

  it('groups own-account transfers per account and uses account names', () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      accountNames: { NL33RABO0555555555: 'Paardrekening' },
    };
    const [horse] = buildLedger(
      [
        bankTx({
          counterpartyIban: 'NL33RABO0555555555',
          counterpartyName: 'W. de Vries',
          code: 'tb',
        }),
      ],
      settings,
    ).transactions;
    expect(horse.key).toBe('rek:NL33RABO0555555555');
    expect(horse.displayName).toBe('Paardrekening');
  });
});
