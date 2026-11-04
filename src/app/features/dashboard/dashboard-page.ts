import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CustomCategory } from '../../core/models/category';
import { Owner, isOwner } from '../../core/models/owner';
import { OverrideScope } from '../../core/models/settings';
import { Transaction } from '../../core/models/transaction';
import { formatMonth } from '../../core/period/months';
import { ToastService } from '../../shared/ui/toast';
import { DashboardFacade } from '../../state/dashboard-facade';
import { BudgetSplitCard } from './budget-split/budget-split';
import { CategoryBreakdown } from './category-breakdown/category-breakdown';
import { CategoryManager, CategoryPreset } from './categories/category-manager';
import { FixedCosts } from './fixed-costs/fixed-costs';
import { KpiSummary } from './kpi-summary/kpi-summary';
import { MonthChart } from './month-chart/month-chart';
import { OwnAccounts } from './own-accounts/own-accounts';
import { PeriodToolbar } from './period-toolbar/period-toolbar';
import { SavingsPots } from './savings-pots/savings-pots';
import { TopCounterparties } from './top-counterparties/top-counterparties';
import { TransactionTable } from './transactions/transaction-table';

/**
 * Container for the overview: reads view models from the facade, passes them to the
 * presentational sections and turns their events into facade calls (plus feedback).
 */
@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PeriodToolbar,
    KpiSummary,
    BudgetSplitCard,
    SavingsPots,
    MonthChart,
    CategoryBreakdown,
    FixedCosts,
    TopCounterparties,
    OwnAccounts,
    TransactionTable,
    CategoryManager,
  ],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  protected readonly facade = inject(DashboardFacade);
  private readonly toast = inject(ToastService);

  protected readonly names = this.facade.personNames;

  /** Transaction a new category is being created for, if any. */
  private readonly categoryFor = signal<Transaction | null>(null);
  protected readonly categoryDialogOpen = signal(false);
  protected readonly categoryPreset = computed((): CategoryPreset => {
    const tx = this.categoryFor();
    return { kind: tx && tx.amount > 0 ? 'income' : 'expense', owner: tx?.owner ?? 'shared' };
  });

  protected readonly splitHeading = computed(() => {
    const period = this.facade.periodVm();
    return period.mode === 'month' && period.month
      ? `Verdeling ${formatMonth(period.month, 'long')}`
      : 'Verdeling per maand (gemiddeld)';
  });

  protected readonly splitSubtitle = computed(() => {
    const period = this.facade.periodVm();
    if (period.mode !== 'month') return 'op basis van gemiddelden in de gekozen periode';
    return period.isRunningMonth
      ? 'lopende maand: nog niet alles is binnen of afgeschreven'
      : 'werkelijke bedragen van deze maand';
  });

  protected readonly exportedAccounts = computed(() => [...this.facade.ledger().ownAccounts]);

  protected setOwnerView(owner: string): void {
    this.facade.setOwnerView(isOwner(owner) ? owner : 'all');
  }

  protected changeCategory(tx: Transaction, category: string): void {
    const count = this.facade.setCategory(tx, category);
    this.toast.show(`${count} ${count === 1 ? 'transactie' : 'transacties'} → ${category}`);
  }

  protected changeOwner(tx: Transaction, owner: Owner): void {
    const count = this.facade.setOwner(tx, owner);
    const name = owner === 'shared' ? 'Samen' : this.names()[owner === 'person1' ? 0 : 1];
    this.toast.show(`${count} ${count === 1 ? 'transactie' : 'transacties'} → ${name}`);
  }

  protected setScope(scope: OverrideScope): void {
    this.facade.setOverrideScope(scope);
  }

  protected openCategoryDialog(tx: Transaction | null): void {
    this.categoryFor.set(tx);
    this.categoryDialogOpen.set(true);
  }

  protected closeCategoryDialog(): void {
    this.categoryDialogOpen.set(false);
    this.categoryFor.set(null);
  }

  protected createCategory(category: CustomCategory): void {
    if (!this.facade.addCategory(category)) return;
    const tx = this.categoryFor();
    if (tx) {
      this.closeCategoryDialog();
      this.changeCategory(tx, category.name);
    } else {
      this.toast.show(`Categorie "${category.name}" toegevoegd`);
    }
  }

  protected resetOverrides(): void {
    this.facade.resetOverrides();
    this.toast.show('Categorieën en personen teruggezet');
  }
}
