import { convertSplitMode } from '../analysis/budget-split';
import {
  CategoryNameError,
  CustomCategory,
  categoryNameError,
  createCategoryCatalog,
} from '../models/category';
import { Owner } from '../models/owner';
import { OverrideScope, SavingsPot, Settings, SplitLine, SplitMode } from '../models/settings';
import { Transaction } from '../models/transaction';

/*
 * Pure functions that return an updated copy of the settings. The store calls these, so
 * every rule about how a change is recorded lives here and is unit tested.
 */

function without<T>(
  record: Readonly<Record<string, T>>,
  keys: Iterable<string>,
): Record<string, T> {
  const copy = { ...record };
  for (const key of keys) delete copy[key];
  return copy;
}

function idsWithKey(transactions: readonly Transaction[], key: string): string[] {
  return transactions.filter((t) => t.key === key).map((t) => t.id);
}

/**
 * Sets the category of one transaction or of every transaction with the same counterparty.
 * Choosing what the rules would choose anyway removes the override instead of storing it.
 */
export function setCategory(
  settings: Settings,
  tx: Transaction,
  category: string,
  transactions: readonly Transaction[],
  scope: OverrideScope = settings.overrideScope,
): Settings {
  if (scope === 'counterparty') {
    const byCounterparty =
      category === tx.autoCategory
        ? without(settings.categoryByCounterparty, [tx.key])
        : { ...settings.categoryByCounterparty, [tx.key]: category };
    return {
      ...settings,
      categoryByCounterparty: byCounterparty,
      categoryByTransaction: without(
        settings.categoryByTransaction,
        idsWithKey(transactions, tx.key),
      ),
    };
  }
  const counterpartyDefault = settings.categoryByCounterparty[tx.key] ?? tx.autoCategory;
  return {
    ...settings,
    categoryByTransaction:
      category === counterpartyDefault
        ? without(settings.categoryByTransaction, [tx.id])
        : { ...settings.categoryByTransaction, [tx.id]: category },
  };
}

export function setOwner(
  settings: Settings,
  tx: Transaction,
  owner: Owner,
  transactions: readonly Transaction[],
  scope: OverrideScope = settings.overrideScope,
): Settings {
  if (scope === 'counterparty') {
    return {
      ...settings,
      ownerByCounterparty: { ...settings.ownerByCounterparty, [tx.key]: owner },
      ownerByTransaction: without(settings.ownerByTransaction, idsWithKey(transactions, tx.key)),
    };
  }
  return { ...settings, ownerByTransaction: { ...settings.ownerByTransaction, [tx.id]: owner } };
}

export function validateCategoryName(settings: Settings, name: string): CategoryNameError | null {
  return categoryNameError(createCategoryCatalog(settings.customCategories), name);
}

export function addCustomCategory(settings: Settings, category: CustomCategory): Settings {
  const name = category.name.trim();
  if (validateCategoryName(settings, name) !== null) return settings;
  return { ...settings, customCategories: [...settings.customCategories, { ...category, name }] };
}

/** Removes a custom category and every override that pointed to it. */
export function removeCustomCategory(settings: Settings, name: string): Settings {
  const pointsTo = (record: Readonly<Record<string, string>>) =>
    Object.entries(record)
      .filter(([, category]) => category === name)
      .map(([key]) => key);
  return {
    ...settings,
    customCategories: settings.customCategories.filter((c) => c.name !== name),
    categoryByCounterparty: without(
      settings.categoryByCounterparty,
      pointsTo(settings.categoryByCounterparty),
    ),
    categoryByTransaction: without(
      settings.categoryByTransaction,
      pointsTo(settings.categoryByTransaction),
    ),
  };
}

export function toggleFixedCost(settings: Settings, key: string): Settings {
  const excluded = settings.excludedFixedCosts.includes(key)
    ? settings.excludedFixedCosts.filter((k) => k !== key)
    : [...settings.excludedFixedCosts, key];
  return { ...settings, excludedFixedCosts: excluded };
}

export function renameAccount(settings: Settings, iban: string, name: string): Settings {
  const trimmed = name.trim();
  return {
    ...settings,
    accountNames: trimmed
      ? { ...settings.accountNames, [iban]: trimmed }
      : without(settings.accountNames, [iban]),
  };
}

export function renamePerson(settings: Settings, index: 0 | 1, name: string): Settings {
  const fallback = index === 0 ? 'Persoon 1' : 'Persoon 2';
  const names: [string, string] = [...settings.personNames];
  names[index] = name.trim() || fallback;
  return { ...settings, personNames: names };
}

export function setSplitValue(settings: Settings, line: SplitLine, value: number): Settings {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  return { ...settings, split: { ...settings.split, [line]: safe } };
}

/** Switches the split between percentages and amounts, converting with the current free budget. */
export function setSplitMode(settings: Settings, mode: SplitMode, free: number): Settings {
  return { ...settings, split: convertSplitMode(settings.split, mode, free) };
}

export function setHouseholdBudget(settings: Settings, amount: number | null): Settings {
  return {
    ...settings,
    householdBudget: amount !== null && Number.isFinite(amount) ? Math.max(0, amount) : null,
  };
}

export function setOverrideScope(settings: Settings, scope: OverrideScope): Settings {
  return { ...settings, overrideScope: scope };
}

/**
 * Adds or replaces a pot. When the balance or the linked account changes, the balance is
 * pinned to `dataDate` (the latest transaction), so only later transfers are added to it.
 */
export function savePot(
  settings: Settings,
  pot: Omit<SavingsPot, 'balanceDate'>,
  dataDate: string,
): Settings {
  const existing = settings.savingsPots.find((p) => p.id === pot.id);
  const keepDate =
    existing && existing.balance === pot.balance && existing.linkedAccount === pot.linkedAccount;
  const saved: SavingsPot = { ...pot, balanceDate: keepDate ? existing.balanceDate : dataDate };
  return {
    ...settings,
    savingsPots: existing
      ? settings.savingsPots.map((p) => (p.id === pot.id ? saved : p))
      : [...settings.savingsPots, saved],
  };
}

export function removePot(settings: Settings, id: string): Settings {
  return { ...settings, savingsPots: settings.savingsPots.filter((p) => p.id !== id) };
}

/** Forgets every category and owner override; keeps names, categories, the plan and pots. */
export function resetOverrides(settings: Settings): Settings {
  return {
    ...settings,
    categoryByCounterparty: {},
    categoryByTransaction: {},
    ownerByCounterparty: {},
    ownerByTransaction: {},
    excludedFixedCosts: [],
  };
}
