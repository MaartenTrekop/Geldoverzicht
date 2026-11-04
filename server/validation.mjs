// Checks request bodies before they reach the database.

export class ValidationError extends Error {}

const STRING_FIELDS = [
  'id',
  'date',
  'month',
  'account',
  'counterpartyIban',
  'counterpartyName',
  'description',
  'code',
];

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Validates a list of bank transactions as sent by the app.
 * @param {unknown} body
 */
export function parseTransactions(body) {
  if (!Array.isArray(body)) throw new ValidationError('Verwacht een lijst met transacties.');
  return body.map((item, index) => {
    if (!isRecord(item)) throw new ValidationError(`Transactie ${index} is geen object.`);
    for (const field of STRING_FIELDS) {
      if (typeof item[field] !== 'string') {
        throw new ValidationError(`Transactie ${index}: "${field}" ontbreekt of is geen tekst.`);
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || item.month !== item.date.slice(0, 7)) {
      throw new ValidationError(`Transactie ${index}: ongeldige datum.`);
    }
    if (typeof item.amount !== 'number' || !Number.isFinite(item.amount)) {
      throw new ValidationError(`Transactie ${index}: ongeldig bedrag.`);
    }
    const balanceAfter = item.balanceAfter ?? null;
    if (
      balanceAfter !== null &&
      (typeof balanceAfter !== 'number' || !Number.isFinite(balanceAfter))
    ) {
      throw new ValidationError(`Transactie ${index}: ongeldig saldo.`);
    }
    const order = Number.isInteger(item.order) ? item.order : index;
    return { ...item, order, balanceAfter };
  });
}

/**
 * Settings are stored as one JSON document; the app validates their contents when loading.
 * @param {unknown} body
 */
export function parseSettings(body) {
  if (!isRecord(body)) throw new ValidationError('Verwacht een object met instellingen.');
  return body;
}
