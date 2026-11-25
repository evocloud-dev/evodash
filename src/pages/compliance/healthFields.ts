/**
 * How the Cluster Health page's checks list can be filtered, sorted, grouped
 * and exported, and how a check's results are summed per section. No React,
 * so the rules are testable on their own.
 */
import {
  CheckResult,
  Finding,
  KUBERNETES_CHECKS,
  Score,
  scoreChecks,
} from '../../k8s/clusterHealth/engine';
import { ExportField, GroupField, SortField, SortState } from '../../ui/listModel';

/**
 * A check's severity as the catalog writes it.
 *
 * The engine folds Critical into High for scoring; the page keeps the
 * catalog's own word, because "Critical" is worth seeing.
 */
export type HealthSeverity = 'Critical' | 'High' | 'Warning' | 'Medium' | 'Low';

/** Worst first, in KubeBuddy's order: a Warning outranks a Medium there. */
export const HEALTH_SEVERITY_ORDER: HealthSeverity[] = [
  'Critical',
  'High',
  'Warning',
  'Medium',
  'Low',
];

const CATALOG_SEVERITY = new Map(KUBERNETES_CHECKS.map(c => [c.id, c.severity]));

export function checkSeverity(r: Pick<CheckResult, 'id'>): HealthSeverity {
  const raw = CATALOG_SEVERITY.get(r.id) ?? 'Low';
  return (HEALTH_SEVERITY_ORDER as string[]).includes(raw) ? (raw as HealthSeverity) : 'Low';
}

export type CheckStatus = CheckResult['status'];

export const HEALTH_STATUS_LABEL: Record<CheckStatus, string> = {
  failed: 'Failing',
  passed: 'Passing',
  skipped: 'Skipped',
};

/** The resources a check names, counted once each. */
export function affectedResources(r: Pick<CheckResult, 'findings'>): number {
  return new Set(r.findings.map(findingKey)).size;
}

export function findingKey(f: Finding): string {
  return f.uid || `${f.kind ?? ''}/${f.namespace ?? ''}/${f.resource}`;
}

/** "Pod shop/web-1", or the name alone when the check gave no kind. */
export function findingLabel(f: Finding): string {
  return f.kind
    ? `${f.kind} ${f.namespace ? `${f.namespace}/` : ''}${f.resource}`
    : `${f.namespace ? `${f.namespace}/` : ''}${f.resource}`;
}

/** The number in a check ID, so POD010 sorts after POD002. */
function idParts(id: string): [string, number] {
  const m = /^([A-Z]+)(\d+)$/i.exec(id);
  return m ? [m[1].toUpperCase(), Number(m[2])] : [id, 0];
}

/**
 * Worst first as one sortable string: failing before passing before skipped,
 * then by severity, then by how many findings (more first), then by ID.
 */
export function worstFirstKey(r: CheckResult): string {
  const status = r.status === 'failed' ? 0 : r.status === 'passed' ? 1 : 2;
  const sev = HEALTH_SEVERITY_ORDER.indexOf(checkSeverity(r));
  const many = String(99999 - Math.min(r.findings.length, 99999)).padStart(5, '0');
  const [prefix, n] = idParts(r.id);
  return `${status}${sev}${r.status === 'failed' ? many : '00000'}${prefix}${String(n).padStart(4, '0')}`;
}

export interface HealthFilter {
  query: string;
  status: 'all' | CheckStatus;
  severity: 'all' | HealthSeverity;
  section: 'all' | string;
}

export function matchesCheck(r: CheckResult, f: HealthFilter): boolean {
  const q = f.query.trim().toLowerCase();
  if (
    q &&
    ![r.id, r.name, r.section, r.category, r.resourceKind].some(v =>
      String(v ?? '')
        .toLowerCase()
        .includes(q)
    )
  ) {
    return false;
  }
  if (f.status !== 'all' && r.status !== f.status) return false;
  if (f.severity !== 'all' && checkSeverity(r) !== f.severity) return false;
  if (f.section !== 'all' && r.section !== f.section) return false;
  return true;
}

export const HEALTH_SORT_FIELDS: SortField<CheckResult>[] = [
  { key: 'worst', label: 'Worst first', value: worstFirstKey },
  // Natural order, so POD010 comes after POD002.
  { key: 'id', label: 'Check ID', value: r => r.id },
  { key: 'name', label: 'Name', value: r => r.name },
  {
    key: 'severity',
    label: 'Severity',
    value: r => HEALTH_SEVERITY_ORDER.indexOf(checkSeverity(r)),
  },
  { key: 'section', label: 'Section', value: r => r.section },
  { key: 'findings', label: 'Findings', value: r => r.findings.length, firstDir: 'desc' },
];

export const DEFAULT_HEALTH_SORT: SortState = { key: 'worst', dir: 'asc' };

export const HEALTH_GROUP_FIELDS: GroupField<CheckResult>[] = [
  { key: 'section', label: 'Section', value: r => r.section },
  {
    key: 'severity',
    label: 'Severity',
    value: r => checkSeverity(r),
    order: HEALTH_SEVERITY_ORDER,
  },
  {
    key: 'status',
    label: 'Status',
    value: r => HEALTH_STATUS_LABEL[r.status],
    order: [HEALTH_STATUS_LABEL.failed, HEALTH_STATUS_LABEL.passed, HEALTH_STATUS_LABEL.skipped],
  },
];

export const HEALTH_EXPORT_FIELDS: ExportField<CheckResult>[] = [
  { label: 'check', value: r => r.id },
  { label: 'name', value: r => r.name },
  { label: 'section', value: r => r.section },
  { label: 'severity', value: r => checkSeverity(r) },
  { label: 'status', value: r => HEALTH_STATUS_LABEL[r.status] },
  { label: 'findings', value: r => r.findings.length },
  { label: 'resources', value: r => r.findings.map(findingLabel).join('; ') },
  { label: 'ignored', value: r => r.suppressedFindings?.length ?? 0 },
  { label: 'recommendation', value: r => r.recommendation },
  { label: 'docs', value: r => r.docs ?? null },
];

/* --------------------------------------------------------------- sections */

export interface SectionScore {
  section: string;
  checks: CheckResult[];
  score: Score;
  /** Failing checks by severity, worst first, zeros left out. */
  failingBySeverity: { severity: HealthSeverity; count: number }[];
  findings: number;
}

/** Every section's checks scored on their own, worst score first. */
export function scoreSections(checks: CheckResult[]): SectionScore[] {
  const bySection = new Map<string, CheckResult[]>();
  for (const c of checks) {
    bySection.set(c.section, [...(bySection.get(c.section) ?? []), c]);
  }
  return [...bySection]
    .map(([section, list]) => {
      const failing = list.filter(c => c.status === 'failed');
      return {
        section,
        checks: list,
        score: scoreChecks(list),
        failingBySeverity: HEALTH_SEVERITY_ORDER.map(severity => ({
          severity,
          count: failing.filter(c => checkSeverity(c) === severity).length,
        })).filter(s => s.count > 0),
        findings: failing.reduce((n, c) => n + c.findings.length, 0),
      };
    })
    .sort((a, b) => a.score.value - b.score.value || a.section.localeCompare(b.section));
}
