/**
 * Kubescape scan results for a page, read once and shared.
 *
 * Both the Compliance page and the Overview need them, and reading them is the
 * slow part — several seconds for a few hundred resources — while they only
 * change when the operator rescans. So the last read is kept per cluster for
 * the session: whichever page asks first pays for it, and the other shows it
 * straight away. Refresh reads them again.
 */

import React from 'react';
import {
  cveTotals,
  fetchScanSummaries,
  fetchVulnerabilitySummaries,
  ImageVulnerabilities,
  ScannedResource,
  toImageVulnerabilities,
  toScannedResources,
} from '../../k8s/kubescape';
import { EvoCloudPalette } from '../../palette';
import { isForbidden, isNotFound, Stat } from '../../ui/chrome';

export interface Snapshot {
  resources: ScannedResource[];
  /**
   * Image vulnerability results, or null when they could not be read. Kept
   * apart from the configuration results so a failure here costs the CVE
   * figures only, not the compliance scores.
   */
  images: ImageVulnerabilities[] | null;
  readAt: number;
}

export type Phase = 'loading' | 'ready' | 'not-installed' | 'forbidden' | 'error';

const snapshots = new Map<string, Snapshot>();

/**
 * One read in flight per cluster, so the Overview and the Compliance page
 * opened together do not each page through every result.
 */
const inFlight = new Map<string, Promise<Snapshot>>();

function readSnapshot(cluster: string, onProgress: (n: number) => void): Promise<Snapshot> {
  let pending = inFlight.get(cluster);
  if (!pending) {
    pending = Promise.all([
      fetchScanSummaries(onProgress),
      fetchVulnerabilitySummaries().catch(() => null),
    ])
      .then(([summaries, vulnerabilities]) => {
        const next = {
          resources: toScannedResources(summaries),
          images: vulnerabilities ? toImageVulnerabilities(vulnerabilities) : null,
          readAt: Date.now(),
        };
        snapshots.set(cluster, next);
        return next;
      })
      .finally(() => inFlight.delete(cluster));
    inFlight.set(cluster, pending);
  }
  return pending;
}

export function useScanResults(cluster: string) {
  const cached = snapshots.get(cluster);
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(cached ?? null);
  const [phase, setPhase] = React.useState<Phase>(cached ? 'ready' : 'loading');
  const [read, setRead] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [fetching, setFetching] = React.useState(!cached);
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    if (nonce === 0 && snapshots.has(cluster)) {
      return;
    }
    let cancelled = false;
    // A refresh keeps the last results on screen while the new ones are read.
    setPhase(snapshots.has(cluster) ? 'ready' : 'loading');
    setFetching(true);
    setRead(0);
    readSnapshot(cluster, n => !cancelled && setRead(n))
      .then(next => {
        if (cancelled) return;
        setSnapshot(next);
        setPhase('ready');
        setFetching(false);
      })
      .catch(err => {
        if (cancelled) return;
        setFetching(false);
        if (isNotFound(err)) {
          setPhase('not-installed');
        } else if (isForbidden(err)) {
          setPhase('forbidden');
        } else {
          setError(err?.message ?? String(err));
          setPhase('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cluster, nonce]);

  return { snapshot, phase, read, error, fetching, refresh: () => setNonce(n => n + 1) };
}

/**
 * The Critical CVEs and High CVEs tiles, shared by the Compliance page and the
 * Overview so both say the same thing the same way.
 *
 * The sub-line carries the runtime figure when Kubescape has one — how many of
 * the CVEs sit in code a workload actually loads — because that is the part of
 * a large CVE count someone can act on first.
 */
export function cveStats(
  C: EvoCloudPalette,
  images: ImageVulnerabilities[] | null,
  route?: string
): Stat[] {
  const tile = (label: string, severity: 'critical' | 'high', tone: string): Stat => {
    if (images === null) {
      return { label, value: '—', sub: 'image scans unavailable', route };
    }
    if (images.length === 0) {
      return { label, value: '—', sub: 'no images scanned yet', route };
    }
    const totals = cveTotals(images);
    const all = severity === 'critical' ? totals.critical : totals.high;
    const relevant = severity === 'critical' ? totals.relevantCritical : totals.relevantHigh;
    const known = totals.relevancePending < totals.images;
    const across = `across ${totals.images} image${totals.images === 1 ? '' : 's'}`;
    return {
      label,
      value: all,
      sub: known ? `${relevant} in running code · ${across}` : across,
      tone: all > 0 ? tone : C.healthy,
      route,
      ...(known && all > 0
        ? { ratio: { value: relevant, total: all, of: 'in code that runs' } }
        : {}),
    };
  };
  return [tile('Critical CVEs', 'critical', C.danger), tile('High CVEs', 'high', C.gold)];
}

/** Score colour: green from 80, gold from 60, red below. */
export function scoreColor(C: EvoCloudPalette, score: number): string {
  if (score >= 80) return C.healthy;
  if (score >= 60) return C.gold;
  return C.danger;
}

/** Route name of the Compliance page, registered in index.tsx. */
export const COMPLIANCE_ROUTE = 'evocloud-compliance';
