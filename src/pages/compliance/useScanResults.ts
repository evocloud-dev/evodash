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
import { fetchScanSummaries, ScannedResource, toScannedResources } from '../../k8s/kubescape';
import { EvoCloudPalette } from '../../palette';
import { isForbidden, isNotFound } from '../../ui/chrome';

export interface Snapshot {
  resources: ScannedResource[];
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
    pending = fetchScanSummaries(onProgress)
      .then(summaries => {
        const next = { resources: toScannedResources(summaries), readAt: Date.now() };
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

/** Score colour: green from 80, gold from 60, red below. */
export function scoreColor(C: EvoCloudPalette, score: number): string {
  if (score >= 80) return C.healthy;
  if (score >= 60) return C.gold;
  return C.danger;
}

/** Route name of the Compliance page, registered in index.tsx. */
export const COMPLIANCE_ROUTE = 'evocloud-compliance';
