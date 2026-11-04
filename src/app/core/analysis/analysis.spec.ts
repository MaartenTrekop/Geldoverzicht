import { createCategoryCatalog } from '../models/category';
import { DEFAULT_SETTINGS, SavingsPot } from '../models/settings';
import { monthly, tx } from '../testing/builders';
import {
  computeBudgetSplit,
  convertSplitMode,
  householdAverage,
  sharedFixedKeys,
} from './budget-split';
import { expectedIncome } from './expected-income';
import { detectFixedCosts, fixedCostStatus } from './fixed-costs';
import { potBalance, potContribution, potProgress } from './savings-pots';
import {
  categoryTotals,
  leftover,
  monthlyTotals,
  sumTotals,
  topExpenseCounterparties,
} from './totals';

const catalog = createCategoryCatalog([{ name: 'Paard', kind: 'expense', owner: 'person2' }]);
const MONTHS = ['2026-07', '2026-08', '2026-09', '2026-10'];

describe('totals', () => {
  const transactions = [
    tx({ date: '2026-10-24', amount: 3000, category: 'Salaris' }),
    tx({ date: '2026-10-01', amount: -1200, category: 'Wonen' }),
    tx({ date: '2026-10-05', amount: -80, category: 'Winkelen' }),
    tx({ date: '2026-10-07', amount: 30, category: 'Winkelen' }), // refund
    tx({ date: '2026-10-26', amount: -500, category: 'Sparen & beleggen' }),
    tx({ date: '2026-10-26', amount: 500, category: 'Interne overboeking' }),
  ];

  it('sums income, expenses and savings per month, netting refunds', () => {
    const totals = monthlyTotals(transactions, ['2026-10'], catalog).get('2026-10')!;
    expect(totals).toEqual({ income: 3000, expenses: 1250, savings: 500 });
    expect(leftover(totals)).toBe(1250);
    expect(sumTotals([totals, totals]).income).toBe(6000);
  });

  it('sums per category without internal transfers', () => {
    const totals = categoryTotals(transactions, catalog);
    expect(totals.get('Winkelen')).toBe(-50);
    expect(totals.has('Interne overboeking')).toBe(false);
  });

  it('ranks counterparties by spending', () => {
    const top = topExpenseCounterparties(
      [
        tx({ counterpartyName: 'A', amount: -10, category: 'Winkelen' }),
        tx({ counterpartyName: 'B', amount: -30, category: 'Winkelen' }),
      ],
      catalog,
    );
    expect(top.map((t) => t.name)).toEqual(['B', 'A']);
  });
});

describe('detectFixedCosts', () => {
  it('finds constant monthly payments', () => {
    const rent = monthly(MONTHS, '01', {
      counterpartyName: 'Woonstad',
      amount: -950,
      category: 'Wonen',
    });
    const [fixed] = detectFixedCosts(rent, 4, catalog);
    expect(fixed).toMatchObject({
      key: 'woonstad',
      perMonth: 950,
      typical: 950,
      monthsSeen: 4,
      monthly: true,
      excluded: false,
    });
  });

  it('ignores varying amounts, payments several times a month and variable categories', () => {
    const fuel = MONTHS.map((m, i) =>
      tx({
        date: `${m}-10`,
        counterpartyName: 'Shell',
        amount: -(50 + i * 15),
        category: 'Vervoer',
      }),
    );
    const twice = [...MONTHS, ...MONTHS].map((m) =>
      tx({ date: `${m}-12`, counterpartyName: 'Parkeren', amount: -5, category: 'Vervoer' }),
    );
    const groceries = monthly(MONTHS, '03', {
      counterpartyName: 'Picnic',
      amount: -100,
      category: 'Boodschappen',
    });
    expect(detectFixedCosts([...fuel, ...twice, ...groceries], 4, catalog)).toEqual([]);
  });

  it('marks costs the user excluded and spreads non-monthly costs over the history', () => {
    const smith = monthly(['2026-06', '2026-08', '2026-10'], '16', {
      counterpartyName: 'Hoefsmid',
      amount: -85,
      category: 'Paard',
      owner: 'person2',
    });
    const [fixed] = detectFixedCosts(smith, 6, catalog, ['hoefsmid']);
    expect(fixed).toMatchObject({ excluded: true, monthly: false, owner: 'person2' });
    expect(fixed.perMonth).toBeCloseTo(42.5);
  });

  it('reports what was paid and what is still expected in month view', () => {
    const rent = monthly(MONTHS.slice(0, 3), '01', {
      counterpartyName: 'Woonstad',
      amount: -950,
      category: 'Wonen',
    });
    const fixed = detectFixedCosts(rent, 4, catalog);
    const [notYet] = fixedCostStatus(fixed, [], { isMonth: true, monthCount: 1 });
    const [paid] = fixedCostStatus(fixed, [rent[0]], { isMonth: true, monthCount: 1 });
    expect(notYet).toMatchObject({ paid: 0, budgeted: 950 });
    expect(paid).toMatchObject({ paid: 950, budgeted: 950 });
  });
});

