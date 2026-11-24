/**
 * How the Frameworks page's controls list can be filtered, sorted, grouped
 * and exported. No React, so the rules are testable on their own.
 */
import { ControlScore, Severity } from '../../k8s/kubescape';
import { ExportField, GroupField, SortField, SortState } from '../../ui/listModel';

export type ControlStatus = 'failing' | 'passing' | 'not-evaluated';

export function controlStatus(c: ControlScore): ControlStatus {
  if (c.failed > 0) return 'failing';
  return c.evaluated === 0 ? 'not-evaluated' : 'passing';
}

export const STATUS_LABEL: Record<ControlStatus, string> = {
  failing: 'Failing',
  passing: 'Passing',
  'not-evaluated': 'Not evaluated',
};

export const SEVERITY_ORDER: Severity[] = ['Critical', 'High', 'Medium', 'Low', 'Unknown'];

/** The number in a control ID, so C-0270 sorts after C-0045. */
export function controlNumber(c: ControlScore): number {
  const n = Number(c.controlID.replace(/\D/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Worst first as one number: failing controls by score (lowest first), then
 * everything else by control ID. Scores are 0-100, so every failing control
 * lands below 101 and every other control above it.
 */
export function worstFirstRank(c: ControlScore): number {
  return c.failed > 0 ? c.score : 101 + controlNumber(c);
}

export interface ControlFilter {
  query: string;
  status: 'all' | ControlStatus;
  severity: 'all' | Severity;
}

export function matchesControl(c: ControlScore, f: ControlFilter): boolean {
  const q = f.query.trim().toLowerCase();
  if (q && !c.controlID.toLowerCase().includes(q) && !c.name.toLowerCase().includes(q)) {
    return false;
  }
  if (f.status !== 'all' && controlStatus(c) !== f.status) return false;
  if (f.severity !== 'all' && c.severity !== f.severity) return false;
  return true;
}

export const CONTROL_SORT_FIELDS: SortField<ControlScore>[] = [
  { key: 'worst', label: 'Worst first', value: worstFirstRank },
  { key: 'id', label: 'Control ID', value: controlNumber },
  { key: 'name', label: 'Name', value: c => c.name },
  { key: 'severity', label: 'Severity', value: c => SEVERITY_ORDER.indexOf(c.severity) },
  { key: 'score', label: 'Score', value: c => (c.evaluated > 0 ? c.score : null) },
  { key: 'failing', label: 'Failing', value: c => c.failed, firstDir: 'desc' },
];

export const DEFAULT_CONTROL_SORT: SortState = { key: 'worst', dir: 'asc' };

export const CONTROL_GROUP_FIELDS: GroupField<ControlScore>[] = [
  { key: 'severity', label: 'Severity', value: c => c.severity, order: SEVERITY_ORDER },
  { key: 'category', label: 'Category', value: c => c.category ?? 'Uncategorised' },
  {
    key: 'status',
    label: 'Status',
    value: c => STATUS_LABEL[controlStatus(c)],
    order: [STATUS_LABEL.failing, STATUS_LABEL.passing, STATUS_LABEL['not-evaluated']],
  },
];

export function resourceLabel(r: { kind: string; namespace: string | null; name: string }) {
  return `${r.kind} ${r.namespace ? `${r.namespace}/` : ''}${r.name}`;
}

export const CONTROL_EXPORT_FIELDS: ExportField<ControlScore>[] = [
  { label: 'control', value: c => c.controlID },
  { label: 'name', value: c => c.name },
  { label: 'severity', value: c => c.severity },
  { label: 'category', value: c => c.category },
  { label: 'score', value: c => (c.evaluated > 0 ? Math.round(c.score) : null) },
  { label: 'failed', value: c => c.failed },
  { label: 'evaluated', value: c => c.evaluated },
  {
    label: 'failing resources',
    value: c => c.failing.map(f => resourceLabel(f.resource)).join('; '),
  },
];
