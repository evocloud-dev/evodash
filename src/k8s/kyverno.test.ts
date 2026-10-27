import { describe, expect, it, vi } from 'vitest';
import {
  exceptedPolicies,
  failureAction,
  policyReadiness,
  readyToEnforce,
  scoreKyverno,
  totalChecks,
} from './kyverno';
import { isSystemNamespace } from './namespaces';

// Headlamp's resource classes do not load outside the app — its k8s modules
// import each other in a cycle — and the scoring under test never touches them.
vi.mock('@kinvolk/headlamp-plugin/lib/lib/k8s/crd', () => ({
  makeCustomResourceClass: () => ({}),
}));

/** A ClusterPolicy as the kyverno-policies chart writes it. */
const privileged = {
  metadata: {
    name: 'disallow-privileged-containers',
    annotations: {
      'policies.kyverno.io/title': 'Disallow Privileged Containers',
      'policies.kyverno.io/category': 'Pod Security Standards (Baseline)',
      'policies.kyverno.io/severity': 'medium',
    },
  },
  spec: {
    validationFailureAction: 'Audit',
    rules: [{ name: 'privileged-containers', validate: { failureAction: 'Audit' } }],
  },
  status: { conditions: [{ type: 'Ready', status: 'True', reason: 'Succeeded' }] },
};

const labels = {
  metadata: { name: 'require-labels', namespace: 'shop' },
  spec: { rules: [{ name: 'check-team', validate: { failureAction: 'Enforce' } }] },
};

/** One report per resource, named in `scope`, the way Kyverno 1.18 writes them. */
function report(scope: any, results: any[]) {
  return { metadata: { namespace: scope.namespace }, scope, results };
}

const deployment = { apiVersion: 'apps/v1', kind: 'Deployment', namespace: 'shop', name: 'api' };
const pod = { apiVersion: 'v1', kind: 'Pod', namespace: 'shop', name: 'api-7d9f' };

const reports = [
  // Kyverno's autogen copies fail the same Deployment twice: still one resource.
  report(deployment, [
    {
      policy: 'disallow-privileged-containers',
      rule: 'autogen-privileged-containers',
      result: 'fail',
      message: 'Privileged mode is disallowed.',
    },
    {
      policy: 'disallow-privileged-containers',
      rule: 'autogen-cronjob-privileged-containers',
      result: 'fail',
      message: 'Privileged mode is disallowed.',
    },
    { policy: 'shop/require-labels', rule: 'check-team', result: 'pass' },
  ]),
  report(pod, [
    { policy: 'disallow-privileged-containers', rule: 'privileged-containers', result: 'pass' },
    // A namespaced policy reported by its bare name.
    { policy: 'require-labels', rule: 'check-team', result: 'skip' },
    // A result for a policy the cluster does not have.
    { policy: 'vap-replicas', rule: '', result: 'warn', source: 'ValidatingAdmissionPolicy' },
  ]),
];

describe('scoreKyverno', () => {
  const posture = scoreKyverno(
    [
      { kind: 'ClusterPolicy', json: privileged },
      { kind: 'Policy', json: labels },
    ],
    reports
  );
  const byRef = new Map(posture.policies.map(p => [p.ref, p]));

  it('scores a policy by resource, not by rule', () => {
    const p = byRef.get('disallow-privileged-containers')!;
    expect(p.checks.fail).toBe(2);
    expect(p.evaluated).toBe(2);
    expect(p.failed).toBe(1);
    expect(p.score).toBe(50);
    expect(p.failing).toHaveLength(1);
    expect(p.failing[0].resource.key).toBe('Deployment/shop/api');
    expect(p.failing[0].rules).toEqual([
      'autogen-privileged-containers',
      'autogen-cronjob-privileged-containers',
    ]);
    expect(p.failing[0].messages).toEqual(['Privileged mode is disallowed.']);
  });

  it('reads title, severity and mode from the policy', () => {
    const p = byRef.get('disallow-privileged-containers')!;
    expect(p.meta.title).toBe('Disallow Privileged Containers');
    expect(p.meta.severity).toBe('Medium');
    expect(p.action).toBe('Audit');
    expect(p.ready?.state).toBe('ready');
  });

  it('matches a namespaced policy by namespace/name and by bare name', () => {
    const p = byRef.get('shop/require-labels')!;
    expect(p.kind).toBe('Policy');
    expect(p.checks.pass).toBe(1);
    expect(p.checks.skip).toBe(1);
    // The skip is not a verdict, so only the Deployment counts as checked.
    expect(p.evaluated).toBe(1);
    expect(p.action).toBe('Enforce');
  });

  it('keeps results for policies that are not in the cluster', () => {
    const p = byRef.get('vap-replicas')!;
    expect(p.kind).toBeNull();
    expect(p.source).toBe('ValidatingAdmissionPolicy');
    expect(p.checks.warn).toBe(1);
  });

  it('totals checks and resources across every report', () => {
    expect(posture.checks).toEqual({ pass: 2, fail: 2, warn: 1, error: 0, skip: 1 });
    expect(totalChecks(posture.checks)).toBe(6);
    expect(posture.resources).toBe(2);
    expect(posture.failingResources).toBe(1);
  });
});

