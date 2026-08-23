/**
 * Status conditions, read the way the controllers write them.
 *
 * Flux, Kyverno and Cilium all follow the Kubernetes convention of a `Ready`
 * condition on `status.conditions`, so one reader serves all three and the
 * pages present them identically instead of each inventing its own vocabulary.
 */
import { EvoCloudPalette } from '../palette';

export interface KubeCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
  observedGeneration?: number;
}

/**
 * What a reconciled object is currently doing.
 *
 * `unknown` is deliberately distinct from `failed`: a resource the controller
 * has not written a condition onto yet is not broken, and colouring it red
 * would send an operator chasing a problem that does not exist.
 */
export type ReadyState = 'ready' | 'failed' | 'reconciling' | 'suspended' | 'unknown';

export interface Readiness {
  state: ReadyState;
  /** Short word for a table cell. */
  label: string;
  /** The controller's own explanation, for a tooltip. */
  message?: string;
  reason?: string;
  /** When the condition last flipped — the age shown beside it. */
  since?: string;
}

export function conditionsOf(json: any): KubeCondition[] {
  const conditions = json?.status?.conditions;
  return Array.isArray(conditions) ? conditions : [];
}

export function findCondition(json: any, type: string): KubeCondition | undefined {
  return conditionsOf(json).find(c => c.type === type);
}

/**
 * Collapse an object's conditions into one state.
 *
 * A suspended object is reported as suspended whatever its last condition says,
 * because that condition describes the reconcile before the suspension and is
 * frozen — reporting it as Ready would claim a liveness the controller is no
 * longer maintaining.
 */
export function readiness(json: any): Readiness {
  if (json?.spec?.suspend === true) {
    const ready = findCondition(json, 'Ready');
    return {
      state: 'suspended',
      label: 'Suspended',
      message: 'Reconciliation is suspended; the state below is from before it was paused.',
      since: ready?.lastTransitionTime,
    };
  }

  const ready = findCondition(json, 'Ready');
  if (!ready) {
    return { state: 'unknown', label: 'Unknown', message: 'The controller has not reported a Ready condition yet.' };
  }

  const base = { message: ready.message, reason: ready.reason, since: ready.lastTransitionTime };

  if (ready.status === 'Unknown') {
    return { ...base, state: 'reconciling', label: 'Reconciling' };
  }
  if (ready.status === 'True') {
    return { ...base, state: 'ready', label: 'Ready' };
  }
  // Flux marks a resource whose dependency has not become ready as not-Ready,
  // but it is waiting rather than broken.
  if (ready.reason === 'DependencyNotReady') {
    return { ...base, state: 'reconciling', label: 'Waiting' };
  }
  return { ...base, state: 'failed', label: 'Failed' };
}

export interface Tone {
  fg: string;
  bg: string;
  border: string;
}

/** Colour for a state: green ready, red failed, gold in-between, grey unknown. */
export function readyTone(C: EvoCloudPalette, state: ReadyState): Tone {
  switch (state) {
    case 'ready':
      return { fg: C.healthy, bg: C.healthySoft, border: C.healthyBorder };
    case 'failed':
      return { fg: C.danger, bg: `${C.danger}1f`, border: `${C.danger}55` };
    case 'reconciling':
    case 'suspended':
      return { fg: C.gold, bg: C.goldSoft, border: C.goldBorder };
    default:
      return { fg: C.textDimmer, bg: C.chip, border: C.border };
  }
}

/** Totals across a set of readiness results, for the stat row at the top of a page. */
export interface ReadyTally {
  total: number;
  ready: number;
  failed: number;
  reconciling: number;
  suspended: number;
  unknown: number;
}

export function tally(states: ReadyState[]): ReadyTally {
  const counts: ReadyTally = { total: states.length, ready: 0, failed: 0, reconciling: 0, suspended: 0, unknown: 0 };
  for (const s of states) {
    counts[s] += 1;
  }
  return counts;
}
