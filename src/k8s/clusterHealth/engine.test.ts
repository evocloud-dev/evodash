import { describe, expect, it } from 'vitest';
import {
  checkSeverity,
  HEALTH_SEVERITY_ORDER,
  matchesCheck,
  scoreSections,
  worstFirstKey,
} from '../../pages/compliance/healthFields';
import { evaluateCheck, KUBERNETES_CHECKS, scoreChecks } from './engine';
import { buildResourceStates, healthConfig, isExcludedByDefault } from './states';

function pod(namespace: string, name: string, securityContext: Record<string, unknown> = {}) {
  return {
    kind: 'Pod',
    apiVersion: 'v1',
    metadata: { name, namespace, uid: `${namespace}-${name}` },
    spec: { containers: [{ name: 'app', image: 'nginx:1.27', securityContext }] },
    status: { phase: 'Running' },
  };
}

function scan(lists: Parameters<typeof buildResourceStates>[0], withSystem = false) {
  const excluded = withSystem ? () => false : isExcludedByDefault;
  const states = buildResourceStates(lists, excluded);
  const config = healthConfig(withSystem ? [] : ['kube-system']);
  return KUBERNETES_CHECKS.map(check => evaluateCheck(check, states, config));
}

describe('cluster health engine', () => {
  it('runs every check in the catalog on an empty cluster without throwing', () => {
    const results = scan({});
    expect(results).toHaveLength(KUBERNETES_CHECKS.length);
    expect(results.length).toBeGreaterThan(140);
    // Nothing to fail on an empty cluster, and every check has a handler.
    expect(results.filter(r => r.status === 'skipped').map(r => r.id)).toEqual([]);
  });

  it('finds a privileged container and leaves out system namespaces', () => {
    const lists = {
      Pods: {
        data: [
          pod('shop', 'web', { privileged: true }),
          pod('kube-system', 'proxy', { privileged: true }),
        ],
        loading: false,
      },
    };
    const sec004 = (results: ReturnType<typeof scan>) => results.find(r => r.id === 'SEC004')!;

    const scoped = sec004(scan(lists));
    expect(scoped.status).toBe('failed');
    expect(scoped.findings.map(f => f.namespace)).toEqual(['shop']);

    const everything = sec004(scan(lists, true));
    expect(everything.findings.map(f => f.namespace).sort()).toEqual(['kube-system', 'shop']);
  });

  it('honours the ignore annotation on a resource', () => {
    const ignored = pod('shop', 'legacy', { privileged: true });
    (ignored.metadata as any).annotations = {
      'kubebuddy.io/ignore-checks': 'SEC004',
      'kubebuddy.io/ignore-reason': 'vendor image',
    };
    const result = scan({ Pods: { data: [ignored], loading: false } }).find(
      r => r.id === 'SEC004'
    )!;
    expect(result.status).toBe('passed');
    expect(result.suppressedFindings?.[0]?.suppressionReason).toBe('vendor image');
  });

  it('scores a clean cluster at 100 and a failing one below it', () => {
    expect(scoreChecks(scan({})).value).toBe(100);
    const failing = scan({
      Pods: { data: [pod('shop', 'web', { privileged: true })], loading: false },
    });
    expect(scoreChecks(failing).value).toBeLessThan(100);
  });
});

describe('cluster health list rules', () => {
  const results = scan({
    Pods: { data: [pod('shop', 'web', { privileged: true })], loading: false },
  });

  it('keeps the catalog severity, Critical included', () => {
    const severities = new Set(results.map(checkSeverity));
    for (const s of severities) expect(HEALTH_SEVERITY_ORDER).toContain(s);
    expect(severities.has('Critical')).toBe(true);
  });

  it('puts failing checks first in worst-first order', () => {
    const sorted = [...results].sort((a, b) => worstFirstKey(a).localeCompare(worstFirstKey(b)));
    const firstPassing = sorted.findIndex(r => r.status !== 'failed');
    expect(firstPassing).toBeGreaterThan(0);
    expect(sorted.slice(firstPassing).every(r => r.status !== 'failed')).toBe(true);
  });

  it('filters by text, status, severity and section', () => {
    const base = { query: '', status: 'all', severity: 'all', section: 'all' } as const;
    const sec004 = results.find(r => r.id === 'SEC004')!;
    expect(matchesCheck(sec004, { ...base, query: 'privileged' })).toBe(true);
    expect(matchesCheck(sec004, { ...base, status: 'passed' })).toBe(false);
    expect(matchesCheck(sec004, { ...base, section: sec004.section })).toBe(true);
    expect(matchesCheck(sec004, { ...base, section: 'Nodes' })).toBe(false);
  });

  it('scores each section on its own, worst first', () => {
    const sections = scoreSections(results);
    expect(sections.map(s => s.section)).toContain('Security');
    for (let i = 1; i < sections.length; i++) {
      expect(sections[i].score.value).toBeGreaterThanOrEqual(sections[i - 1].score.value);
    }
    expect(sections.reduce((n, s) => n + s.checks.length, 0)).toBe(results.length);
  });
});
