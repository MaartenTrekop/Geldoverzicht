import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { OwnAccountSummary } from '../../../core/analysis/own-accounts';
import { CategoryCatalog } from '../../../core/models/category';
import { Owner, PersonNames, isOwner } from '../../../core/models/owner';
import { EuroPipe } from '../../../shared/format/pipes';
import { CategorySelect } from '../../../shared/ui/category-select';
import { OwnerSelect } from '../../../shared/ui/owner-select';

/**
 * Other accounts the main account transfers money to. Naming one and choosing what the
 * transfers count as (e.g. "Paard" for one partner) beats the default "Sparen".
 */
@Component({
  selector: 'app-own-accounts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EuroPipe, CategorySelect, OwnerSelect],
  template: `
    @for (account of accounts(); track account.iban) {
      <div class="account">
        <div>
          <input
            #name
            maxlength="30"
            [attr.aria-label]="'Naam voor ' + account.iban"
            [value]="nameOf(account)"
            [placeholder]="account.holderName || 'Naam rekening'"
            (change)="rename.emit({ iban: account.iban, name: name.value })"
          />
          <div class="iban">
            {{ account.iban }}{{ account.inExport ? ' · ook geëxporteerd' : '' }}
          </div>
        </div>
        <div class="num" title="Netto naar deze rekening, gemiddeld per maand">
          {{ account.monthlyNet | euro }} <span class="muted">/ mnd</span>
        </div>
        <label>
          Telt als
          <app-category-select
            [value]="account.category"
            [catalog]="catalog()"
            (changed)="categoryChange.emit({ key: account.key, category: $event })"
          />
        </label>
        <label>
          Van wie
          <app-owner-select
            [value]="account.owner"
            [names]="names()"
            (changed)="setOwner(account.key, $event)"
          />
        </label>
      </div>
    }
    <p class="note">
      Heeft bijvoorbeeld het paard een eigen rekening? Geef die rekening een naam, zet "Telt als" op
      een eigen categorie zoals Paard en "Van wie" op de juiste persoon. De overboeking telt dan als
      uitgave van die persoon en niet als sparen. Standaard telt geld naar een eigen rekening als
      sparen.
    </p>
  `,
  styleUrl: './own-accounts.scss',
})
export class OwnAccounts {
  readonly accounts = input.required<readonly OwnAccountSummary[]>();
  readonly catalog = input.required<CategoryCatalog>();
  readonly names = input.required<PersonNames>();
  readonly accountNames = input<Readonly<Record<string, string>>>({});

  readonly rename = output<{ iban: string; name: string }>();
  readonly categoryChange = output<{ key: string; category: string }>();
  readonly ownerChange = output<{ key: string; owner: Owner }>();

  protected nameOf(account: OwnAccountSummary): string {
    return this.accountNames()[account.iban] ?? '';
  }

  protected setOwner(key: string, owner: string): void {
    if (isOwner(owner)) this.ownerChange.emit({ key, owner });
  }
}