describe('expectedIncome', () => {
  it('expects regular income that has not arrived this month', () => {
    const previous = ['2026-08', '2026-09', '2026-10'];
    const history = monthly(previous, '24', {
      counterpartyName: 'Werkgever',
      amount: 3000,
      category: 'Salaris',
      owner: 'person1',
    });
    const expected = expectedIncome(history, previous, [], catalog);
    expect(expected).toEqual([
      { key: 'werkgever', name: 'Werkgever', owner: 'person1', amount: 3000 },
    ]);

    const arrived = [
      tx({ date: '2026-11-24', counterpartyName: 'Werkgever', amount: 3000, category: 'Salaris' }),
    ];
    expect(expectedIncome(history, previous, arrived, catalog)).toEqual([]);
  });

  it('needs at least two previous months', () => {
    const history = monthly(['2026-10'], '24', {
      counterpartyName: 'Werkgever',
      amount: 3000,
      category: 'Salaris',
    });
    expect(expectedIncome(history, ['2026-10'], [], catalog)).toEqual([]);
  });
});

describe('computeBudgetSplit', () => {
  const october = [
    tx({ date: '2026-10-24', amount: 3000, category: 'Salaris', owner: 'person1' }),
    tx({ date: '2026-10-23', amount: 2000, category: 'Salaris', owner: 'person2' }),
    tx({ date: '2026-10-01', amount: -1000, category: 'Wonen', counterpartyName: 'Hypotheek' }),
    tx({ date: '2026-10-05', amount: -600, category: 'Boodschappen', counterpartyName: 'AH' }),
    tx({
      date: '2026-10-02',
      amount: -400,
      category: 'Paard',
      counterpartyName: 'Manege',
      owner: 'person2',
    }),
    tx({
      date: '2026-10-26',
      amount: -500,
      category: 'Sparen & beleggen',
      counterpartyName: 'Spaar',
    }),
  ];
  const fixed = fixedCostStatus(
    [
      {
        key: 'hypotheek',
        name: 'Hypotheek',
        category: 'Wonen',
        owner: 'shared',
        total: 4000,
        perMonth: 1000,
        typical: 1000,
        monthsSeen: 4,
        monthly: true,
        excluded: false,
      },
    ],
    october,
    { isMonth: true, monthCount: 1 },
  );
  const base = {
    transactions: october,
    monthCount: 1,
    isMonth: true,
    fixedCosts: fixed,
    householdAverage: 650,
    householdBudget: null,
    plan: DEFAULT_SETTINGS.split,
    pots: [],
    expected: [],
    catalog,
  };

  it('computes the free budget and splits it by percentage', () => {
    const split = computeBudgetSplit(base);
    expect(split.income.total).toBe(5000);
    expect(split.income.byOwner).toEqual({ shared: 0, person1: 3000, person2: 2000 });
    expect(split.sharedFixed).toBe(1000);
    expect(split.household).toEqual({ actual: 600, average: 650, budget: 650, isCustom: false });
    expect(split.free).toBe(3350);
    expect(split.lines.map((l) => l.planned)).toEqual([1340, 1005, 1005]);
    expect(split.unallocated).toBe(0);
    expect(split.unallocatedPercent).toBe(0);
  });

  it('reports actual saving and personal spending with categories', () => {
    const [savings, person1, person2] = computeBudgetSplit(base).lines;
    expect(savings.actual).toBe(500);
    expect(person1.actual).toBe(0);
    expect(person2).toMatchObject({ actual: 400, categories: [{ name: 'Paard', amount: 400 }] });
  });

  it('uses a custom household budget, fixed amounts and expected income', () => {
    const split = computeBudgetSplit({
      ...base,
      householdBudget: 500,
      plan: { mode: 'amount', savings: 1000, person1: 500, person2: 500 },
      expected: [{ key: 'bonus', name: 'Bonus', owner: 'person1', amount: 1000 }],
    });
    expect(split.income).toMatchObject({ received: 5000, expected: 1000, total: 6000 });
    expect(split.free).toBe(4500);
    expect(split.unallocated).toBe(2500);
    expect(split.unallocatedPercent).toBeNull();
  });

  it('averages the shared variable spending over the history', () => {
    const keys = sharedFixedKeys(fixed);
    expect(householdAverage(october, 2, keys, catalog)).toBe(300);
  });

  it('converts between percentages and amounts', () => {
    const amounts = convertSplitMode(
      { mode: 'percent', savings: 40, person1: 30, person2: 30 },
      'amount',
      2000,
    );
    expect(amounts).toEqual({ mode: 'amount', savings: 800, person1: 600, person2: 600 });
    expect(convertSplitMode(amounts, 'percent', 2000)).toEqual({
      mode: 'percent',
      savings: 40,
      person1: 30,
      person2: 30,
    });
  });
});

