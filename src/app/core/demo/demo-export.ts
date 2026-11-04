import { DEFAULT_SETTINGS, Settings } from '../models/settings';
import { addMonths, toYearMonth } from '../period/months';

/*
 * Generates a realistic Rabobank CSV export (13 months up to today) for a household of two,
 * including a separate savings account and a horse with its own account. The demo goes
 * through the same import code as a real file.
 */

export const DEMO_MAIN_ACCOUNT = 'NL11RABO0123456789';
export const DEMO_SAVINGS_ACCOUNT = 'NL22RABO0987654321';
export const DEMO_HORSE_ACCOUNT = 'NL33RABO0555555555';

/** Settings that go with the demo export: a custom category, owners, account names and pots. */
export function createDemoSettings(today: Date): Settings {
  return {
    ...DEFAULT_SETTINGS,
    customCategories: [{ name: 'Paard', kind: 'expense', owner: 'person2' }],
    categoryByCounterparty: { [`rek:${DEMO_HORSE_ACCOUNT}`]: 'Paard' },
    ownerByCounterparty: {
      'werkgever noord bv': 'person1',
      'zorggroep de linde': 'person2',
      'steam games': 'person1',
      decathlon: 'person1',
      'zalando se': 'person2',
    },
    accountNames: {
      [DEMO_HORSE_ACCOUNT]: 'Paardrekening',
      [DEMO_SAVINGS_ACCOUNT]: 'Spaarrekening',
    },
    savingsPots: [
      {
        id: 'buffer',
        name: 'Buffer',
        target: 15000,
        deadline: null,
        balance: 0,
        balanceDate: null,
        monthly: 300,
        linkedAccount: DEMO_SAVINGS_ACCOUNT,
        owner: 'shared',
      },
      {
        id: 'vakantie',
        name: 'Vakantie',
        target: 3500,
        deadline: addMonths(toYearMonth(today), 8),
        balance: 1250,
        balanceDate: null,
        monthly: 200,
        linkedAccount: null,
        owner: 'shared',
      },
      {
        id: 'auto',
        name: 'Nieuwe auto',
        target: 12000,
        deadline: null,
        balance: 4300,
        balanceDate: null,
        monthly: 0,
        linkedAccount: null,
        owner: 'shared',
      },
    ],
  };
}

const HEADER = [
  'IBAN/BBAN',
  'Munt',
  'BIC',
  'Volgnr',
  'Datum',
  'Rentedatum',
  'Bedrag',
  'Saldo na trn',
  'Tegenrekening IBAN/BBAN',
  'Naam tegenpartij',
  'Naam uiteindelijke partij',
  'Naam initiërende partij',
  'BIC tegenpartij',
  'Code',
  'Batch ID',
  'Transactiereferentie',
  'Machtigingskenmerk',
  'Incassant ID',
  'Betalingskenmerk',
  'Omschrijving-1',
  'Omschrijving-2',
  'Omschrijving-3',
  'Reden retour',
  'Oorspr bedrag',
  'Oorspr munt',
  'Koers',
];

interface DemoRow {
  readonly date: string;
  readonly amount: number;
  readonly name: string;
  readonly description: string;
  readonly code: string;
  readonly iban: string;
}