describe('where the failures sit', () => {
  const seccomp = {
    metadata: {
      name: 'restrict-seccomp',
      labels: { 'helm.sh/chart': 'kyverno-policies-3.8.2' },
      annotations: { 'policies.kyverno.io/severity': 'high' },
    },
    spec: { validationFailureAction: 'Audit', rules: [{ name: 'check-seccomp' }] },
  };
  const proxy = { kind: 'DaemonSet', namespace: 'kube-system', name: 'kube-proxy' };

  const posture = scoreKyverno(
    [
      { kind: 'ClusterPolicy', json: privileged },
      { kind: 'ClusterPolicy', json: seccomp },
    ],
    [
      ...reports,
      report(proxy, [
        { policy: 'disallow-privileged-containers', rule: 'autogen-x', result: 'fail' },
        { policy: 'restrict-seccomp', rule: 'check-seccomp', result: 'pass' },
      ]),
    ],
    [
      {
        metadata: { namespace: 'kyverno', name: 'kube-system-pss' },
        spec: { exceptions: [{ policyName: 'disallow-privileged-containers', ruleNames: ['*'] }] },
      },
    ]
  );
  const byRef = new Map(posture.policies.map(p => [p.ref, p]));

  it('tallies namespaces, failing first and workloads ahead on a tie', () => {
    expect(posture.namespaces).toEqual([
      { namespace: 'shop', system: false, resources: 2, failing: 1 },
      { namespace: 'kube-system', system: true, resources: 1, failing: 1 },
    ]);
  });

  it('lists each failing resource once, workloads before system', () => {
    expect(posture.offenders.map(o => o.resource.key)).toEqual([
      'Deployment/shop/api',
      'DaemonSet/kube-system/kube-proxy',
    ]);
    expect(posture.offenders[0].policies.map(p => p.ref)).toEqual([
      'disallow-privileged-containers',
    ]);
    expect(posture.offenders[0].severity).toBe('Medium');
  });

  it('attaches exceptions to the policies they relax', () => {
    expect(posture.exceptions).toBe(1);
    expect(byRef.get('disallow-privileged-containers')!.exceptions).toEqual([
      'kyverno/kube-system-pss',
    ]);
    expect(byRef.get('restrict-seccomp')!.exceptions).toEqual([]);
  });

  it('calls an audited policy with no failures ready to enforce, and keeps its chart', () => {
    const p = byRef.get('restrict-seccomp')!;
    expect(readyToEnforce(p)).toBe(true);
    expect(p.chart).toBe('kyverno-policies-3.8.2');
    expect(readyToEnforce(byRef.get('disallow-privileged-containers')!)).toBe(false);
  });

  it('reads policy names from both kinds of exception', () => {
    expect(
      exceptedPolicies({ spec: { exceptions: [{ policyName: 'shop/require-labels' }] } })
    ).toEqual(['shop/require-labels']);
    expect(
      exceptedPolicies({
        spec: { policyRefs: [{ name: 'disallow-host-path', kind: 'ValidatingPolicy' }] },
      })
    ).toEqual(['disallow-host-path']);
  });

  it('treats kube-*, *-system and platform tool namespaces as system', () => {
    expect(['kube-system', 'vela-system', 'kyverno', 'kubescape'].map(isSystemNamespace)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(['shop', 'platform', null].map(isSystemNamespace)).toEqual([false, false, false]);
  });
});

describe('ValidatingPolicy', () => {
  it('enforces only when its validation actions include Deny', () => {
    expect(failureAction({ spec: { validationActions: ['Deny'] } })).toBe('Enforce');
    expect(failureAction({ spec: { validationActions: ['Audit', 'Warn'] } })).toBe('Audit');
  });

  it('reads readiness from conditionStatus', () => {
    expect(policyReadiness({ status: { conditionStatus: { ready: true } } }).state).toBe('ready');
    const notReady = policyReadiness({
      status: {
        conditionStatus: {
          ready: false,
          conditions: [
            { type: 'WebhookConfigured', status: 'False', message: 'webhook not configured' },
          ],
        },
      },
    });
    expect(notReady.state).toBe('failed');
    expect(notReady.message).toBe('webhook not configured');
  });
});
