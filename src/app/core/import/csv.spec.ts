import { decodeText, detectDelimiter, parseCsv } from './csv';

describe('parseCsv', () => {
  it('parses quoted fields with commas, escaped quotes and line breaks', () => {
    const text = '"a","b"\r\n"1,5","say ""hi"""\n"multi\nline",x';
    expect(parseCsv(text)).toEqual([
      ['a', 'b'],
      ['1,5', 'say "hi"'],
      ['multi\nline', 'x'],
    ]);
  });

  it('detects semicolon-separated (ING) files', () => {
    expect(detectDelimiter('"Datum";"Naam / Omschrijving";"Bedrag (EUR)"')).toBe(';');
    expect(parseCsv('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('skips empty lines, including a trailing newline', () => {
    expect(parseCsv('a,b\n\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('decodeText', () => {
  it('strips a UTF-8 byte order mark', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x61]);
    expect(decodeText(bytes)).toBe('a');
  });

  it('falls back to Windows-1252 for older exports', () => {
    // "initiërende" with ë encoded as 0xEB (invalid UTF-8)
    const bytes = new Uint8Array([
      0x69, 0x6e, 0x69, 0x74, 0x69, 0xeb, 0x72, 0x65, 0x6e, 0x64, 0x65,
    ]);
    expect(decodeText(bytes)).toBe('initiërende');
  });
});