/** Small deterministic PRNG (Park–Miller), so the demo looks the same every time. */
function random(seed: number): () => number {
  let state = seed;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

const quote = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
const rabobankAmount = (n: number) =>
  `${n >= 0 ? '+' : '-'}${Math.abs(n).toFixed(2).replace('.', ',')}`;

export function generateDemoExport(today: Date, seed = 7): string {
  const rnd = random(seed);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)];
  const rows: DemoRow[] = [];

  for (let back = 12; back >= 0; back--) {
    const first = new Date(today.getFullYear(), today.getMonth() - back, 1);
    const year = first.getFullYear();
    const month = first.getMonth() + 1;
    const mm = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    const maxDay = back === 0 ? today.getDate() : lastDay;
    const anyDay = () => 1 + Math.floor(rnd() * 28);
    const add = (
      day: number,
      amount: number,
      name: string,
      description: string,
      code = 'bg',
      iban = '',
    ) => {
      if (day > maxDay) return;
      const date = `${year}-${mm}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
      rows.push({ date, amount: Math.round(amount * 100) / 100, name, description, code, iban });
    };

    // Income
    add(24, 3185.4, 'Werkgever Noord BV', `Salaris ${mm}-${year}`, 'cb', 'NL55INGB0001234567');
    add(23, 2412.75, 'Zorggroep De Linde', `Salaris periode ${month}`, 'cb', 'NL66ABNA0412345678');
    if (month === 5) {
      add(24, 2380, 'Werkgever Noord BV', `Vakantiegeld ${year}`, 'cb', 'NL55INGB0001234567');
      add(23, 1795.1, 'Zorggroep De Linde', 'Vakantietoeslag', 'cb', 'NL66ABNA0412345678');
    }
    if (month === 4)
      add(18, 1240, 'Belastingdienst', 'Teruggaaf inkomstenbelasting', 'cb', 'NL86INGB0002445588');

    // Fixed costs
    add(1, -1268.32, 'Rabobank Hypotheken', `Hypotheek termijn ${mm}`, 'ei', 'NL44RABO0300000001');
    add(3, -172, 'Eneco Consumenten BV', 'Termijnbedrag energie', 'ei', 'NL33INGB0000000001');
    add(5, -24.8, 'Vitens NV', 'Voorschot drinkwater', 'ei', 'NL20RABO0300000002');
    add(
      1,
      -296.4,
      'Zilveren Kruis Zorgverzekeringen',
      `Premie ${mm} 2 personen`,
      'ei',
      'NL10INGB0000000003',
    );
    add(
      1,
      -41.17,
      'Centraal Beheer',
      'Woonhuis- en inboedelverzekering',
      'ei',
      'NL98RABO0300000004',
    );
    add(8, -64.5, 'Interpolis', 'Autoverzekering', 'ei', 'NL98RABO0300000009');
    add(12, -13.99, 'Netflix International BV', 'Netflix maand', 'ei', 'NL70ABNA0000000005');
    add(14, -17.99, 'Spotify AB', 'Spotify Premium Duo', 'ei', 'NL70ABNA0000000006');
    add(20, -31, 'Odido Netherlands BV', 'Mobiel abonnement', 'ei', 'NL70ABNA0000000007');
    add(22, -62.5, 'Ziggo Services BV', 'Internet + TV', 'ei', 'NL70ABNA0000000008');
    add(27, -29.99, 'Basic-Fit Nederland BV', 'Lidmaatschap', 'ei', 'NL70ABNA0000000010');
    if (month >= 3 && month <= 11)
      add(28, -48.2, 'BSGW', 'Gemeentelijke belastingen termijn', 'ei', 'NL70BNGH0000000011');

    // Transfers to own accounts and investments
    add(2, -400, 'W. de Vries', `Paard ${mm}`, 'tb', DEMO_HORSE_ACCOUNT);
    add(26, -500, 'M. de Vries', 'Naar spaarrekening', 'tb', DEMO_SAVINGS_ACCOUNT);
    add(26, -150, 'DEGIRO', 'Storting beleggingsrekening', 'id', 'NL70FLOR0000000012');

    // Personal spending
    if (rnd() < 0.5)
      add(anyDay(), -(10 + rnd() * 50), 'Steam Games', 'Aankoop', 'id', 'NL70INGB0000000024');
    if (rnd() < 0.3) add(anyDay(), -(20 + rnd() * 80), 'Decathlon', 'Sportartikelen', 'bc');

    // Occasional larger expenses
    if (month === 7) {
      add(3, -1240, 'Booking.com BV', 'Reservering vakantie', 'id', 'NL70INGB0000000013');
      add(9, -315, 'Transavia', 'Vliegtickets', 'id', 'NL70INGB0000000014');
    }
    if (month === 12) add(15, -389, 'Coolblue BV', 'Bestelling', 'id', 'NL70INGB0000000015');
    if (month === 2 || month === 8)
      add(10, -(380 + rnd() * 120), 'Garage Van Dijk', 'Onderhoud auto + APK', 'bc');

    // Day-to-day spending
    const groceries = [
      'Albert Heijn 1352',
      'Jumbo Utrecht',
      'Lidl 0274',
      'Albert Heijn 8812',
      'Picnic',
    ];
    const shopCount = 7 + Math.floor(rnd() * 4);
    for (let i = 0; i < shopCount; i++) {
      const shop = pick(groceries);
      add(anyDay(), -(18 + rnd() * 95), shop, `Apple Pay ${shop.split(' ')[0]}`, 'bc');
    }
    const meals = [
      'Thuisbezorgd.nl',
      'Brasserie De Haven',
      'Starbucks Centraal',
      'Pizzeria Napoli',
    ];
    for (let i = 0; i < 2 + Math.floor(rnd() * 3); i++)
      add(anyDay(), -(22 + rnd() * 38), pick(meals), 'Betaalautomaat', 'bc');
    const fuel = ['Shell Station A12', 'Tango Zeist', 'TinQ Bilthoven'];
    for (let i = 0; i < 2; i++) add(anyDay(), -(58 + rnd() * 30), pick(fuel), 'Tanken', 'bc');
    for (let i = 0; i < 3; i++)
      add(anyDay(), -(6 + rnd() * 14), 'NS Groep IZ NS Reizigers', 'OV-chipkaart reis', 'bc');
    const shops = ['bol.com', 'HEMA', 'Action 1234', 'Kruidvat 7766', 'IKEA Utrecht', 'Zalando SE'];
    for (let i = 0; i < 1 + Math.floor(rnd() * 3); i++)
      add(anyDay(), -(9 + rnd() * 70), pick(shops), 'Aankoop', pick(['bc', 'id']));
    if (rnd() < 0.6) add(anyDay(), -50, 'Geldautomaat Utrecht', 'Geldopname', 'ga');
    if (rnd() < 0.7)
      add(anyDay(), -(8 + rnd() * 30), 'AAB INZ TIKKIE', 'Tikkie betaalverzoek etentje', 'id');
    if (rnd() < 0.5) add(anyDay(), 10 + rnd() * 40, 'AAB INZ TIKKIE', 'Tikkie terugbetaling', 'cb');
    if (rnd() < 0.3) add(anyDay(), -(12 + rnd() * 40), 'Apotheek De Brug', 'Medicijnen', 'bc');
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));

  const lines = [HEADER.map(quote).join(',')];
  let sequence = 1;
  let mainBalance = 4200;
  let savingsBalance = 8500;
  const line = (
    account: string,
    row: DemoRow,
    amount: number,
    balance: number,
    counterparty: string,
    name: string,
    description: string,
  ) =>
    [
      account,
      'EUR',
      'RABONL2U',
      String(sequence++).padStart(18, '0'),
      row.date,
      row.date,
      rabobankAmount(amount),
      rabobankAmount(balance),
      counterparty,
      name,
      '',
      '',
      '',
      row.code,
      '',
      '',
      '',
      '',
      '',
      description,
      '',
      '',
      '',
      '',
      '',
      '',
    ]
      .map(quote)
      .join(',');

  for (const row of rows) {
    mainBalance += row.amount;
    lines.push(
      line(DEMO_MAIN_ACCOUNT, row, row.amount, mainBalance, row.iban, row.name, row.description),
    );
    // The savings account is exported too, so the same transfer shows up there as incoming.
    if (row.iban === DEMO_SAVINGS_ACCOUNT) {
      savingsBalance -= row.amount;
      lines.push(
        line(
          DEMO_SAVINGS_ACCOUNT,
          row,
          -row.amount,
          savingsBalance,
          DEMO_MAIN_ACCOUNT,
          'M. de Vries',
          'Van betaalrekening',
        ),
      );
    }
  }
  return lines.join('\n');
}
