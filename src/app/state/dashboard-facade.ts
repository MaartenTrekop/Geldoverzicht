import { Injectable, computed, inject } from '@angular/core';
import {
  BudgetSplit,
  computeBudgetSplit,
  householdAverage,
  sharedFixedKeys,
} from '../core/analysis/budget-split';
import { ExpectedIncome, expectedIncome } from '../core/analysis/expected-income';
import { FixedCostStatus, detectFixedCosts, fixedCostStatus } from '../core/analysis/fixed-costs';
import {
  OwnAccountSummary,
  linkableAccounts,
  summarizeOwnAccounts,
} from '../core/analysis/own-accounts';
import { potBalance, potContribution, potProgress } from '../core/analysis/savings-pots';
import {
  CounterpartyTotal,
  FlowTotals,
  averageTotals,
  categoryTotals,
  leftover,
  monthlyTotals,
  sumTotals,
  topExpenseCounterparties,
} from '../core/analysis/totals';
import { accountLabel } from '../core/categorization/counterparty';
import { buildLedger } from '../core/categorization/ledger';
import { CustomCategory, SAVINGS } from '../core/models/category';
import { Owner } from '../core/models/owner';
import { OverrideScope, SavingsPot, SplitLine, SplitMode } from '../core/models/settings';
import { Transaction } from '../core/models/transaction';
import { YearMonth, toYearMonth } from '../core/period/months';
import {
  QuickRange,
  ViewMode,
  availableMonths,
  quickRange,
  resolvePeriod,
} from '../core/period/period';
import * as updates from '../core/settings/settings-updates';
import { CLOCK } from './clock';
import {
  AccountOption,
  CategoryRowVm,
  ChartVm,
  FixedCostsVm,
  KpiVm,
  PeriodVm,
  PotVm,
  TableVm,
} from './dashboard-view-models';
import { SettingsStore } from './settings-store';
import { TransactionsStore } from './transactions-store';
import { ALL, OwnerFilter, TableFilter, ViewStore } from './view-store';

const inMonths = (transactions: readonly Transaction[], months: readonly YearMonth[]) => {
  const set = new Set(months);
  return transactions.filter((t) => set.has(t.month));
};

/**
 * Everything the dashboard shows, derived from the stores as computed signals, plus the
 * actions the dashboard can take. Calculations live in `core`; this class only wires them.
 */
@Injectable({ providedIn: 'root' })
export class DashboardFacade {
  private readonly transactionsStore = inject(TransactionsStore);
  private readonly settingsStore = inject(SettingsStore);
  private readonly view = inject(ViewStore);
  private readonly today = toYearMonth(inject(CLOCK)());

  // ---------------------------------------------------------------- base state

  readonly settings = this.settingsStore.settings;
  readonly personNames = computed(() => this.settings().personNames);
  readonly ledger = computed(() =>
    buildLedger(this.transactionsStore.transactions(), this.settings()),
  );
  readonly catalog = computed(() => this.ledger().catalog);
  readonly table = this.view.table;
  readonly ownerView = this.view.owner;
  readonly overrideScope = computed(() => this.settings().overrideScope);

  private readonly available = computed(() => availableMonths(this.ledger().months));
  private readonly period = computed(() =>
    resolvePeriod(this.view.selection(), this.available(), this.today),
  );
  private readonly isMonth = computed(() => this.period().mode === 'month');

  /** Transactions of the selected account (or all accounts). */
  private readonly scoped = computed(() => {
    const account = this.view.account();
    const transactions = this.ledger().transactions;
    return account === ALL ? transactions : transactions.filter((t) => t.account === account);
  });
  private readonly periodTransactions = computed(() =>
    inMonths(this.scoped(), this.period().months),
  );
  private readonly historyTransactions = computed(() =>
    inMonths(this.scoped(), this.period().history),
  );

  private readonly ownerFilter = (transactions: readonly Transaction[]) => {
    const owner = this.view.owner();
    return owner === ALL ? transactions : transactions.filter((t) => t.owner === owner);
  };
  private readonly visiblePeriod = computed(() => this.ownerFilter(this.periodTransactions()));
  private readonly visibleHistory = computed(() => this.ownerFilter(this.historyTransactions()));

