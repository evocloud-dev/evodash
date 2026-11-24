/**
 * Filtering, sorting, grouping and export for the Compliance Policies page,
 * without React.
 *
 * Two lists share the page — the Kyverno policies, and the same results turned
 * inside out by failing resource — and both follow the list standard in
 * ui/listView.tsx. What each can be sorted, grouped and exported by is
 * declared here, so it is testable apart from the tables that draw it.
 */
import {
  FailureAction,
  PolicyScore,
  PolicySeverity,
  ResourceFailures,
  SEVERITY_RANK,
} from '../../k8s/kyverno';
import { ExportField, GroupField, SortField, SortState } from '../../ui/listModel';

/** Most severe first, the order severity groups appear in. */
export const SEVERITY_ORDER: PolicySeverity[] = ['Critical', 'High', 'Medium', 'Low', 'Unknown'];

/* --------------------------------------------------------------- policies */

/** Worst first: failing policies by score, then by severity and title. */
export function sortPolicies(policies: PolicyScore[]): PolicyScore[] {
  return [...policies].sort((a, b) => {
    if (a.failed > 0 !== b.failed > 0) return a.failed > 0 ? -1 : 1;
    if (a.failed > 0 && a.score !== b.score) return a.score - b.score;
    const bySeverity = SEVERITY_RANK[b.meta.severity] - SEVERITY_RANK[a.meta.severity];
    return bySeverity || a.meta.title.localeCompare(b.meta.title);
  });
}

export type PolicyStatus = 'failing' | 'passing' | 'unevaluated';

export function policyStatus(p: PolicyScore): PolicyStatus {
  if (p.failed > 0) return 'failing';
  return p.evaluated > 0 ? 'passing' : 'unevaluated';
}

/** What the mode column shows: the failure action, or Reported for a policy not in the cluster. */
export function policyMode(p: PolicyScore): FailureAction | 'Reported' {
  return p.kind ? p.action : 'Reported';
}

export interface PolicyFilter {
  query: string;
  /** A {@link PolicyStatus}, or 'all'. */
  status: string;
  /** A {@link policyMode} value, or 'all'. */
  mode: string;
}

export function matchesPolicy(p: PolicyScore, f: PolicyFilter): boolean {
  const query = f.query.trim().toLowerCase();
  if (query && ![p.meta.title, p.name, p.ref].join(' ').toLowerCase().includes(query)) {
    return false;
  }
  if (f.status !== 'all' && policyStatus(p) !== f.status) return false;
  if (f.mode !== 'all' && policyMode(p) !== f.mode) return false;
  return true;
}

const MODE_ORDER = ['Enforce', 'Mixed', 'Audit', 'Unset', 'Reported'];

/**
 * Sort fields for the policy list. "Worst first" ranks failing policies by
 * score, then the rest by severity; ties keep the incoming order, so feed the
 * list through {@link sortPolicies} first and the titles break them.
 */
export const POLICY_SORT_FIELDS: SortField<PolicyScore>[] = [
  {
    key: 'worst',
    label: 'Worst first',
    value: p => (p.failed > 0 ? p.score : 1000 + (4 - SEVERITY_RANK[p.meta.severity])),
  },
  { key: 'title', label: 'Title', value: p => p.meta.title },
  {
    key: 'severity',
    label: 'Severity',
    value: p => SEVERITY_RANK[p.meta.severity],
    firstDir: 'desc',
  },
  { key: 'mode', label: 'Mode', value: p => MODE_ORDER.indexOf(policyMode(p)) },
  { key: 'score', label: 'Score', value: p => (p.evaluated > 0 ? p.score : null) },
  { key: 'failing', label: 'Failing', value: p => p.failed, firstDir: 'desc' },
  { key: 'rules', label: 'Rules', value: p => (p.kind ? p.rules : null), firstDir: 'desc' },
];

export const POLICY_DEFAULT_SORT: SortState = { key: 'worst', dir: 'asc' };

