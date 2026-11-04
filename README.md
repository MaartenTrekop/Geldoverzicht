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

### Local SQLite database (development only)

For testing locally with real data you can keep transactions and settings in a SQLite file on
your own computer instead of in the browser. Requires Node.js 22.13+ (Node's built-in
`node:sqlite`; it prints an "experimental" warning, which is harmless).

```bash
npm run start:local  # API + app on http://localhost:4200, data in .local-data/geldoverzicht.db
# or in two terminals:
npm run api          # local API on http://127.0.0.1:3333/api
npx ng serve --configuration local-db
npm run test:api     # API tests (node:test)
```

- The header shows **Lokale database** when this mode is active; a banner explains what to do
  when the API is not running.
- The database is a single file in `.local-data/` (override with `GELDOVERZICHT_DB=/path/file.db`,
  the port with `PORT`). Open it with any SQLite tool, e.g. DB Browser for SQLite. Delete the
  file to start fresh.
- `.local-data/`, `*.db` and `*.csv` are git-ignored, so neither the database nor bank exports
  end up in the (public) repository.
- The API only listens on 127.0.0.1, only accepts requests addressed to localhost (protection
  against DNS rebinding), rejects requests from other websites and only accepts JSON. Amounts
  are stored in whole cents.
- `npm start` and the GitHub Pages build keep using browser storage; only the `local-db`
  configuration swaps in the database (via `fileReplacements` of `src/environments/persistence.ts`).

## Architecture

Angular 22 (standalone components, signals, zoneless change detection, new control flow),
TypeScript in strict mode, Vitest for unit tests.

```
server/                Local SQLite API for development (node:http + node:sqlite)
scripts/start-local.mjs  Starts the API and `ng serve --configuration local-db`
src/environments/      Persistence providers per build configuration
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
│   ├── persistence/            where data is kept: browser (default) or local SQLite API
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
- **Stores** own state as signals and persist it through the `PERSISTENCE` interface
  (`BrowserPersistence` or `LocalDbPersistence`). Stored data is loaded by an app initializer
  before the first route resolves. Stores never compute views.
- **The facade** combines the stores into view models with `computed` and is the only thing the
  dashboard talks to.
- **Components** are `OnPush` and presentational: signal `input()`s in, `output()`s out. Only the
  two pages inject services.
- **Routing** uses hash URLs (`#/overzicht`) so it works on static hosting; the dashboard is
  lazy-loaded and guarded (no data → import page).

### Decisions

- **No backend in production.** Bank data is sensitive; keeping it in the browser avoids
  accounts, hosting and data protection obligations. The trade-off: data lives in one browser.
  The SQLite API in `server/` is a local development tool and uses Node built-ins only, so it
  adds no dependencies.
- **Categories are identified by their Dutch name.** They are user-facing and user-defined; a
  separate id would add mapping without benefit here.
- **Own-account transfers count as saving on the main account** and as internal on the other
  accounts, so money moved to savings is counted once even when both exports are imported.
- **Refunds are netted** against their category instead of counted as income.

## Testing

`npm run test:ci` runs all specs:

- domain specs in `core/**` (parsing, rules, analysis, settings updates, demo export),
- store/facade integration specs using the demo data,
- component specs for the KPI cards, budget split, chart, category select and the full dashboard,
- persistence specs (browser storage, HTTP calls to the local API, error handling).

`npm run test:api` runs the local API tests against an in-memory SQLite database.

## Deployment

- `.github/workflows/ci.yml` checks formatting, runs the unit and API tests and builds (also the
  `local-db` configuration) on pushes to `main` and `development` and on pull requests.
- `.github/workflows/deploy.yml` builds `main` and publishes it to GitHub Pages. It skips (with a
  notice) until Pages is enabled with _GitHub Actions_ as the source.
