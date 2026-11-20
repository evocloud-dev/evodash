import { describe, expect, it, vi } from 'vitest';
import { ScannedResource, scoreAllFrameworks } from './kubescape';
import { KUBESCAPE_CONTROLS, KUBESCAPE_FRAMEWORKS } from './kubescapeFrameworks';

// The scoring under test never makes a request; Headlamp's API proxy does not
// load outside the app.
vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({ request: vi.fn() }));

function resource(key: string, outcomes: Record<string, 'passed' | 'failed'>): ScannedResource {
  return {
    key,
    kind: 'Deployment',
    name: key,
    namespace: 'default',
    outcomes: new Map(Object.entries(outcomes)),
    severities: new Map(),
  };
}

describe('Kubescape frameworks', () => {
  it('has a name, score and category for every control a framework lists', () => {
    const unknown = KUBESCAPE_FRAMEWORKS.flatMap(f =>
      f.controlIDs.filter(id => !KUBESCAPE_CONTROLS[id]).map(id => `${f.name} ${id}`)
    );
    expect(unknown).toEqual([]);
  });

  it('scores ArmoBest from the controls it lists', () => {
    const armo = scoreAllFrameworks([
      resource('a', { 'C-0061': 'failed', 'C-0002': 'passed' }),
      resource('b', { 'C-0061': 'passed' }),
    ]).find(f => f.framework.name === 'ArmoBest');

    expect(armo?.controls).toHaveLength(40);
    expect(armo?.evaluatedControls).toBe(2);
    expect(armo?.failingControls).toBe(1);
    expect(armo?.failingResources).toBe(1);
    const pods = armo?.controls.find(c => c.controlID === 'C-0061');
    expect(pods?.name).toBe('Pods in default namespace');
    expect(pods?.score).toBe(50);
  });
});