describe('savings pots', () => {
  const MAIN = 'NL11RABO0123456789';
  const SAVINGS = 'NL22RABO0987654321';
  const OTHER = 'NL33RABO0555555555';
  const pot: SavingsPot = {
    id: 'p',
    name: 'Vakantie',
    target: 3000,
    deadline: null,
    balance: 1000,
    balanceDate: '2026-09-30',
    monthly: 200,
    linkedAccount: null,
    owner: 'shared',
  };
  const transactions = [
    tx({ account: SAVINGS, date: '2026-10-26', amount: 500, balanceAfter: 9000 }),
    tx({ account: SAVINGS, date: '2026-09-26', amount: 500, balanceAfter: 8500 }),
    tx({ account: MAIN, date: '2026-09-20', counterpartyIban: OTHER, amount: -100 }),
    tx({ account: MAIN, date: '2026-10-20', counterpartyIban: OTHER, amount: -150 }),
  ];
  const ledger = { transactions, ownAccounts: new Set([MAIN, SAVINGS]), mainAccount: MAIN };

  it('reads the balance of a linked account from its export', () => {
    expect(potBalance({ ...pot, linkedAccount: SAVINGS }, ledger)).toEqual({
      amount: 9000,
      source: 'export',
      asOf: '2026-10-26',
      transferred: 0,
    });
  });

  it('adds later transfers to a manually entered balance', () => {
    expect(potBalance({ ...pot, linkedAccount: OTHER }, ledger)).toMatchObject({
      amount: 1150,
      source: 'manual',
      transferred: 150,
    });
    expect(potBalance(pot, ledger)).toMatchObject({ amount: 1000, transferred: 0 });
  });

  it('reports contributions for linked pots only', () => {
    expect(potContribution({ ...pot, linkedAccount: OTHER }, ledger, ['2026-10'])).toBe(150);
    expect(potContribution(pot, ledger, ['2026-10'])).toBeNull();
  });

  it('estimates when the goal is reached and whether a deadline is feasible', () => {
    const progress = potProgress(pot, 1000, '2026-11');
    expect(progress.percent).toBeCloseTo(33.33);
    expect(progress).toMatchObject({ monthsToGoal: 10, expectedMonth: '2027-09', onTrack: null });
    const tight = potProgress({ ...pot, deadline: '2027-03' }, 1000, '2026-11');
    expect(tight.requiredMonthly).toBe(500);
    expect(tight.onTrack).toBe(false);
    expect(potProgress(pot, 3200, '2026-11')).toMatchObject({ reached: true, percent: 100 });
    expect(potProgress({ ...pot, target: 0 }, 1000, '2026-11').percent).toBeNull();
  });
});
