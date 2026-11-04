import { formatDate, formatEuro, formatSignedEuro, parseEuroInput } from './format';

// Intl inserts a (narrow) no-break space after the euro sign; compare on normal spaces.
const plain = (text: string) => text.replace(/\s/g, ' ');

describe('format', () => {
  it('formats euros in Dutch notation without "-0"', () => {
    expect(plain(formatEuro(1234.4))).toBe('€ 1.234');
    expect(plain(formatEuro(1234.5, 2))).toBe('€ 1.234,50');
    expect(plain(formatEuro(-0.3))).toBe('€ 0');
    expect(plain(formatSignedEuro(25))).toBe('+€ 25,00');
  });

  it('formats dates', () => {
    expect(formatDate('2026-10-03')).toBe('03-10-2026');
  });

  it('parses amounts typed by the user', () => {
    expect(parseEuroInput('1.250')).toBe(1250);
    expect(parseEuroInput('1250,50')).toBe(1250.5);
    expect(parseEuroInput('€ 300')).toBe(300);
    expect(parseEuroInput('12.5')).toBe(12.5);
    expect(parseEuroInput('')).toBeNull();
    expect(parseEuroInput('veel')).toBeNull();
  });
});
