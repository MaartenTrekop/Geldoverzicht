const euro0 = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
const euro2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

/** "€ 1.234" or, with two decimals, "€ 1.234,56". Rounds away "-0". */
export function formatEuro(value: number, decimals: 0 | 2 = 0): string {
  const threshold = decimals === 0 ? 0.5 : 0.005;
  const safe = Math.abs(value) < threshold ? 0 : value;
  return (decimals === 0 ? euro0 : euro2).format(safe);
}

/** "+€ 25,00" / "€ -12,50" style for transaction amounts. */
export function formatSignedEuro(value: number): string {
  return (value > 0 ? '+' : '') + formatEuro(value, 2);
}

/** `2026-10-03` → `03-10-2026`. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}-${month}-${year}`;
}

/** Parses user input such as "1.250", "1250,50" or "€ 300". Empty or invalid gives `null`. */
export function parseEuroInput(value: string): number | null {
  let text = value.replace(/[\s€]/g, '');
  if (!text) return null;
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, '');
  const amount = Number(text);
  return Number.isFinite(amount) ? amount : null;
}