  private readonly expected = computed((): ExpectedIncome[] => {
    const period = this.period();
    if (!period.isRunningMonth) return [];
    return expectedIncome(
      this.historyTransactions(),
      period.previous,
      this.periodTransactions(),
      this.catalog(),
    );
  });

  private readonly fixedCostStatuses = computed((): FixedCostStatus[] => {
    const period = this.period();
    const detected = detectFixedCosts(
      this.historyTransactions(),
      period.history.length,
      this.catalog(),
      this.settings().excludedFixedCosts,
    );
    return fixedCostStatus(detected, this.periodTransactions(), {
      isMonth: this.isMonth(),
      monthCount: period.months.length,
    });
  });

  // ---------------------------------------------------------------- view models

  readonly periodVm = computed((): PeriodVm => {
    const period = this.period();
    const available = this.available();
    const month = period.mode === 'month' ? period.months[0] : null;
    const index = month ? available.indexOf(month) : -1;
    const ledger = this.ledger();
    const accounts: AccountOption[] = [...ledger.ownAccounts].map((iban) => ({
      iban,
      label:
        accountLabel(iban, this.settings().accountNames) +
        (iban === ledger.mainAccount ? ' (hoofd)' : ''),
    }));
    return {
      mode: period.mode,
      month,
      from: period.months[0] ?? null,
      to: period.months[period.months.length - 1] ?? null,
      available,
      today: this.today,
      canGoBack: index > 0,
      canGoForward: index >= 0 && index < available.length - 1,
      isRunningMonth: period.isRunningMonth,
      monthCount: period.months.length,
      transactionCount: this.visiblePeriod().length,
      accounts,
      account: this.view.account(),
    };
  });

  readonly kpis = computed((): KpiVm => {
    const period = this.period();
    const catalog = this.catalog();
    const perMonth = monthlyTotals(this.visibleHistory(), period.history, catalog);
    const totals = sumTotals(period.months.map((m) => perMonth.get(m)!));
    const previous = averageTotals(period.previous.map((m) => perMonth.get(m)!));
    const owner = this.view.owner();
    return {
      isMonth: this.isMonth(),
      isRunningMonth: period.isRunningMonth,
      monthCount: period.months.length,
      totals,
      leftover: leftover(totals),
      average: previous ? { ...previous, leftover: leftover(previous) } : null,
      expectedIncome: this.expected()
        .filter((e) => owner === ALL || e.owner === owner)
        .reduce((sum, e) => sum + e.amount, 0),
    };
  });

  readonly chart = computed((): ChartVm => {
    const period = this.period();
    const perMonth = monthlyTotals(this.visibleHistory(), period.history, this.catalog());
    return {
      points: period.history.map((month) => {
        const totals: FlowTotals = perMonth.get(month)!;
        return {
          month,
          income: totals.income,
          expenses: totals.expenses,
          leftover: leftover(totals),
        };
      }),
      selected: period.months,
      highlightSelection: this.isMonth(),
    };
  });

  readonly budget = computed((): BudgetSplit => {
    const period = this.period();
    const settings = this.settings();
    const fixed = this.fixedCostStatuses();
    const catalog = this.catalog();
    return computeBudgetSplit({
      transactions: this.periodTransactions(),
      monthCount: period.months.length,
      isMonth: this.isMonth(),
      fixedCosts: fixed,
      householdAverage: householdAverage(
        this.historyTransactions(),
        period.history.length,
        sharedFixedKeys(fixed),
        catalog,
      ),
      householdBudget: settings.householdBudget,
      plan: settings.split,
      pots: settings.savingsPots,
      expected: this.expected(),
      catalog,
    });
  });

  readonly fixedCosts = computed((): FixedCostsVm => {
    const owner = this.view.owner();
    const isMonth = this.isMonth();
    return {
      items: this.fixedCostStatuses().filter(
        (f) => (owner === ALL || f.owner === owner) && (!isMonth || f.paid > 0 || f.monthly),
      ),
      isMonth,
      isRunningMonth: this.period().isRunningMonth,
      historyMonths: this.period().history.length,
    };
  });

