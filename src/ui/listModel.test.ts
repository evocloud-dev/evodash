import { describe, expect, it } from 'vitest';
import {
  exportFileName,
  groupRows,
  nextSort,
  SortField,
  sortRows,
  toCsv,
  toJson,
} from './listModel';

interface Row {
  name: string;
  size: number | null;
  team: string;
}

const rows: Row[] = [
  { name: 'b', size: 2, team: 'ops' },
  { name: 'a10', size: null, team: 'dev' },
  { name: 'a2', size: 5, team: 'ops' },
  { name: 'c', size: 2, team: 'dev' },
];

const byName: SortField<Row> = { key: 'name', label: 'Name', value: r => r.name };
const bySize: SortField<Row> = { key: 'size', label: 'Size', value: r => r.size, firstDir: 'desc' };

describe('sortRows', () => {
  it('sorts text naturally, so a2 comes before a10', () => {
    expect(sortRows(rows, byName, 'asc').map(r => r.name)).toEqual(['a2', 'a10', 'b', 'c']);
    expect(sortRows(rows, byName, 'desc').map(r => r.name)).toEqual(['c', 'b', 'a10', 'a2']);
  });

  it('keeps the incoming order for ties and puts empty values last both ways', () => {
    expect(sortRows(rows, bySize, 'asc').map(r => r.name)).toEqual(['b', 'c', 'a2', 'a10']);
    expect(sortRows(rows, bySize, 'desc').map(r => r.name)).toEqual(['a2', 'b', 'c', 'a10']);
  });

  it('leaves the rows alone without a field', () => {
    expect(sortRows(rows, undefined, 'asc')).toBe(rows);
  });
});

describe('nextSort', () => {
  it('flips the same field and starts a new one in its first direction', () => {
    expect(nextSort({ key: 'name', dir: 'asc' }, byName)).toEqual({ key: 'name', dir: 'desc' });
    expect(nextSort({ key: 'name', dir: 'asc' }, bySize)).toEqual({ key: 'size', dir: 'desc' });
  });
});

describe('groupRows', () => {
  it('groups alphabetically, keeping row order inside each group', () => {
    const groups = groupRows(rows, { key: 'team', label: 'Team', value: r => r.team });
    expect(groups.map(g => [g.name, g.rows.map(r => r.name)])).toEqual([
      ['dev', ['a10', 'c']],
      ['ops', ['b', 'a2']],
    ]);
  });

  it('follows a given order before the alphabet', () => {
    const groups = groupRows(rows, {
      key: 'team',
      label: 'Team',
      value: r => r.team,
      order: ['ops'],
    });
    expect(groups.map(g => g.name)).toEqual(['ops', 'dev']);
  });

  it('is one unnamed group without a field', () => {
    expect(groupRows(rows, undefined)).toEqual([{ name: '', rows }]);
  });
});

describe('export', () => {
  const fields = [
    { label: 'name', value: (r: { name: string; n: number | null }) => r.name },
    { label: 'n', value: (r: { name: string; n: number | null }) => r.n },
  ];

  it('quotes commas and quotes, and guards text that a spreadsheet would run', () => {
    const csv = toCsv(
      [
        { name: 'a, "b"', n: -5 },
        { name: '=SUM(A1)', n: null },
      ],
      fields
    );
    expect(csv).toBe('name,n\r\n"a, ""b""",-5\r\n\'=SUM(A1),\r\n');
  });

  it('writes JSON keyed by the export labels', () => {
    expect(JSON.parse(toJson([{ name: 'x', n: null }], fields))).toEqual([{ name: 'x', n: null }]);
  });

  it('names the file after the list and the day', () => {
    expect(exportFileName('KubeVela applications', 'csv', new Date('2026-11-24T10:00:00Z'))).toBe(
      'kubevela-applications-2026-11-24.csv'
    );
  });
});
