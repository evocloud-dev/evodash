/**
 * Kubescape configuration-scan results, and the framework scores built on them.
 *
 * The Kubescape operator checks every resource in the cluster against its rule
 * library and stores one WorkloadConfigurationScanSummary per resource: which
 * controls were checked and whether each passed. Nothing here scans anything —
 * this module reads those summaries and scores them.
 *
 * Two things about reading them are not obvious:
 *
 * - They are served by Kubescape's own aggregated API server, not by CRDs, and
 *   a plain list returns metadata only. `resourceVersion=fullSpec` is the
 *   storage server's switch for including each object's results.
 * - A full list is heavy (hundreds of objects, several seconds), so it is read
 *   in pages and the caller is told how far it has got.
 *
 * The scoring follows the Kubescape Headlamp plugin
 * (github.com/kubescape/headlamp-plugin, Apache-2.0) so the two dashboards show
 * the same numbers for the same cluster.
 */

import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import {
  KUBESCAPE_CONTROLS,
  KUBESCAPE_FRAMEWORKS,
  KubescapeFramework,
} from './kubescapeFrameworks';

export const KUBESCAPE_GROUP = 'spdx.softwarecomposition.kubescape.io';
const VERSION = 'v1beta1';
const PLURAL = 'workloadconfigurationscansummaries';
const PAGE_SIZE = 150;

/* ------------------------------------------------------------- raw objects */

interface RawControlResult {
  controlID: string;
  severity?: { severity?: string; scoreFactor?: number };
  status?: { status?: string; subStatus?: string };
}

export interface RawScanSummary {
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    creationTimestamp?: string;
  };
  spec?: {
    controls?: Record<string, RawControlResult>;
  };
}

/**
 * Reads every scan summary in the cluster, a page at a time.
 *
 * `onProgress` gets the running count after each page. A 404 means the
 * Kubescape storage API is not registered — the operator is not installed —
 * and is left for the caller to recognise with `isNotFound`.
 */
export async function fetchScanSummaries(
  onProgress?: (read: number) => void,
  isCancelled?: () => boolean
): Promise<RawScanSummary[]> {
  const items: RawScanSummary[] = [];
  let continuation = '';

  do {
    const query = new URLSearchParams({ resourceVersion: 'fullSpec', limit: String(PAGE_SIZE) });
    if (continuation) {
      query.set('continue', continuation);
    }
    const page = await request(`/apis/${KUBESCAPE_GROUP}/${VERSION}/${PLURAL}?${query}`);
    if (isCancelled?.()) {
      return items;
    }
    items.push(...((page?.items ?? []) as RawScanSummary[]));
    onProgress?.(items.length);
    continuation = page?.metadata?.continue ?? '';
  } while (continuation);

  return items;
}

/* ----------------------------------------------------------------- results */

/** One control's outcome on one resource. */
export type Outcome = 'passed' | 'failed' | 'excepted' | 'skipped';

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Unknown';

/** A scanned resource and what each control concluded about it. */
export interface ScannedResource {
  key: string;
  kind: string;
  name: string;
  namespace: string | null;
  outcomes: Map<string, Outcome>;
  /** Severity Kubescape recorded for each control it checked here. */
  severities: Map<string, Severity>;
}

/**
 * Reads one control result.
 *
 * "failed" with the `w/exceptions` sub-status is a failure that has a posture
 * exception filed against it, and "skipped" is a control that could not run
 * (usually it needs configuration first). Both are kept distinct so the page
 * can label them, but neither counts as passing — see {@link scoreControl}.
 */
function outcomeOf(result: RawControlResult): Outcome {
  const status = result.status?.status;
  if (status === 'passed') {
    return 'passed';
  }
  if (status === 'failed') {
    return /exception/i.test(result.status?.subStatus ?? '') ? 'excepted' : 'failed';
  }
  return 'skipped';
}

export function toScannedResources(summaries: RawScanSummary[]): ScannedResource[] {
  return summaries.map(s => {
    const labels = s.metadata.labels ?? {};
    const kind = labels['kubescape.io/workload-kind'] ?? 'Unknown';
    const name = labels['kubescape.io/workload-name'] ?? s.metadata.name;
    // Cluster-scoped resources are stored in a namespace too; the label is
    // empty for them, which is the real answer.
    const namespace = labels['kubescape.io/workload-namespace'] || null;
    const outcomes = new Map<string, Outcome>();
    const severities = new Map<string, Severity>();
    for (const result of Object.values(s.spec?.controls ?? {})) {
      outcomes.set(result.controlID, outcomeOf(result));
      severities.set(result.controlID, normaliseSeverity(result.severity?.severity));
    }
    return {
      key: `${s.metadata.namespace}/${s.metadata.name}`,
      kind,
      name,
      namespace,
      outcomes,
      severities,
    };
  });
}