  readonly expenseCategories = computed((): CategoryRowVm[] => {
    const catalog = this.catalog();
    const totals = categoryTotals(this.visiblePeriod(), catalog);
    const average = this.previousCategoryAverages();
    const rows = [...catalog.expenses, SAVINGS].map((name) => ({
      name,
      amount: -(totals.get(name) ?? 0),
      average: average ? -(average.get(name) ?? 0) : null,
      owner: catalog.ownerOf(name),
      tone: name === SAVINGS ? ('savings' as const) : ('expense' as const),
    }));
    return withShares(rows);
  });

  readonly incomeCategories = computed((): CategoryRowVm[] => {
    const catalog = this.catalog();
    const totals = categoryTotals(this.visiblePeriod(), catalog);
    const average = this.previousCategoryAverages();
    return withShares(
      catalog.income.map((name) => ({
        name,
        amount: totals.get(name) ?? 0,
        average: average ? (average.get(name) ?? 0) : null,
        owner: catalog.ownerOf(name),
        tone: 'income' as const,
      })),
    );
  });

  readonly topCounterparties = computed((): CounterpartyTotal[] =>
    topExpenseCounterparties(this.visiblePeriod(), this.catalog()),
  );

  readonly ownAccounts = computed((): OwnAccountSummary[] =>
    summarizeOwnAccounts(
      this.ledger(),
      this.historyTransactions(),
      this.period().history.length,
      this.settings().accountNames,
    ),
  );

  readonly linkableAccounts = computed(() =>
    linkableAccounts(this.ledger(), this.settings().accountNames),
  );

  readonly pots = computed((): PotVm[] => {
    const ledger = this.ledger();
    const months = this.period().months;
    const names = this.settings().accountNames;
    return this.settings().savingsPots.map((pot) => {
      const balance = potBalance(pot, ledger);
      return {
        pot,
        balance,
        progress: potProgress(pot, balance.amount, this.today),
        contribution: potContribution(pot, ledger, months),
        accountLabel: pot.linkedAccount ? accountLabel(pot.linkedAccount, names) : null,
      };
    });
  });

  readonly transactionTable = computed((): TableVm => {
    const filter = this.view.table();
    const query = filter.query.trim().toLowerCase();
    const rows = this.visiblePeriod()
      .filter(
        (t) =>
          (filter.category === ALL || t.category === filter.category) &&
          (filter.owner === ALL || t.owner === filter.owner) &&
          (!query ||
            `${t.counterpartyName} ${t.description} ${t.counterpartyIban}`
              .toLowerCase()
              .includes(query)),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || Math.abs(b.amount) - Math.abs(a.amount));
    return { rows: rows.slice(0, filter.limit), total: rows.length };
  });

  /** Date of the most recent transaction: a manually entered pot balance is pinned to it. */
  private readonly latestDate = computed(() =>
    this.ledger().transactions.reduce((latest, t) => (t.date > latest ? t.date : latest), ''),
  );

  /** Category averages over the previous months; only meaningful for a finished month. */
  private readonly previousCategoryAverages = computed((): Map<string, number> | null => {
    const period = this.period();
    if (period.mode !== 'month' || period.isRunningMonth || !period.previous.length) return null;
    const totals = categoryTotals(inMonths(this.visibleHistory(), period.previous), this.catalog());
    return new Map([...totals].map(([name, sum]) => [name, sum / period.previous.length]));
  });

  // ---------------------------------------------------------------- period actions

  showMonth(month: YearMonth): void {
    this.view.showMonth(month);
  }

  stepMonth(delta: -1 | 1): void {
    const { month } = this.periodVm();
    const available = this.available();
    const next = month ? available[available.indexOf(month) + delta] : undefined;
    if (next) this.view.showMonth(next);
  }

  setMode(mode: ViewMode): void {
    if (mode === 'month') {
      this.view.setMode('month');
      return;
    }
    const range = quickRange('last12', this.available(), this.today);
    if (range) this.view.showRange(range.from, range.to);
  }

  showRange(from: YearMonth, to: YearMonth): void {
    this.view.showRange(from, to);
  }

  showQuickRange(kind: QuickRange): void {
    const range = quickRange(kind, this.available(), this.today);
    if (range) this.view.showRange(range.from, range.to);
  }

  setAccount(account: string): void {
    this.view.setAccount(account);
  }

  setOwnerView(owner: OwnerFilter): void {
    this.view.setOwner(owner);
  }

