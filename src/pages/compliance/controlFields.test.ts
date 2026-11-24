import { describe, expect, it } from 'vitest';
import type { ControlScore } from '../../k8s/kubescape';
import { sortRows } from '../../ui/listModel';
import {
  CONTROL_SORT_FIELDS,
  controlStatus,
  matchesControl,
  worstFirstRank,
} from './controlFields';

function control(
  controlID: string,
  failed: number,
  evaluated: number,
  score: number
): ControlScore {
  return {
    controlID,
    name: `Control ${controlID}`,
    category: null,
    severity: 'Medium',
    passed: evaluated - failed,
    failed,
    evaluated,
    score,
    failing: [],
  };
}

describe('worst first', () => {
  it('puts failing controls first by score, then the rest by numeric ID', () => {
    const controls = [
      control('C-0270', 0, 4, 100),
      control('C-0045', 2, 4, 50),
      control('C-0009', 0, 0, 100),
      control('C-0101', 3, 4, 25),
      control('C-0046', 0, 3, 100),
    ];
    const worst = CONTROL_SORT_FIELDS.find(f => f.key === 'worst');
    expect(sortRows(controls, worst, 'asc').map(c => c.controlID)).toEqual([
      'C-0101',
      'C-0045',
      'C-0009',
      'C-0046',
      'C-0270',
    ]);
    expect(worstFirstRank(control('C-0001', 1, 1, 100))).toBeLessThan(
      worstFirstRank(control('C-0000', 0, 1, 100))
    );
  });
});

describe('filters', () => {
  it('reads status and matches ID or name', () => {
    expect(controlStatus(control('C-1', 1, 2, 50))).toBe('failing');
    expect(controlStatus(control('C-1', 0, 0, 100))).toBe('not-evaluated');
    expect(controlStatus(control('C-1', 0, 2, 100))).toBe('passing');
    const c = control('C-0045', 1, 2, 50);
    expect(matchesControl(c, { query: '0045', status: 'all', severity: 'all' })).toBe(true);
    expect(matchesControl(c, { query: 'control c', status: 'failing', severity: 'all' })).toBe(
      true
    );
    expect(matchesControl(c, { query: '', status: 'passing', severity: 'all' })).toBe(false);
    expect(matchesControl(c, { query: '', status: 'all', severity: 'High' })).toBe(false);
  });
});
