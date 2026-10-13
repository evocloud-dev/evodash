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
 * Reads every object of one Kubescape kind in the cluster, a page at a time.
 *
 * `onProgress` gets the running count after each page. A 404 means the
 * Kubescape storage API is not registered — the operator is not installed —
 * and is left for the caller to recognise with `isNotFound`.
 */
async function listAll<T>(
  plural: string,
  onProgress?: (read: number) => void,
  isCancelled?: () => boolean
): Promise<T[]> {
  const items: T[] = [];
  let continuation = '';

  do {
    const query = new URLSearchParams({ resourceVersion: 'fullSpec', limit: String(PAGE_SIZE) });
    if (continuation) {
      query.set('continue', continuation);
    }
    const page = await request(`/apis/${KUBESCAPE_GROUP}/${VERSION}/${plural}?${query}`);
    if (isCancelled?.()) {
      return items;
    }
    items.push(...((page?.items ?? []) as T[]));
    onProgress?.(items.length);
    continuation = page?.metadata?.continue ?? '';
  } while (continuation);

  return items;
}

/** Configuration-scan results: one per resource, per control passed or failed. */
export function fetchScanSummaries(
  onProgress?: (read: number) => void,
  isCancelled?: () => boolean
): Promise<RawScanSummary[]> {
  return listAll<RawScanSummary>('workloadconfigurationscansummaries', onProgress, isCancelled);
}

/* --------------------------------------------------------- vulnerabilities */

interface SeverityCount {
  all?: number;
  /** In packages the workload was seen loading at runtime. */
  relevant?: number;
}

/**
 * One workload container's image-scan result, as counts per severity.
 *
 * These summaries are what make the CVE figures affordable: the full CVE lists
 * behind them run to megabytes for a handful of images, while the summaries are
 * a few kilobytes for the whole cluster.
 */
export interface RawVulnerabilitySummary {
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: {
    severities?: {
      critical?: SeverityCount;
      high?: SeverityCount;
    };
  };
}

export function fetchVulnerabilitySummaries(
  isCancelled?: () => boolean
): Promise<RawVulnerabilitySummary[]> {
  return listAll<RawVulnerabilitySummary>('vulnerabilitymanifestsummaries', undefined, isCancelled);
}

/** One container image and the CVEs Kubescape found in it. */
export interface ImageVulnerabilities {
  /** Image reference without the digest, e.g. docker.io/library/nginx. */
  image: string;
  critical: number;
  high: number;
  /**
   * How many of those sit in packages a workload running this image was seen
   * loading. Null until Kubescape's runtime analysis has finished for it.
   */
  relevantCritical: number | null;
  relevantHigh: number | null;
  /** Workloads running this image, as namespace/name. */
  workloads: string[];
}

/**
 * Folds per-workload results into one entry per image.
 *
 * Kubescape stores a summary per workload container, so an image run by four
 * workloads appears four times with the same CVEs; summing those would count
 * every CVE in it four times. Keyed by image digest, each image counts once.
 *
 * The runtime ("relevant") figure differs per workload, since each loads what
 * it uses. The highest across an image's workloads is kept: at least that many
 * of its CVEs are in code that actually runs somewhere.
 */
export function toImageVulnerabilities(
  summaries: RawVulnerabilitySummary[]
): ImageVulnerabilities[] {
  const byImage = new Map<string, ImageVulnerabilities>();
  for (const s of summaries) {
    const imageID =
      s.metadata.annotations?.['kubescape.io/image-id'] ??
      s.metadata.labels?.['kubescape.io/image-id'] ??
      s.metadata.name;
    const sev = s.spec?.severities ?? {};
    const labels = s.metadata.labels ?? {};
    const workload = `${labels['kubescape.io/workload-namespace'] ?? s.metadata.namespace}/${
      labels['kubescape.io/workload-name'] ?? s.metadata.name
    }`;

    const entry = byImage.get(imageID) ?? {
      image: imageID.split('@')[0],
      critical: 0,
      high: 0,
      relevantCritical: null,
      relevantHigh: null,
      workloads: [],
    };
    entry.critical = Math.max(entry.critical, sev.critical?.all ?? 0);
    entry.high = Math.max(entry.high, sev.high?.all ?? 0);
    entry.relevantCritical = maxKnown(entry.relevantCritical, sev.critical?.relevant);
    entry.relevantHigh = maxKnown(entry.relevantHigh, sev.high?.relevant);
    if (!entry.workloads.includes(workload)) {
      entry.workloads.push(workload);
    }
    byImage.set(imageID, entry);
  }

  // A runtime figure can come back a little above the image's own total; it is
  // a subset by definition, so it is held to that.
  for (const entry of byImage.values()) {
    if (entry.relevantCritical !== null) {
      entry.relevantCritical = Math.min(entry.relevantCritical, entry.critical);
    }
    if (entry.relevantHigh !== null) {
      entry.relevantHigh = Math.min(entry.relevantHigh, entry.high);
    }
  }
  return [...byImage.values()];
}

function maxKnown(current: number | null, next: number | undefined): number | null {
  if (typeof next !== 'number') {
    return current;
  }
  return current === null ? next : Math.max(current, next);
}

export interface CveTotals {
  images: number;
  critical: number;
  high: number;
  /** Of the critical CVEs, those in running code, over images where that is known. */
  relevantCritical: number;
  relevantHigh: number;
  /** Images whose runtime analysis has not finished, so relevance is not known. */
  relevancePending: number;
}

/**
 * Totals across images. A CVE present in two different images counts twice —
 * telling them apart needs the full CVE lists, which are too heavy to read
 * here — so the figures are worded as "across N images".
 */
export function cveTotals(images: ImageVulnerabilities[]): CveTotals {
  const totals: CveTotals = {
    images: images.length,
    critical: 0,
    high: 0,
    relevantCritical: 0,
    relevantHigh: 0,
    relevancePending: 0,
  };
  for (const img of images) {
    totals.critical += img.critical;
    totals.high += img.high;
    if (img.relevantCritical === null && img.relevantHigh === null) {
      totals.relevancePending++;
    }
    totals.relevantCritical += img.relevantCritical ?? 0;
    totals.relevantHigh += img.relevantHigh ?? 0;
  }
  return totals;
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
  /**
   * Every check run — one control against one resource — by outcome. Failed
   * includes excepted failures, as the scores do.
   */
  checks: { total: number; passed: number; failed: number; skipped: number };
}

export function scanTotals(resources: ScannedResource[]): ScanTotals {
  const failedChecks: Record<Severity, number> = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
    Unknown: 0,
  };
  const checks = { total: 0, passed: 0, failed: 0, skipped: 0 };
  let failingResources = 0;
  for (const r of resources) {
    let failing = false;
    for (const [controlID, outcome] of r.outcomes) {
      checks.total++;
      // Excepted failures count, as they do in the control scores.
      if (outcome === 'failed' || outcome === 'excepted') {
        failing = true;
        checks.failed++;
        failedChecks[r.severities.get(controlID) ?? 'Unknown']++;
      } else if (outcome === 'passed') {
        checks.passed++;
      } else {
        checks.skipped++;
      }
    }
    if (failing) {
      failingResources++;
    }
  }
  return { resources: resources.length, failingResources, failedChecks, checks };
}