const SEVERITIES: Severity[] = ['Critical', 'High', 'Medium', 'Low', 'Unknown'];

/** The operator writes severities capitalised; anything else is Unknown. */
function normaliseSeverity(value?: string): Severity {
  const match = SEVERITIES.find(s => s.toLowerCase() === (value ?? '').toLowerCase());
  return match ?? 'Unknown';
}

/** Kubescape's severity bands for a control's 1-10 base score. */
export function severityOf(baseScore: number): Severity {
  if (baseScore >= 9) return 'Critical';
  if (baseScore >= 7) return 'High';
  if (baseScore >= 4) return 'Medium';
  if (baseScore >= 1) return 'Low';
  return 'Unknown';
}

/* ----------------------------------------------------------------- scoring */

export interface ControlScore {
  controlID: string;
  name: string;
  category: string | null;
  severity: Severity;
  /** Resources the control passed on. */
  passed: number;
  /** Resources it failed on, excepted failures included. */
  failed: number;
  /** Resources it produced a result for. 0 means not evaluated on this cluster. */
  evaluated: number;
  /** 0-100. A control with nothing to evaluate scores 100, as in Kubescape. */
  score: number;
  /** The resources it failed on, with whether each failure is excepted. */
  failing: { resource: ScannedResource; excepted: boolean }[];
}

/**
 * Scores one control the way the Kubescape Headlamp plugin does, so both pages
 * agree: passed resources over every resource the control has a result for.
 *
 * That counts excepted failures and skipped checks against the score. The
 * Kubescape CLI is more lenient with both, which moves a framework score by a
 * point or two — but two different numbers for the same framework in the same
 * dashboard would be the bigger problem.
 */
export function scoreControl(controlID: string, resources: ScannedResource[]): ControlScore {
  const meta = KUBESCAPE_CONTROLS[controlID];
  let passed = 0;
  let evaluated = 0;
  const failing: ControlScore['failing'] = [];
  for (const r of resources) {
    const outcome = r.outcomes.get(controlID);
    if (!outcome) {
      continue;
    }
    evaluated++;
    if (outcome === 'passed') {
      passed++;
    } else if (outcome === 'failed' || outcome === 'excepted') {
      failing.push({ resource: r, excepted: outcome === 'excepted' });
    }
  }
  return {
    controlID,
    name: meta?.name ?? controlID,
    category: meta?.category ?? null,
    severity: severityOf(meta?.baseScore ?? 0),
    passed,
    failed: failing.length,
    evaluated,
    score: evaluated === 0 ? 100 : (passed / evaluated) * 100,
    failing,
  };
}

export interface FrameworkScore {
  framework: KubescapeFramework;
  /** 0-100: the mean of the framework's control scores, as Kubescape computes it. */
  score: number;
  controls: ControlScore[];
  /** Controls that ran against at least one resource. */
  evaluatedControls: number;
  failingControls: number;
  /** Distinct resources failing at least one of the framework's controls. */
  failingResources: number;
}

export function scoreFramework(
  framework: KubescapeFramework,
  resources: ScannedResource[]
): FrameworkScore {
  const controls = framework.controlIDs.map(id => scoreControl(id, resources));
  const score =
    controls.length === 0 ? 100 : controls.reduce((sum, c) => sum + c.score, 0) / controls.length;
  const failingResources = new Set(controls.flatMap(c => c.failing.map(f => f.resource.key))).size;
  return {
    framework,
    score,
    controls,
    evaluatedControls: controls.filter(c => c.evaluated > 0).length,
    failingControls: controls.filter(c => c.failed > 0).length,
    failingResources,
  };
}

export function scoreAllFrameworks(resources: ScannedResource[]): FrameworkScore[] {
  return KUBESCAPE_FRAMEWORKS.map(f => scoreFramework(f, resources));
}

/* ----------------------------------------------------------------- summary */

export interface ScanTotals {
  resources: number;
  /** Resources failing at least one control, of any framework. */
  failingResources: number;
  /** Failed control checks, by the control's severity. */
  failedChecks: Record<Severity, number>;
}

export function scanTotals(resources: ScannedResource[]): ScanTotals {
  const failedChecks: Record<Severity, number> = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
    Unknown: 0,
  };
  let failingResources = 0;
  for (const r of resources) {
    let failing = false;
    for (const [controlID, outcome] of r.outcomes) {
      // Excepted failures count, as they do in the control scores.
      if (outcome === 'failed' || outcome === 'excepted') {
        failing = true;
        failedChecks[r.severities.get(controlID) ?? 'Unknown']++;
      }
    }
    if (failing) {
      failingResources++;
    }
  }
  return { resources: resources.length, failingResources, failedChecks };
}