export const POLICY_GROUP_FIELDS: GroupField<PolicyScore>[] = [
  { key: 'severity', label: 'Severity', value: p => p.meta.severity, order: SEVERITY_ORDER },
  { key: 'mode', label: 'Mode', value: p => policyMode(p), order: MODE_ORDER },
  { key: 'chart', label: 'Chart', value: p => p.chart || 'Not from a chart' },
];

export const POLICY_EXPORT_FIELDS: ExportField<PolicyScore>[] = [
  { label: 'title', value: p => p.meta.title },
  { label: 'name', value: p => p.name },
  { label: 'namespace', value: p => p.namespace },
  { label: 'kind', value: p => p.kind },
  { label: 'severity', value: p => p.meta.severity },
  { label: 'mode', value: p => policyMode(p) },
  { label: 'score', value: p => (p.evaluated > 0 ? Math.round(p.score) : null) },
  { label: 'failed', value: p => p.failed },
  { label: 'evaluated', value: p => p.evaluated },
  { label: 'rules', value: p => p.rules },
  { label: 'chart', value: p => p.chart || null },
  { label: 'exceptions', value: p => p.exceptions.join(' ') || null },
  {
    label: 'failing resources',
    value: p => p.failing.map(f => resourceText(f.resource)).join(' '),
  },
];

/* -------------------------------------------------------------- resources */

function resourceText(r: { kind: string; name: string; namespace: string | null }): string {
  return `${r.kind}/${r.namespace ? `${r.namespace}/` : ''}${r.name}`;
}

export function matchesResource(entry: ResourceFailures, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const { resource } = entry;
  return [
    resource.kind,
    resource.name,
    resource.namespace ?? '',
    ...entry.policies.map(p => p.title),
  ]
    .join(' ')
    .toLowerCase()
    .includes(q);
}

const SIDE_ORDER = ['Workload namespaces', 'System namespaces'];

/**
 * Sort fields for the failing-resource list. "Worst first" is the order the
 * posture already gives — workloads before system, worst severity first — so
 * ties keep that incoming order.
 */
export const RESOURCE_SORT_FIELDS: SortField<ResourceFailures>[] = [
  {
    key: 'worst',
    label: 'Worst first',
    value: e => (e.system ? 10 : 0) + (4 - SEVERITY_RANK[e.severity]),
  },
  { key: 'name', label: 'Resource', value: e => e.resource.name },
  { key: 'kind', label: 'Kind', value: e => e.resource.kind },
  { key: 'namespace', label: 'Namespace', value: e => e.resource.namespace },
  { key: 'severity', label: 'Severity', value: e => SEVERITY_RANK[e.severity], firstDir: 'desc' },
  { key: 'policies', label: 'Policies failed', value: e => e.policies.length, firstDir: 'desc' },
];

export const RESOURCE_DEFAULT_SORT: SortState = { key: 'worst', dir: 'asc' };

export const RESOURCE_GROUP_FIELDS: GroupField<ResourceFailures>[] = [
  { key: 'namespace', label: 'Namespace', value: e => e.resource.namespace ?? 'cluster-scoped' },
  { key: 'kind', label: 'Kind', value: e => e.resource.kind },
  { key: 'severity', label: 'Severity', value: e => e.severity, order: SEVERITY_ORDER },
  {
    key: 'side',
    label: 'Workload or system',
    value: e => (e.system ? 'System namespaces' : 'Workload namespaces'),
    order: SIDE_ORDER,
  },
];

export const RESOURCE_EXPORT_FIELDS: ExportField<ResourceFailures>[] = [
  { label: 'kind', value: e => e.resource.kind },
  { label: 'namespace', value: e => e.resource.namespace },
  { label: 'name', value: e => e.resource.name },
  { label: 'severity', value: e => e.severity },
  { label: 'system', value: e => e.system },
  { label: 'policies failed', value: e => e.policies.map(p => p.title).join('; ') },
];
