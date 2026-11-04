# Geldoverzicht

A monthly overview of household income and expenses, built from a **Rabobank CSV export**
(ING exports work too). Made for two people sharing a household: it splits what is left after
the fixed costs into savings and "own money" per partner, recognises fixed costs, and tracks
savings pots.

Everything runs in the browser. Bank data is parsed locally and kept in `localStorage`;
nothing is sent to a server.

**Live:** deployed to GitHub Pages from `main` by the _Deploy_ workflow, once Pages is enabled
(Settings → Pages → Source: _GitHub Actions_).

## Features

- **Import** one or more Rabobank/ING CSV exports (drag & drop). Re-importing or overlapping
  exports are de-duplicated, so each month you simply add the new export.
- **Month view** (default) with previous/next navigation (also ← →), comparison with the
  average of earlier months, and a **range view** for longer periods.
- **Budget split:** income − shared fixed costs − household budget = free budget, divided over
  _Sparen & beleggen_, _Eigen geld_ person 1 and person 2 (percentages or amounts), with plan vs. actual.
- **Per-person money:** mark transactions (or whole counterparties) as belonging to one partner,
  or create custom categories that belong to someone (e.g. _Paard_ for Wendy).
- **Own accounts:** name your other accounts and choose what transfers to them count as
  (savings by default, or e.g. _Paard_ when the horse has its own account).
- **Fixed costs** detected automatically (same amount, same counterparty, ≥ 3 months), with
  paid/expected status in the running month; click to exclude false positives.
- **Expected income** for the running month (e.g. a salary paid on the 25th).
- **Savings pots** with a goal, deadline and monthly amount; balances come from the export of a
  linked account, or are tracked manually plus later transfers.
- Demo mode with generated data (never stored).

## Getting a Rabobank export

Rabo Internetbankieren (desktop, not the app) → _Downloads en documenten_ → _Transacties
downloaden_ → choose account(s), period and **CSV**. Export the payment and savings account
together so transfers between them are recognised.

## Development

Requires Node.js 22.12+ (CI uses Node 24).

```bash
npm ci
npm start            # dev server on http://localhost:4200
npm test             # unit tests (Vitest, watch mode)
npm run test:ci      # unit tests once
npm run build        # production build in dist/geldoverzicht/browser
npm run format       # Prettier
```

## Architecture

Angular 22 (standalone components, signals, zoneless change detection, new control flow),
TypeScript in strict mode, Vitest for unit tests.

```
src/app
├── core/              Framework-free domain logic (pure TypeScript, no Angular imports)
│   ├── models/        Transaction, category catalogue, owner, settings (+ safe parsing of stored settings)
│   ├── import/        CSV parsing and Rabobank/ING column mapping
│   ├── categorization/Rules for Dutch payees, counterparty grouping, building the ledger
│   ├── period/        Month arithmetic and resolving the selected period
│   ├── analysis/      Totals, fixed costs, expected income, budget split, savings pots, own accounts
│   ├── settings/      Pure update functions for every user change
│   └── demo/          Deterministic demo export
├── state/             Angular services holding state as signals
│   ├── transactions-store.ts   imported transactions (persisted)
│   ├── settings-store.ts       user configuration (persisted)
│   ├── view-store.ts           what is on screen: period, filters, table paging
│   ├── workspace.ts            use cases spanning stores: import, demo, start over
│   └── dashboard-facade.ts     computed view models + actions for the dashboard
├── features/
│   ├── import/        Landing page and import flow
│   └── dashboard/     Container page + presentational sections (toolbar, KPIs, budget split,
│                      savings pots, chart, categories, fixed costs, own accounts, transactions)
└── shared/
    ├── format/        Euro/date/month formatting and pipes
    └── ui/            Reusable controls: dialog, toast, file drop, selects, badges, progress bar
```

**Data flow** is one-directional:

```
TransactionsStore ─┐
SettingsStore ─────┼─► DashboardFacade (computed view models) ─► DashboardPage ─► sections (inputs)
ViewStore ─────────┘          ▲                                                     │
                              └──────────── actions ◄── container ◄── outputs ◄─────┘
```

- **`core` knows nothing about Angular.** Everything that can be wrong about money lives there
  as pure functions with unit tests: parsing, categorisation, fixed-cost detection, the budget
  split and pot projections. Settings changes are pure functions too (`settings-updates.ts`),
  so the stores stay thin.
- **Stores** own state as signals and persist it with an `effect`. They never compute views.
- **The facade** combines the stores into view models with `computed` and is the only thing the
  dashboard talks to.
- **Components** are `OnPush` and presentational: signal `input()`s in, `output()`s out. Only the
  two pages inject services.
- **Routing** uses hash URLs (`#/overzicht`) so it works on static hosting; the dashboard is
  lazy-loaded and guarded (no data → import page).

### Decisions

- **No backend.** Bank data is sensitive; keeping it in the browser avoids accounts, hosting and
  data protection obligations. The trade-off: data lives in one browser.
- **Categories are identified by their Dutch name.** They are user-facing and user-defined; a
  separate id would add mapping without benefit here.
- **Own-account transfers count as saving on the main account** and as internal on the other
  accounts, so money moved to savings is counted once even when both exports are imported.
- **Refunds are netted** against their category instead of counted as income.

## Testing

`npm run test:ci` runs all specs:

- domain specs in `core/**` (parsing, rules, analysis, settings updates, demo export),
- store/facade integration specs using the demo data,
- component specs for the KPI cards, budget split, chart, category select and the full dashboard.

## Deployment

- `.github/workflows/ci.yml` checks formatting, runs the tests and builds on every push and pull request.
- `.github/workflows/deploy.yml` builds `main` and publishes it to GitHub Pages. It skips (with a
  notice) until Pages is enabled with _GitHub Actions_ as the source.
