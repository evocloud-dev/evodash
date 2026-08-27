/**
 * Kyverno policies and the policy reports they produce.
 *
 * Two API groups are involved and they are not both Kyverno's:
 *
 * - `kyverno.io` holds the policies an operator authors — ClusterPolicy for the
 *   whole cluster, Policy for one namespace;
 * - `wgpolicyk8s.io` holds the reports. That group is the Kubernetes Policy WG's
 *   shared report format, so the report tables here are not Kyverno-specific
 *   and populate for any engine that writes it.
 */
import { makeCustomResourceClass } from '@kinvolk/headlamp-plugin/lib/lib/k8s/crd';

export const ClusterPolicy = makeCustomResourceClass({
  apiInfo: [{ group: 'kyverno.io', version: 'v1' }],
  kind: 'ClusterPolicy',
  pluralName: 'clusterpolicies',
  singularName: 'clusterpolicy',
  isNamespaced: false,
});

export const Policy = makeCustomResourceClass({
  apiInfo: [{ group: 'kyverno.io', version: 'v1' }],
  kind: 'Policy',
  pluralName: 'policies',
  singularName: 'policy',
  isNamespaced: true,
});

export const PolicyReport = makeCustomResourceClass({
  apiInfo: [{ group: 'wgpolicyk8s.io', version: 'v1alpha2' }],
  kind: 'PolicyReport',
  pluralName: 'policyreports',
  singularName: 'policyreport',
  isNamespaced: true,
});

export const ClusterPolicyReport = makeCustomResourceClass({
  apiInfo: [{ group: 'wgpolicyk8s.io', version: 'v1alpha2' }],
  kind: 'ClusterPolicyReport',
  pluralName: 'clusterpolicyreports',
  singularName: 'clusterpolicyreport',
  isNamespaced: false,
});

/** What a policy does when a resource violates it. */
export type FailureAction = 'Enforce' | 'Audit' | 'Mixed' | 'Unset';

/**
 * Read the failure action, from wherever this Kyverno version records it.
 *
 * Kyverno moved this from a single `spec.validationFailureAction` to a
 * per-rule `validate.failureAction`, so a policy can now enforce some rules and
 * only audit others. `Mixed` is reported in that case rather than picking one,
 * because claiming a policy is enforcing when half its rules are not would be
 * the more dangerous error of the two.
 */
export function failureAction(json: any): FailureAction {
  const top = json?.spec?.validationFailureAction;
  if (top === 'Enforce' || top === 'enforce') {
    return 'Enforce';
  }
  if (top === 'Audit' || top === 'audit') {
    return 'Audit';
  }

  const rules: any[] = json?.spec?.rules ?? [];
  const actions = new Set(
    rules
      .map(r => r?.validate?.failureAction)
      .filter(Boolean)
      .map((a: string) => (a.toLowerCase() === 'enforce' ? 'Enforce' : 'Audit'))
  );
  if (actions.size === 1) {
    return actions.has('Enforce') ? 'Enforce' : 'Audit';
  }
  if (actions.size > 1) {
    return 'Mixed';
  }
  return 'Unset';
}

/** The rule types a policy uses — validate, mutate, generate, verifyImages. */
export function ruleKinds(json: any): string[] {
  const rules: any[] = json?.spec?.rules ?? [];
  const kinds = new Set<string>();
  for (const rule of rules) {
    for (const kind of ['validate', 'mutate', 'generate', 'verifyImages'] as const) {
      if (rule?.[kind]) {
        kinds.add(kind);
      }
    }
  }
  return [...kinds];
}

/** The Kubernetes kinds a policy's rules match on, deduplicated. */
export function matchedKinds(json: any): string[] {
  const rules: any[] = json?.spec?.rules ?? [];
  const kinds = new Set<string>();
  for (const rule of rules) {
    const resources = [rule?.match?.any, rule?.match?.all].flat().filter(Boolean);
    const direct = rule?.match?.resources ? [{ resources: rule.match.resources }] : [];
    for (const entry of [...resources, ...direct]) {
      for (const kind of entry?.resources?.kinds ?? []) {
        kinds.add(kind);
      }
    }
  }
  return [...kinds];
}

export interface ReportSummary {
  pass: number;
  fail: number;
  warn: number;
  error: number;
  skip: number;
}

export const EMPTY_SUMMARY: ReportSummary = { pass: 0, fail: 0, warn: 0, error: 0, skip: 0 };

export function reportSummary(json: any): ReportSummary {
  const s = json?.summary ?? json?.status?.summary ?? {};
  return {
    pass: s.pass ?? 0,
    fail: s.fail ?? 0,
    warn: s.warn ?? 0,
    error: s.error ?? 0,
    skip: s.skip ?? 0,
  };
}

export function addSummaries(a: ReportSummary, b: ReportSummary): ReportSummary {
  return {
    pass: a.pass + b.pass,
    fail: a.fail + b.fail,
    warn: a.warn + b.warn,
    error: a.error + b.error,
    skip: a.skip + b.skip,
  };
}

/** What the report is about — a workload, or the whole cluster. */
export function reportScope(json: any): string {
  const scope = json?.scope;
  if (scope?.kind && scope?.name) {
    return `${scope.kind}/${scope.name}`;
  }
  const selector = json?.scopeSelector?.matchLabels;
  if (selector) {
    return Object.entries(selector)
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
  }
  return 'cluster';
}
