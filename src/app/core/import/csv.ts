const BOM = '\uFEFF';

/**
 * Decodes an exported file. Rabobank and ING have used both UTF-8 and Windows-1252
 * over the years, so try strict UTF-8 first and fall back.
 */
export function decodeText(buffer: ArrayBuffer | Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder('windows-1252').decode(buffer);
  }
  return text.startsWith(BOM) ? text.slice(1) : text;
}

/** Rabobank uses commas, ING semicolons. */
export function detectDelimiter(firstLine: string): ',' | ';' {
  return firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
}

/** RFC 4180 style parser: quoted fields, escaped quotes (`""`), CRLF or LF. Skips empty lines. */
export function parseCsv(text: string): string[][] {
  const delimiter = detectDelimiter(text.split(/\r?\n/, 1)[0] ?? '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  const endRow = () => {
    row.push(field);
    field = '';
    if (row.some((value) => value.trim() !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else {
      field += char;
    }
  }
  endRow();
  return rows;
}
