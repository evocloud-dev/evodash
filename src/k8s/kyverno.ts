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
 *
 * A third, `policies.kyverno.io`, holds the CEL-based policy types Kyverno is
 * moving to. Only ValidatingPolicy is read: it is what the kyverno-policies
 * chart writes in place of a ClusterPolicy when its `policyType` says so.
 */
import { makeCustomResourceClass } from '@kinvolk/headlamp-plugin/lib/lib/k8s/crd';
import { Readiness, readiness } from './conditions';
import { isSystemNamespace } from './namespaces';

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

/**
 * The CEL policy type. Its group has been served as v1alpha1, v1beta1 and v1
 * across Kyverno releases; Headlamp probes each listed version and lists from
 * whichever the cluster answers on.
 */
export const ValidatingPolicy = makeCustomResourceClass({
  apiInfo: [
    { group: 'policies.kyverno.io', version: 'v1' },
    { group: 'policies.kyverno.io', version: 'v1beta1' },
    { group: 'policies.kyverno.io', version: 'v1alpha1' },
  ],
  kind: 'ValidatingPolicy',
  pluralName: 'validatingpolicies',
  singularName: 'validatingpolicy',
  isNamespaced: false,
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

/**
 * Exceptions — the record of a policy deliberately not applied to something.
 *
 * Two kinds, one per policy family: kyverno.io's names the ClusterPolicy or
 * Policy it relaxes, policies.kyverno.io's the CEL policies. Both are listed
 * so an exception is counted whichever kind of policy it is for.
 */
export const PolicyException = makeCustomResourceClass({
  apiInfo: [
    { group: 'kyverno.io', version: 'v2' },
    { group: 'kyverno.io', version: 'v2beta1' },
  ],
  kind: 'PolicyException',
  pluralName: 'policyexceptions',
  singularName: 'policyexception',
  isNamespaced: true,
});

export const CelPolicyException = makeCustomResourceClass({
  apiInfo: [
    { group: 'policies.kyverno.io', version: 'v1' },
    { group: 'policies.kyverno.io', version: 'v1beta1' },
    { group: 'policies.kyverno.io', version: 'v1alpha1' },
  ],
  kind: 'PolicyException',
  pluralName: 'policyexceptions',
  singularName: 'policyexception',
  isNamespaced: true,
});

/**
 * The policies an exception relaxes, named the way reports name them:
 * namespace/name for a namespaced Policy, the bare name otherwise.
 */
export function exceptedPolicies(json: any): string[] {
  const classic = (json?.spec?.exceptions ?? []).map((e: any) => e?.policyName);
  const cel = (json?.spec?.policyRefs ?? []).map((r: any) => r?.name);
  return [...new Set<string>([...classic, ...cel].filter(Boolean))];
}

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
  // A ValidatingPolicy has no failure action; it lists what a violation does
  // instead, and only Deny stops the request.
  const validationActions = json?.spec?.validationActions;
  if (Array.isArray(validationActions)) {
    if (validationActions.includes('Deny')) {
      return 'Enforce';
    }
    return validationActions.length ? 'Audit' : 'Unset';
  }

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

/* ---------------------------------------------------------------- posture */

/** The policy kinds read from the cluster. */
export type PolicyKind = 'ClusterPolicy' | 'Policy' | 'ValidatingPolicy';

/** The same scale Kubescape grades on, so both read alike on the Compliance page. */
export type PolicySeverity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Unknown';

function toSeverity(value?: string): PolicySeverity {
  switch ((value ?? '').toLowerCase()) {
    case 'critical':
      return 'Critical';
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'low':
    case 'info':
      return 'Low';
    default:
      return 'Unknown';
  }
}

/** What the policy says about itself, from the annotations the policy library sets. */
export interface PolicyMeta {
  title: string;
  category: string;
  severity: PolicySeverity;
  description: string;
}

export function policyMeta(json: any): PolicyMeta {
  const a = json?.metadata?.annotations ?? {};
  return {
    title: a['policies.kyverno.io/title'] || json?.metadata?.name || '',
    category: a['policies.kyverno.io/category'] ?? '',
    severity: toSeverity(a['policies.kyverno.io/severity']),
    description: (a['policies.kyverno.io/description'] ?? '').trim(),
  };
}

/**
 * Whether Kyverno has accepted a policy and is applying it.
 *
 * ClusterPolicy reports a `Ready` condition like any other controller-managed
 * object. The CEL types keep their status one level down, in
 * `status.conditionStatus`, with a single `ready` flag over conditions such as
 * WebhookConfigured — the first of those not met is the useful explanation.
 */
export function policyReadiness(json: any): Readiness {
  const cel = json?.status?.conditionStatus;
  if (cel && typeof cel.ready === 'boolean') {
    if (cel.ready) {
      return { state: 'ready', label: 'Ready' };
    }
    const unmet = (cel.conditions ?? []).find((c: any) => c?.status !== 'True');
    return {
      state: 'failed',
      label: 'Not ready',
      message: unmet?.message || cel.message,
      reason: unmet?.reason,
    };
  }

  const ready = readiness(json);
  // Older Kyverno wrote only the boolean.
  if (ready.state === 'unknown' && typeof json?.status?.ready === 'boolean') {
    return json.status.ready
      ? { state: 'ready', label: 'Ready' }
      : {
          state: 'failed',
          label: 'Not ready',
          message: 'Kyverno reports the policy as not ready.',
        };
  }
  return ready;
}

export type Outcome = 'pass' | 'fail' | 'warn' | 'error' | 'skip';

const OUTCOMES: Outcome[] = ['pass', 'fail', 'warn', 'error', 'skip'];

/** Worst first: a resource with any failing rule has failed the policy. */
const OUTCOME_RANK: Record<Outcome, number> = { fail: 4, error: 3, warn: 2, pass: 1, skip: 0 };

export interface ReportedResource {
  key: string;
  kind: string;
  name: string;
  namespace: string | null;
}

/** One policy rule tested against one resource. */
export interface PolicyResult {
  policy: string;
  rule: string;
  result: Outcome;
  message: string;
  source: string;
  resource: ReportedResource | null;
}

function toResource(ref: any): ReportedResource | null {
  if (!ref?.kind || !ref?.name) {
    return null;
  }
  const namespace = ref.namespace || null;
  return {
    key: `${ref.kind}/${namespace ?? ''}/${ref.name}`,
    kind: ref.kind,
    name: ref.name,
    namespace,
  };
}

/**
 * The results in a report, each tied to the resource it is about.
 *
 * Kyverno writes one report per resource and names that resource in `scope`.
 * Reports from older versions, and from other engines, are aggregated instead
 * and name the resource on each result, so that is read when there is no
 * scope.
 */
export function resultsOf(report: any): PolicyResult[] {
  const scoped = toResource(report?.scope);
  const results: any[] = Array.isArray(report?.results) ? report.results : [];
  return results
    .filter(r => r?.policy && OUTCOMES.includes(r?.result))
    .map(r => ({
      policy: r.policy,
      rule: r.rule ?? '',
      result: r.result as Outcome,
      message: (r.message ?? '').trim(),
      source: r.source ?? '',
      resource: scoped ?? toResource(r.resources?.[0]),
    }));
}

export interface PolicySource {
  kind: PolicyKind;
  json: any;
}

export interface FailingResource {
  resource: ReportedResource;
  rules: string[];
  messages: string[];
}

export interface PolicyScore {
  key: string;
  /** How reports refer to it: the name, or namespace/name for a namespaced Policy. */
  ref: string;
  /** Null for a policy that appears in reports but not in the cluster. */
  kind: PolicyKind | null;
  /** The engine that wrote the results, for a policy known only from reports. */
  source: string;
  name: string;
  namespace: string | null;
  meta: PolicyMeta;
  action: FailureAction;
  ready: Readiness | null;
  rules: number;
  checks: ReportSummary;
  /** Resources it reached a verdict on — every outcome but skip. */
  evaluated: number;
  failed: number;
  /** Share of evaluated resources that passed, 0–100. */
  score: number;
  failing: FailingResource[];
  /** The Helm chart that installed it, from `helm.sh/chart`, e.g. kyverno-policies-3.8.2. */
  chart: string;
  /** Exceptions that relax it, as namespace/name. */
  exceptions: string[];
}

/** One namespace's share of the results. Cluster-scoped resources have a null namespace. */
export interface NamespaceTally {
  namespace: string | null;
  system: boolean;
  resources: number;
  failing: number;
}

/** A resource and every policy it fails — the policy view turned inside out. */
export interface ResourceFailures {
  resource: ReportedResource;
  system: boolean;
  /** The worst severity among the policies it fails. */
  severity: PolicySeverity;
  policies: { ref: string; title: string; severity: PolicySeverity; failure: FailingResource }[];
}

export interface KyvernoPosture {
  policies: PolicyScore[];
  checks: ReportSummary;
  /** Resources with at least one result. */
  resources: number;
  failingResources: number;
  namespaces: NamespaceTally[];
  /** Resources failing at least one policy, workloads before system, worst first. */
  offenders: ResourceFailures[];
  exceptions: number;
}

export const SEVERITY_RANK: Record<PolicySeverity, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
  Unknown: 0,
};

/**
 * Whether a policy could be switched from Audit to Enforce without blocking
 * anything that is running today: it audits, it has checked something, and
 * nothing it checked fails it.
 */
export function readyToEnforce(p: PolicyScore): boolean {
  return p.kind !== null && p.action === 'Audit' && p.evaluated > 0 && p.failed === 0;
}

function emptyScore(ref: string, partial: Partial<PolicyScore>): PolicyScore {
  return {
    key: ref,
    ref,
    kind: null,
    source: '',
    name: ref,
    namespace: null,
    meta: { title: ref, category: '', severity: 'Unknown', description: '' },
    action: 'Unset',
    ready: null,
    rules: 0,
    checks: { ...EMPTY_SUMMARY },
    evaluated: 0,
    failed: 0,
    score: 100,
    failing: [],
    chart: '',
    exceptions: [],
    ...partial,
  };
}

/**
 * Score every policy from the reports, the way the Compliance page scores a
 * Kubescape control: by resource, not by rule.
 *
 * A policy usually has several rules — Kyverno adds a copy of each Pod rule
 * for Deployments, CronJobs and the rest — so one bad Deployment can fail it
 * several times. Counting resources keeps "3 failing" meaning three things to
 * fix. The raw rule results are still totalled, as checks.
 */
export function scoreKyverno(
  sources: PolicySource[],
  reports: any[],
  exceptions: any[] = []
): KyvernoPosture {
  const byRef = new Map<string, PolicyScore>();

  for (const { kind, json } of sources) {
    const name = json?.metadata?.name ?? '';
    const namespace = kind === 'Policy' ? json?.metadata?.namespace ?? null : null;
    const ref = namespace ? `${namespace}/${name}` : name;
    byRef.set(
      ref,
      emptyScore(ref, {
        key: `${kind}/${ref}`,
        kind,
        name,
        namespace,
        meta: policyMeta(json),
        action: failureAction(json),
        ready: policyReadiness(json),
        rules: (json?.spec?.rules ?? json?.spec?.validations ?? []).length,
        chart: json?.metadata?.labels?.['helm.sh/chart'] ?? '',
      })
    );
  }

  for (const exception of exceptions) {
    const meta = exception?.metadata ?? {};
    const label = `${meta.namespace}/${meta.name}`;
    for (const ref of exceptedPolicies(exception)) {
      byRef.get(ref)?.exceptions.push(label);
    }
  }

  // Per policy, the worst outcome seen on each resource, and what failed.
  const verdicts = new Map<string, Map<string, Outcome>>();
  const failures = new Map<string, Map<string, FailingResource>>();
  const resourceOutcomes = new Map<string, Outcome>();
  const resourcesByKey = new Map<string, ReportedResource>();
  const checks: ReportSummary = { ...EMPTY_SUMMARY };

  const worse = (a: Outcome, b?: Outcome) => !b || OUTCOME_RANK[a] > OUTCOME_RANK[b];

  for (const report of reports) {
    const reportNs = report?.metadata?.namespace;
    for (const result of resultsOf(report)) {
      checks[result.result] += 1;

      // A namespaced Policy is reported as namespace/name; fall back to that
      // when the bare name matches nothing cluster-wide.
      let score = byRef.get(result.policy);
      if (!score && reportNs && !result.policy.includes('/')) {
        score = byRef.get(`${reportNs}/${result.policy}`);
      }
      if (!score) {
        score = emptyScore(result.policy, { source: result.source });
        byRef.set(result.policy, score);
      }
      score.checks[result.result] += 1;

      const resource = result.resource;
      if (!resource) {
        continue;
      }

      resourcesByKey.set(resource.key, resource);
      if (worse(result.result, resourceOutcomes.get(resource.key))) {
        resourceOutcomes.set(resource.key, result.result);
      }

      const seen = verdicts.get(score.ref) ?? new Map<string, Outcome>();
      if (worse(result.result, seen.get(resource.key))) {
        seen.set(resource.key, result.result);
      }
      verdicts.set(score.ref, seen);

      if (result.result === 'fail') {
        const failing = failures.get(score.ref) ?? new Map<string, FailingResource>();
        const entry = failing.get(resource.key) ?? { resource, rules: [], messages: [] };
        if (result.rule && !entry.rules.includes(result.rule)) {
          entry.rules.push(result.rule);
        }
        if (result.message && !entry.messages.includes(result.message)) {
          entry.messages.push(result.message);
        }
        failing.set(resource.key, entry);
        failures.set(score.ref, failing);
      }
    }
  }

  for (const score of byRef.values()) {
    const outcomes = [...(verdicts.get(score.ref)?.values() ?? [])];
    const evaluated = outcomes.filter(o => o !== 'skip').length;
    const passed = outcomes.filter(o => o === 'pass').length;
    score.evaluated = evaluated;
    score.failed = outcomes.filter(o => o === 'fail').length;
    score.score = evaluated ? (passed / evaluated) * 100 : 100;
    score.failing = [...(failures.get(score.ref)?.values() ?? [])].sort((a, b) =>
      a.resource.key.localeCompare(b.resource.key)
    );
  }

  // Namespaces, from every resource with a result.
  const tallies = new Map<string, NamespaceTally>();
  for (const [key, outcome] of resourceOutcomes) {
    const namespace = resourcesByKey.get(key)?.namespace ?? null;
    const tally = tallies.get(namespace ?? '') ?? {
      namespace,
      system: isSystemNamespace(namespace),
      resources: 0,
      failing: 0,
    };
    tally.resources += 1;
    if (outcome === 'fail') {
      tally.failing += 1;
    }
    tallies.set(namespace ?? '', tally);
  }

  // Each failing resource with the policies it fails, inverted from the policies.
  const offenders = new Map<string, ResourceFailures>();
  for (const score of byRef.values()) {
    for (const failure of score.failing) {
      const { resource } = failure;
      const entry = offenders.get(resource.key) ?? {
        resource,
        system: isSystemNamespace(resource.namespace),
        severity: 'Unknown' as PolicySeverity,
        policies: [],
      };
      entry.policies.push({
        ref: score.ref,
        title: score.meta.title,
        severity: score.meta.severity,
        failure,
      });
      if (SEVERITY_RANK[score.meta.severity] > SEVERITY_RANK[entry.severity]) {
        entry.severity = score.meta.severity;
      }
      offenders.set(resource.key, entry);
    }
  }

  return {
    policies: [...byRef.values()],
    checks,
    resources: resourceOutcomes.size,
    failingResources: [...resourceOutcomes.values()].filter(o => o === 'fail').length,
    namespaces: [...tallies.values()].sort(
      (a, b) =>
        b.failing - a.failing ||
        Number(a.system) - Number(b.system) ||
        (a.namespace ?? '').localeCompare(b.namespace ?? '')
    ),
    // Workloads first: on most clusters the system offenders are by design,
    // and the resources someone here can change are the ones to see first.
    offenders: [...offenders.values()].sort(
      (a, b) =>
        Number(a.system) - Number(b.system) ||
        SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
        b.policies.length - a.policies.length ||
        a.resource.key.localeCompare(b.resource.key)
    ),
    exceptions: exceptions.length,
  };
}

/** Every result counted, pass or not. */
export function totalChecks(s: ReportSummary): number {
  return s.pass + s.fail + s.warn + s.error + s.skip;
}