  // ---------------------------------------------------------------- table actions

  updateTable(change: Partial<Omit<TableFilter, 'limit'>>): void {
    this.view.updateTable(change);
  }

  toggleCategoryFilter(category: string): void {
    this.view.toggleCategory(category);
  }

  showCategoryOf(category: string, owner: Owner): void {
    this.view.updateTable({ category, owner });
  }

  showMoreRows(): void {
    this.view.showMoreRows();
  }

  // ---------------------------------------------------------------- edits

  setOverrideScope(scope: OverrideScope): void {
    this.settingsStore.update((s) => updates.setOverrideScope(s, scope));
  }

  /** Returns how many transactions the change applies to. */
  setCategory(tx: Transaction, category: string, scope = this.overrideScope()): number {
    const transactions = this.ledger().transactions;
    this.settingsStore.update((s) => updates.setCategory(s, tx, category, transactions, scope));
    return scope === 'counterparty' ? transactions.filter((t) => t.key === tx.key).length : 1;
  }

  setOwner(tx: Transaction, owner: Owner, scope = this.overrideScope()): number {
    const transactions = this.ledger().transactions;
    this.settingsStore.update((s) => updates.setOwner(s, tx, owner, transactions, scope));
    return scope === 'counterparty' ? transactions.filter((t) => t.key === tx.key).length : 1;
  }

  /** Account settings always apply to every transfer to that account. */
  setAccountCategory(key: string, category: string): void {
    const tx = this.ledger().transactions.find((t) => t.key === key);
    if (tx) this.setCategory(tx, category, 'counterparty');
  }

  setAccountOwner(key: string, owner: Owner): void {
    const tx = this.ledger().transactions.find((t) => t.key === key);
    if (tx) this.setOwner(tx, owner, 'counterparty');
  }

  renameAccount(iban: string, name: string): void {
    this.settingsStore.update((s) => updates.renameAccount(s, iban, name));
  }

  addCategory(category: CustomCategory): boolean {
    if (updates.validateCategoryName(this.settings(), category.name) !== null) return false;
    this.settingsStore.update((s) => updates.addCustomCategory(s, category));
    return true;
  }

  removeCategory(name: string): void {
    this.settingsStore.update((s) => updates.removeCustomCategory(s, name));
  }

  toggleFixedCost(key: string): void {
    this.settingsStore.update((s) => updates.toggleFixedCost(s, key));
  }

  renamePerson(index: 0 | 1, name: string): void {
    this.settingsStore.update((s) => updates.renamePerson(s, index, name));
  }

  setSplitValue(line: SplitLine, value: number): void {
    this.settingsStore.update((s) => updates.setSplitValue(s, line, value));
  }

  setSplitMode(mode: SplitMode): void {
    const free = this.budget().free;
    this.settingsStore.update((s) => updates.setSplitMode(s, mode, free));
  }

  setHouseholdBudget(amount: number | null): void {
    this.settingsStore.update((s) => updates.setHouseholdBudget(s, amount));
  }

  savePot(pot: Omit<SavingsPot, 'balanceDate'>): void {
    const date = this.latestDate() || new Date().toISOString().slice(0, 10);
    this.settingsStore.update((s) => updates.savePot(s, pot, date));
  }

  removePot(id: string): void {
    this.settingsStore.update((s) => updates.removePot(s, id));
  }

  resetOverrides(): void {
    this.settingsStore.update(updates.resetOverrides);
  }
}

/** Adds each row's share of the total and its difference with the average; drops empty rows. */
function withShares(
  rows: {
    name: string;
    amount: number;
    average: number | null;
    owner: Owner | null;
    tone: CategoryRowVm['tone'];
  }[],
): CategoryRowVm[] {
  const visible = rows.filter((r) => Math.abs(r.amount) >= 0.5).sort((a, b) => b.amount - a.amount);
  const total = visible.reduce((sum, r) => sum + Math.max(0, r.amount), 0);
  return visible.map((r) => ({
    name: r.name,
    amount: r.amount,
    share: total > 0 ? Math.max(0, r.amount) / total : 0,
    delta: r.average === null ? null : r.amount - r.average,
    owner: r.owner,
    tone: r.tone,
  }));
}
