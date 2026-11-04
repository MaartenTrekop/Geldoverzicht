import { Owner } from './owner';

/** How a category counts in the overview. */
export type CategoryKind = 'income' | 'expense' | 'savings' | 'internal';

export const SALARY = 'Salaris';
export const BENEFITS = 'Toeslagen & uitkeringen';
export const INTEREST = 'Rente';
export const OTHER_INCOME = 'Overige inkomsten';
export const OTHER_EXPENSE = 'Overig';
export const SAVINGS = 'Sparen & beleggen';
export const INTERNAL_TRANSFER = 'Interne overboeking';
export const CASH = 'Contant geld';
export const GROCERIES = 'Boodschappen';

export const BUILT_IN_INCOME: readonly string[] = [SALARY, BENEFITS, INTEREST, OTHER_INCOME];

/** Built-in expense categories; `Overig` is always listed last, after custom categories. */
export const BUILT_IN_EXPENSES: readonly string[] = [
  'Wonen',
  'Energie & water',
  GROCERIES,
  'Verzekeringen',
  'Abonnementen & telecom',
  'Vervoer',
  'Eten & drinken',
  'Winkelen',
  'Gezondheid',
  'Belastingen & overheid',
  'Kinderen & onderwijs',
  'Vrije tijd & reizen',
  'Betaalverzoeken',
  CASH,
];

/** Expense categories whose amounts naturally vary, so they are never treated as fixed costs. */
export const VARIABLE_EXPENSES: readonly string[] = [
  GROCERIES,
  'Eten & drinken',
  CASH,
  'Betaalverzoeken',
  'Winkelen',
];

/** A category the user added, e.g. "Paard" belonging to one partner. */
export interface CustomCategory {
  readonly name: string;
  readonly kind: 'income' | 'expense';
  /** Transactions in this category belong to this owner unless overridden. */
  readonly owner: Owner;
}

/** Lookup of every category available to the user (built-in plus custom). */
export interface CategoryCatalog {
  readonly income: readonly string[];
  readonly expenses: readonly string[];
  readonly custom: readonly CustomCategory[];
  readonly all: readonly string[];
  has(name: string): boolean;
  kindOf(name: string): CategoryKind;
  /** Owner implied by a custom category, or `null` for categories without one. */
  ownerOf(name: string): Owner | null;
}

export function createCategoryCatalog(custom: readonly CustomCategory[]): CategoryCatalog {
  const byName = new Map(custom.map((c) => [c.name, c]));
  const income = [
    ...BUILT_IN_INCOME,
    ...custom.filter((c) => c.kind === 'income').map((c) => c.name),
  ];
  const expenses = [
    ...BUILT_IN_EXPENSES,
    ...custom.filter((c) => c.kind === 'expense').map((c) => c.name),
    OTHER_EXPENSE,
  ];
  const all = [...income, ...expenses, SAVINGS, INTERNAL_TRANSFER];
  const names = new Set(all);

  return {
    income,
    expenses,
    custom,
    all,
    has: (name) => names.has(name),
    kindOf(name) {
      const customCategory = byName.get(name);
      if (customCategory) return customCategory.kind;
      if (BUILT_IN_INCOME.includes(name)) return 'income';
      if (name === SAVINGS) return 'savings';
      if (name === INTERNAL_TRANSFER) return 'internal';
      return 'expense';
    },
    ownerOf(name) {
      const customCategory = byName.get(name);
      return customCategory && customCategory.owner !== 'shared' ? customCategory.owner : null;
    },
  };
}

export type CategoryNameError = 'empty' | 'exists';

/** Why a new category name cannot be used, or `null` when it can. */
export function categoryNameError(
  catalog: CategoryCatalog,
  name: string,
): CategoryNameError | null {
  const trimmed = name.trim();
  if (!trimmed) return 'empty';
  return catalog.all.some((c) => c.toLowerCase() === trimmed.toLowerCase()) ? 'exists' : null;
}
