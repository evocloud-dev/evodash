import { describe, expect, it, vi } from 'vitest';
import { groupRows, sortRows } from '../../ui/listModel';
import { AddonView, GROUP_FIELDS, SORT_FIELDS, statusOf } from './model';

// ui/chrome pulls in Headlamp, which does not load outside the app; the model
// only takes its fuzzy matcher, which these tests never reach.
vi.mock('../../ui/chrome', () => ({ fuzzyMatchAny: () => true }));

function view(name: string, extra: Partial<AddonView> = {}): AddonView {
  return {
    key: name,
    name,
    registry: 'KubeVela',
    tags: [],
    latest: '1.0.0',
    versionCount: 1,
    installed: null,
    updateAvailable: false,
    catalog: null,
    ...extra,
  };
}

const installed = { name: 'x', version: '1.0.0', application: 'addon-x', namespace: 'vela-system' };

const addons = [
  view('alpha'),
  view('bravo', { installed: { ...installed, name: 'bravo' } }),
  view('charlie', { installed: { ...installed, name: 'charlie' }, updateAvailable: true }),
  view('delta', { registry: null, tags: ['gitops'] }),
];

describe('addon status', () => {
  it('names each state', () => {
    expect(addons.map(statusOf)).toEqual([
      'Not installed',
      'Installed',
      'Update available',
      'Not installed',
    ]);
  });

  it('sorts updates first, then installed, then the rest', () => {
    const state = SORT_FIELDS.find(f => f.key === 'state');
    expect(sortRows(addons, state, 'asc').map(a => a.name)).toEqual([
      'charlie',
      'bravo',
      'alpha',
      'delta',
    ]);
  });

  it('groups by state in that order, and names the missing registry and tag', () => {
    const by = (key: string) => GROUP_FIELDS.find(f => f.key === key);
    expect(groupRows(addons, by('state')).map(g => g.name)).toEqual([
      'Update available',
      'Installed',
      'Not installed',
    ]);
    expect(groupRows(addons, by('registry')).map(g => g.name)).toEqual([
      'KubeVela',
      'Not in a catalog',
    ]);
    expect(groupRows(addons, by('tag')).map(g => g.name)).toEqual(['gitops', 'Untagged']);
  });
});
