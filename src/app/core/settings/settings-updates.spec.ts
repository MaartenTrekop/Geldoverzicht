import { DEFAULT_SETTINGS, Settings, normalizeSettings } from '../models/settings';
import { tx } from '../testing/builders';
import {
  addCustomCategory,
  removeCustomCategory,
  renameAccount,
  renamePerson,
  resetOverrides,
  savePot,
  setCategory,
  setHouseholdBudget,
  setOwner,
  setSplitMode,
  setSplitValue,
  toggleFixedCost,
  validateCategoryName,
} from './settings-updates';

const a = tx({
  id: 'a',
  counterpartyName: 'Bol.com',
  category: 'Winkelen',
  autoCategory: 'Winkelen',
});
const b = tx({
  id: 'b',
  counterpartyName: 'Bol.com',
  category: 'Winkelen',
  autoCategory: 'Winkelen',
});
const all = [a, b];

describe('setCategory', () => {
  it('stores a counterparty rule and clears per-transaction overrides for it', () => {
    const start: Settings = { ...DEFAULT_SETTINGS, categoryByTransaction: { a: 'Gezondheid' } };
    const next = setCategory(start, a, 'Vrije tijd & reizen', all, 'counterparty');
    expect(next.categoryByCounterparty).toEqual({ 'bol.com': 'Vrije tijd & reizen' });
    expect(next.categoryByTransaction).toEqual({});
  });

  it('removes the rule when the automatic category is chosen again', () => {
    const start: Settings = {
      ...DEFAULT_SETTINGS,
      categoryByCounterparty: { 'bol.com': 'Gezondheid' },
    };
    expect(setCategory(start, a, 'Winkelen', all, 'counterparty').categoryByCounterparty).toEqual(
      {},
    );
  });

  it('stores a single-transaction override relative to the counterparty rule', () => {
    const next = setCategory(DEFAULT_SETTINGS, b, 'Gezondheid', all, 'transaction');
    expect(next.categoryByTransaction).toEqual({ b: 'Gezondheid' });
    expect(setCategory(next, b, 'Winkelen', all, 'transaction').categoryByTransaction).toEqual({});
  });

  it('uses the scope from the settings by default', () => {
    const start: Settings = { ...DEFAULT_SETTINGS, overrideScope: 'transaction' };
    expect(setCategory(start, a, 'Gezondheid', all).categoryByTransaction).toEqual({
      a: 'Gezondheid',
    });
  });
});

describe('setOwner', () => {
  it('assigns an owner per counterparty or per transaction', () => {
    const perCounterparty = setOwner(
      { ...DEFAULT_SETTINGS, ownerByTransaction: { a: 'person1' } },
      a,
      'person2',
      all,
      'counterparty',
    );
    expect(perCounterparty.ownerByCounterparty).toEqual({ 'bol.com': 'person2' });
    expect(perCounterparty.ownerByTransaction).toEqual({});
    expect(setOwner(DEFAULT_SETTINGS, a, 'person1', all, 'transaction').ownerByTransaction).toEqual(
      { a: 'person1' },
    );
  });
});

describe('custom categories', () => {
  it('validates names against existing categories', () => {
    expect(validateCategoryName(DEFAULT_SETTINGS, '  ')).toBe('empty');
    expect(validateCategoryName(DEFAULT_SETTINGS, 'boodschappen')).toBe('exists');
    expect(validateCategoryName(DEFAULT_SETTINGS, 'Paard')).toBeNull();
  });

  it('adds a category once and removes it together with its overrides', () => {
    let settings = addCustomCategory(DEFAULT_SETTINGS, {
      name: ' Paard ',
      kind: 'expense',
      owner: 'person2',
    });
    settings = addCustomCategory(settings, { name: 'paard', kind: 'expense', owner: 'shared' });
    expect(settings.customCategories).toEqual([
      { name: 'Paard', kind: 'expense', owner: 'person2' },
    ]);

    settings = {
      ...settings,
      categoryByCounterparty: { manege: 'Paard', jumbo: 'Boodschappen' },
      categoryByTransaction: { x: 'Paard' },
    };
    settings = removeCustomCategory(settings, 'Paard');
    expect(settings.customCategories).toEqual([]);
    expect(settings.categoryByCounterparty).toEqual({ jumbo: 'Boodschappen' });
    expect(settings.categoryByTransaction).toEqual({});
  });
});

