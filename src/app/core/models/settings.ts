import { CustomCategory } from './category';
import { Owner, PersonNames, isOwner } from './owner';
import { YearMonth } from '../period/months';

/** Split the free budget in percentages of it, or in fixed euro amounts. */
export type SplitMode = 'percent' | 'amount';

/** The three places the free budget goes to each month. */
export type SplitLine = 'savings' | 'person1' | 'person2';

export interface SplitPlan {
  readonly mode: SplitMode;
  readonly savings: number;
  readonly person1: number;
  readonly person2: number;
}

/** Whether a category/owner change applies to the whole counterparty or to one transaction. */
export type OverrideScope = 'counterparty' | 'transaction';

/** A savings goal, optionally tracked through one of the user's own accounts. */
export interface SavingsPot {
  readonly id: string;
  readonly name: string;
  /** Goal amount, or 0 for a pot without a goal. */
  readonly target: number;
  /** Month the goal should be reached, or `null`. */
  readonly deadline: YearMonth | null;
  /** Balance entered by the user. */
  readonly balance: number;
  /** Date (`YYYY-MM-DD`) of the data the balance was entered against; later transfers add to it. */
  readonly balanceDate: string | null;
  readonly monthly: number;
  /** IBAN of the account that holds this money, or `null` when kept up to date by hand. */
  readonly linkedAccount: string | null;
  readonly owner: Owner;
}

/** Everything the user configures. Stored in the browser; bank data is kept separately. */
export interface Settings {
  readonly personNames: PersonNames;
  readonly customCategories: readonly CustomCategory[];
  /** Category per counterparty key. */
  readonly categoryByCounterparty: Readonly<Record<string, string>>;
  /** Category per transaction id; wins over the counterparty rule. */
  readonly categoryByTransaction: Readonly<Record<string, string>>;
  readonly ownerByCounterparty: Readonly<Record<string, Owner>>;
  readonly ownerByTransaction: Readonly<Record<string, Owner>>;
  /** Counterparty keys the user says are not fixed costs. */
  readonly excludedFixedCosts: readonly string[];
  /** Names for (own) accounts, by IBAN. */
  readonly accountNames: Readonly<Record<string, string>>;
  readonly split: SplitPlan;
  /** Monthly budget for shared variable spending; `null` means "use the average". */
  readonly householdBudget: number | null;
  readonly overrideScope: OverrideScope;
  readonly savingsPots: readonly SavingsPot[];
}

export const DEFAULT_SETTINGS: Settings = {
  personNames: ['Maarten', 'Wendy'],
  customCategories: [],
  categoryByCounterparty: {},
  categoryByTransaction: {},
  ownerByCounterparty: {},
  ownerByTransaction: {},
  excludedFixedCosts: [],
  accountNames: {},
  split: { mode: 'percent', savings: 40, person1: 30, person2: 30 },
  householdBudget: null,
  overrideScope: 'counterparty',
  savingsPots: [],
};

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const finite = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

function ownerRecord(value: unknown): Record<string, Owner> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, Owner] => isOwner(entry[1])),
  );
}

function customCategories(value: unknown): CustomCategory[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .flatMap((c) =>
      typeof c['name'] === 'string' && (c['kind'] === 'income' || c['kind'] === 'expense')
        ? [{ name: c['name'], kind: c['kind'], owner: isOwner(c['owner']) ? c['owner'] : 'shared' }]
        : [],
    );
}

function savingsPots(value: unknown): SavingsPot[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap((p) =>
    typeof p['id'] === 'string' && typeof p['name'] === 'string'
      ? [
          {
            id: p['id'],
            name: p['name'],
            target: finite(p['target'], 0),
            deadline: typeof p['deadline'] === 'string' && p['deadline'] ? p['deadline'] : null,
            balance: finite(p['balance'], 0),
            balanceDate: typeof p['balanceDate'] === 'string' ? p['balanceDate'] : null,
            monthly: finite(p['monthly'], 0),
            linkedAccount:
              typeof p['linkedAccount'] === 'string' && p['linkedAccount']
                ? p['linkedAccount']
                : null,
            owner: isOwner(p['owner']) ? p['owner'] : 'shared',
          },
        ]
      : [],
  );
}

/** Reads settings from untrusted JSON (e.g. localStorage), falling back to defaults per field. */
export function normalizeSettings(input: unknown): Settings {
  if (!isRecord(input)) return DEFAULT_SETTINGS;
  const names = Array.isArray(input['personNames']) ? input['personNames'] : [];
  const split = isRecord(input['split']) ? input['split'] : {};
  const defaults = DEFAULT_SETTINGS;

  return {
    personNames: [
      typeof names[0] === 'string' && names[0] ? names[0] : defaults.personNames[0],
      typeof names[1] === 'string' && names[1] ? names[1] : defaults.personNames[1],
    ],
    customCategories: customCategories(input['customCategories']),
    categoryByCounterparty: stringRecord(input['categoryByCounterparty']),
    categoryByTransaction: stringRecord(input['categoryByTransaction']),
    ownerByCounterparty: ownerRecord(input['ownerByCounterparty']),
    ownerByTransaction: ownerRecord(input['ownerByTransaction']),
    excludedFixedCosts: Array.isArray(input['excludedFixedCosts'])
      ? input['excludedFixedCosts'].filter((k): k is string => typeof k === 'string')
      : [],
    accountNames: stringRecord(input['accountNames']),
    split: {
      mode: split['mode'] === 'amount' ? 'amount' : 'percent',
      savings: finite(split['savings'], defaults.split.savings),
      person1: finite(split['person1'], defaults.split.person1),
      person2: finite(split['person2'], defaults.split.person2),
    },
    householdBudget:
      typeof input['householdBudget'] === 'number' && Number.isFinite(input['householdBudget'])
        ? input['householdBudget']
        : null,
    overrideScope: input['overrideScope'] === 'transaction' ? 'transaction' : 'counterparty',
    savingsPots: savingsPots(input['savingsPots']),
  };
}
