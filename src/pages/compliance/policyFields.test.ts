import { describe, expect, it, vi } from 'vitest';
import { PolicyScore, PolicySeverity, ResourceFailures } from '../../k8s/kyverno';
import { groupRows, sortRows } from '../../ui/listModel';
import {
  matchesPolicy,
  matchesResource,
  POLICY_GROUP_FIELDS,
  POLICY_SORT_FIELDS,
  RESOURCE_GROUP_FIELDS,
  RESOURCE_SORT_FIELDS,
  sortPolicies,
} from './policyFields';

// Headlamp's resource classes do not load outside the app, and nothing here
// touches them.
vi.mock('@kinvolk/headlamp-plugin/lib/lib/k8s/crd', () => ({
  makeCustomResourceClass: () => ({}),
}));

function policy(
  title: string,
  severity: PolicySeverity,
  failed: number,
  evaluated: number,
  action: PolicyScore['action'] = 'Audit'
): PolicyScore {
  return {
    key: title,
    ref: title.toLowerCase(),
    kind: 'ClusterPolicy',
    source: 'kyverno',
    name: title.toLowerCase(),
    namespace: null,
    meta: { title, category: '', severity, description: '' },
    action,
    ready: null,
    rules: 1,
    checks: { pass: evaluated - failed, fail: failed, warn: 0, error: 0, skip: 0 },
    evaluated,
    failed,
    score: evaluated ? ((evaluated - failed) / evaluated) * 100 : 100,
    failing: [],
    chart: '',
    exceptions: [],
  } as PolicyScore;
}

const policies = [
  policy('Low passing', 'Low', 0, 4),
  policy('High half', 'High', 2, 4),
  policy('Medium most', 'Medium', 3, 4, 'Enforce'),
  policy('Critical passing', 'Critical', 0, 4),
  policy('Unchecked', 'Medium', 0, 0),
];

const field = (key: string) => POLICY_SORT_FIELDS.find(f => f.key === key);

describe('policies', () => {
  it('sorts worst first: failing by score, then the rest by severity', () => {
    const titles = sortRows(sortPolicies(policies), field('worst'), 'asc').map(p => p.meta.title);
    expect(titles).toEqual([
      'Medium most',
      'High half',
      'Critical passing',
      'Unchecked',
      'Low passing',
    ]);
    // The same order sortPolicies gives on its own.
    expect(sortPolicies(policies).map(p => p.meta.title)).toEqual(titles);
  });

  it('groups by severity in severity order, not alphabetically', () => {
    const groups = groupRows(
      policies,
      POLICY_GROUP_FIELDS.find(f => f.key === 'severity')
    );
    expect(groups.map(g => g.name)).toEqual(['Critical', 'High', 'Medium', 'Low']);
  });

  it('filters by status, mode and text', () => {
    const base = { query: '', status: 'all', mode: 'all' };
    expect(policies.filter(p => matchesPolicy(p, { ...base, status: 'failing' }))).toHaveLength(2);
    expect(policies.filter(p => matchesPolicy(p, { ...base, status: 'unevaluated' }))).toHaveLength(
      1
    );
    expect(policies.filter(p => matchesPolicy(p, { ...base, mode: 'Enforce' }))).toHaveLength(1);
    expect(policies.filter(p => matchesPolicy(p, { ...base, query: 'critical' }))).toHaveLength(1);
  });
});

function offender(
  name: string,
  namespace: string | null,
  severity: PolicySeverity,
  system: boolean
): ResourceFailures {
  return {
    resource: { key: name, kind: 'Pod', name, namespace },
    system,
    severity,
    policies: [
      {
        ref: 'p',
        title: 'Disallow Privileged',
        severity,
        failure: { resource: { key: name, kind: 'Pod', name, namespace }, rules: [], messages: [] },
      },
    ],
  };
}

describe('failing resources', () => {
  const offenders = [
    offender('kube-proxy', 'kube-system', 'High', true),
    offender('web', 'shop', 'Low', false),
    offender('api', 'shop', 'High', false),
  ];

  it('sorts worst first: workloads before system, then by severity', () => {
    const worst = RESOURCE_SORT_FIELDS.find(f => f.key === 'worst');
    expect(sortRows(offenders, worst, 'asc').map(o => o.resource.name)).toEqual([
      'api',
      'web',
      'kube-proxy',
    ]);
  });

  it('puts workload namespaces before system ones when grouped by side', () => {
    const side = RESOURCE_GROUP_FIELDS.find(f => f.key === 'side');
    expect(groupRows(offenders, side).map(g => g.name)).toEqual([
      'Workload namespaces',
      'System namespaces',
    ]);
  });

  it('matches policy titles as well as the resource', () => {
    expect(matchesResource(offenders[0], 'privileged')).toBe(true);
    expect(matchesResource(offenders[0], 'shop')).toBe(false);
  });
});
