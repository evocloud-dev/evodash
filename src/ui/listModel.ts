/**
 * Sorting, grouping and export for the list pages, without React.
 *
 * Every page that lists things (applications, addons, schemas, endpoints)
 * offers the same ways to arrange the list: sort by a field, group by a field,
 * and export what is on screen. The rules for doing that live here, apart from
 * any page, so they are the same everywhere and testable on their own.
 */

export type SortDir = 'asc' | 'desc';

export interface SortState {
  key: string;
  dir: SortDir;
}

/** A field the list can be sorted by. */
export interface SortField<R> {
  key: string;
  label: string;
  /** The value compared. Null sorts last whichever way the list runs. */
  value: (row: R) => string | number | null;
  /** The direction a first click picks, e.g. newest first for a date. */
  firstDir?: SortDir;
}

/** A field the list can be grouped by. */
export interface GroupField<R> {
  key: string;
  label: string;
  /** The group a row belongs to. */
  value: (row: R) => string;
  /**
   * Group order. By default groups are in alphabetical order; a field whose
   * groups have a natural order (severity, say) gives it here.
   */
  order?: string[];
}

/** Grouping turned off: the whole list as one group. */
export const NO_GROUP = 'none';

/** One column of an export. */
export interface ExportField<R> {
  label: string;
  value: (row: R) => string | number | boolean | null;
}

function compareValues(a: string | number | null, b: string | number | null): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * The rows in the requested order.
 *
 * Stable: rows that compare equal keep the order they came in, so a page that
 * hands over an already ordered list (namespace, then name) keeps that order
 * as the tie-break. Nulls go last in both directions, because "no value" is not
 * the smallest or largest value, it is the absence of one.
 */
export function sortRows<R>(rows: R[], field: SortField<R> | undefined, dir: SortDir): R[] {
  if (!field) {
    return rows;
  }
  const keyed = rows.map((row, index) => ({ row, index, value: field.value(row) }));
  keyed.sort((a, b) => {
    const aNull = a.value === null || a.value === '';
    const bNull = b.value === null || b.value === '';
    if (aNull || bNull) {
      return aNull === bNull ? a.index - b.index : aNull ? 1 : -1;
    }
    const c = compareValues(a.value, b.value);
    return (dir === 'asc' ? c : -c) || a.index - b.index;
  });
  return keyed.map(k => k.row);
}

/** What clicking a sortable header does: the same field flips, a new one starts fresh. */
export function nextSort<R>(current: SortState, field: SortField<R>): SortState {
  if (current.key === field.key) {
    return { key: field.key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  }
  return { key: field.key, dir: field.firstDir ?? 'asc' };
}

export interface RowGroup<R> {
  name: string;
  rows: R[];
}

/** The rows split into groups, each keeping the rows' order. */
export function groupRows<R>(rows: R[], field: GroupField<R> | undefined): RowGroup<R>[] {
  if (!field) {
    return [{ name: '', rows }];
  }
  const groups = new Map<string, R[]>();
  for (const row of rows) {
    const name = field.value(row) || '—';
    const list = groups.get(name);
    if (list) {
      list.push(row);
    } else {
      groups.set(name, [row]);
    }
  }
  const rank = (name: string) => {
    const i = field.order?.indexOf(name) ?? -1;
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...groups]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([name, list]) => ({ name, rows: list }));
}

function csvCell(value: string | number | boolean | null): string {
  if (value === null || value === undefined) {
    return '';
  }
  const text = String(value);
  // Text from the cluster that starts with = + - or @ gets a leading
  // apostrophe, so a spreadsheet shows it as text instead of running it as a
  // formula. Numbers are left alone: -5 is a number, not a formula.
  const guarded = typeof value === 'string' && /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/** The rows as CSV, one header line then one line per row. */
export function toCsv<R>(rows: R[], fields: ExportField<R>[]): string {
  const lines = [fields.map(f => csvCell(f.label)).join(',')];
  for (const row of rows) {
    lines.push(fields.map(f => csvCell(f.value(row))).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

/** The rows as a JSON array of objects keyed by the export labels. */
export function toJson<R>(rows: R[], fields: ExportField<R>[]): string {
  const objects = rows.map(row =>
    Object.fromEntries(fields.map(f => [f.label, f.value(row) ?? null]))
  );
  return JSON.stringify(objects, null, 2) + '\n';
}

/** A file name for an export: the list's name and today's date. */
export function exportFileName(list: string, ext: 'csv' | 'json', now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  const slug = list
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug}-${day}.${ext}`;
}