describe('other settings', () => {
  it('toggles fixed costs on and off', () => {
    const off = toggleFixedCost(DEFAULT_SETTINGS, 'tinq');
    expect(off.excludedFixedCosts).toEqual(['tinq']);
    expect(toggleFixedCost(off, 'tinq').excludedFixedCosts).toEqual([]);
  });

  it('names accounts and persons, with sensible fallbacks', () => {
    expect(renameAccount(DEFAULT_SETTINGS, 'NL01', ' Paard ').accountNames).toEqual({
      NL01: 'Paard',
    });
    expect(
      renameAccount({ ...DEFAULT_SETTINGS, accountNames: { NL01: 'x' } }, 'NL01', '').accountNames,
    ).toEqual({});
    expect(renamePerson(DEFAULT_SETTINGS, 1, '').personNames).toEqual(['Maarten', 'Persoon 2']);
  });

  it('updates the split plan', () => {
    expect(setSplitValue(DEFAULT_SETTINGS, 'savings', -5).split.savings).toBe(0);
    expect(setSplitMode(DEFAULT_SETTINGS, 'amount', 1000).split).toEqual({
      mode: 'amount',
      savings: 400,
      person1: 300,
      person2: 300,
    });
    expect(setHouseholdBudget(DEFAULT_SETTINGS, 700).householdBudget).toBe(700);
    expect(setHouseholdBudget(DEFAULT_SETTINGS, null).householdBudget).toBeNull();
  });

  it('pins a pot balance to the data date only when the balance changes', () => {
    const pot = {
      id: 'v',
      name: 'Vakantie',
      target: 3000,
      deadline: null,
      balance: 500,
      monthly: 100,
      linkedAccount: null,
      owner: 'shared' as const,
    };
    let settings = savePot(DEFAULT_SETTINGS, pot, '2026-10-31');
    expect(settings.savingsPots[0].balanceDate).toBe('2026-10-31');

    settings = savePot(settings, { ...pot, name: 'Zomervakantie' }, '2026-11-30');
    expect(settings.savingsPots[0]).toMatchObject({
      name: 'Zomervakantie',
      balanceDate: '2026-10-31',
    });

    settings = savePot(settings, { ...pot, balance: 800 }, '2026-11-30');
    expect(settings.savingsPots[0].balanceDate).toBe('2026-11-30');
  });

  it('resets overrides but keeps the user setup', () => {
    const start: Settings = {
      ...DEFAULT_SETTINGS,
      categoryByCounterparty: { a: 'Wonen' },
      excludedFixedCosts: ['x'],
      personNames: ['A', 'B'],
    };
    expect(resetOverrides(start)).toMatchObject({
      categoryByCounterparty: {},
      excludedFixedCosts: [],
      personNames: ['A', 'B'],
    });
  });
});

describe('normalizeSettings', () => {
  it('returns defaults for garbage and keeps valid fields', () => {
    expect(normalizeSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
    const settings = normalizeSettings({
      personNames: ['Anna', 7],
      ownerByCounterparty: { a: 'person1', b: 'iemand' },
      split: { mode: 'amount', savings: 'veel' },
      savingsPots: [{ id: 'p', name: 'Buffer', monthly: 50 }, { name: 'zonder id' }],
      customCategories: [{ name: 'Paard', kind: 'expense' }],
    });
    expect(settings.personNames).toEqual(['Anna', 'Wendy']);
    expect(settings.ownerByCounterparty).toEqual({ a: 'person1' });
    expect(settings.split).toEqual({ mode: 'amount', savings: 40, person1: 30, person2: 30 });
    expect(settings.savingsPots).toHaveLength(1);
    expect(settings.savingsPots[0]).toMatchObject({
      name: 'Buffer',
      monthly: 50,
      target: 0,
      owner: 'shared',
    });
    expect(settings.customCategories).toEqual([
      { name: 'Paard', kind: 'expense', owner: 'shared' },
    ]);
  });
});
