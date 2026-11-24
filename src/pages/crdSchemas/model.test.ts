import { describe, expect, it, vi } from 'vitest';
import { sortRows } from '../../ui/listModel';
import { compareVersions, orderSchemas, SchemaView, SORT_FIELDS, versionRank } from './model';

// ui/chrome pulls in Headlamp, which does not load outside the app; the model
// only needs its text matching, which none of these tests use.
vi.mock('../../ui/chrome', () => ({ fuzzyMatch: () => true, fuzzyMatchAny: () => true }));

const view = (kind: string, version: string): SchemaView =>
  ({ key: `${kind}/${version}`, kind, version } as SchemaView);

describe('versionRank', () => {
  it('ranks GA above beta above alpha, and by number within each', () => {
    const versions = ['v1alpha1', 'v1beta1', 'v1', 'v2', 'v10', 'v1beta2', 'v2alpha1'];
    const ranked = [...versions].sort((a, b) => versionRank(b) - versionRank(a));
    expect(ranked).toEqual(['v10', 'v2', 'v1', 'v1beta2', 'v1beta1', 'v2alpha1', 'v1alpha1']);
  });

  it('agrees with compareVersions', () => {
    const versions = ['v1alpha1', 'v1beta1', 'v1', 'v2', 'v10', 'v1beta2', 'v2alpha1', 'latest'];
    const byRank = [...versions].sort((a, b) => versionRank(b) - versionRank(a));
    const byCompare = [...versions].sort((a, b) => compareVersions({ version: a }, { version: b }));
    expect(byRank).toEqual(byCompare);
  });

  it('puts a name that is not a Kubernetes version below every real one', () => {
    expect(versionRank('latest')).toBeLessThan(versionRank('v1alpha1'));
  });
});

describe('schema sort', () => {
  it('keeps a kind’s versions newest first when sorted by kind', () => {
    const ordered = orderSchemas([
      view('Gateway', 'v1beta1'),
      view('App', 'v1'),
      view('Gateway', 'v1'),
    ]);
    const byKind = SORT_FIELDS.find(f => f.key === 'kind');
    expect(sortRows(ordered, byKind, 'asc').map(s => s.key)).toEqual([
      'App/v1',
      'Gateway/v1',
      'Gateway/v1beta1',
    ]);
  });

  it('sorts by version precedence, not by the string', () => {
    const byVersion = SORT_FIELDS.find(f => f.key === 'version');
    const rows = [view('A', 'v1beta1'), view('B', 'v10'), view('C', 'v2')];
    expect(sortRows(rows, byVersion, 'desc').map(s => s.version)).toEqual(['v10', 'v2', 'v1beta1']);
  });
});
