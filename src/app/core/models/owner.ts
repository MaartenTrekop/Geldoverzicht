/** Who an income or expense belongs to: the household as a whole or one of the two partners. */
export type Owner = 'shared' | 'person1' | 'person2';

export const OWNERS: readonly Owner[] = ['shared', 'person1', 'person2'];

/** Display names of the two partners, in `person1`, `person2` order. */
export type PersonNames = readonly [string, string];

export const SHARED_LABEL = 'Samen';

export function ownerLabel(owner: Owner, names: PersonNames): string {
  switch (owner) {
    case 'shared':
      return SHARED_LABEL;
    case 'person1':
      return names[0];
    case 'person2':
      return names[1];
  }
}

export function isOwner(value: unknown): value is Owner {
  return value === 'shared' || value === 'person1' || value === 'person2';
}
