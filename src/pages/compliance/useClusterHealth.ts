/**
 * Runs the Cluster Health checks against what Headlamp already watches.
 *
 * A scan is a snapshot, like Kubescape's results on Security Benchmark: the
 * checks run once every list has loaded, and again only on Rescan or when the
 * namespace scope changes. Re-running on every websocket update would move the
 * score under the reader while they look at it, for no gain.
 *
 * The last scan per cluster is kept for the session, so leaving the page and
 * coming back shows it at once instead of scanning again.
 */
import { K8s } from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import {
  CheckResult,
  evaluateCheck,
  KUBERNETES_CHECKS,
  namespaceOrName,
  ResourceState,
  resultFromCheck,
  Score,
  scoreChecks,
} from '../../k8s/clusterHealth/engine';
import {
  APIServiceResource,
  EventResource,
  MutatingWebhookConfiguration,
  ValidatingAdmissionPolicy,
  ValidatingAdmissionPolicyBinding,
  ValidatingWebhookConfiguration,
} from '../../k8s/clusterHealth/resources';
import {
  buildResourceStates,
  healthConfig,
  HealthList,
  isExcludedByDefault,
  OPTIONAL_LISTS,
} from '../../k8s/clusterHealth/states';
import { isForbidden, isNotFound, ListQuery, queryError } from '../../ui/chrome';

export interface HealthScan {
  checks: CheckResult[];
  score: Score;
  at: number;
  includeSystem: boolean;
  /** Namespaces the scan left out. */
  excluded: string[];
  /** Lists that could not be read, so the checks reading them saw nothing. */
  unreadable: { label: string; reason: string }[];
  /** Resources the scan looked at, after exclusions. */
  resources: number;
  durationMs: number;
}

const lastScans = new Map<string, HealthScan>();

const R = K8s.ResourceClasses as Record<string, { useList: () => unknown }>;

/**
 * Every list hook, called in the same order on every render. The classes are
 * fixed at load, so a class this Headlamp lacks is always skipped and the hook
 * order never changes.
 */
const LIST_HOOKS: [HealthList, () => unknown][] = [
  ['APIServices', () => APIServiceResource.useList()],
  ['ClusterRoleBindings', () => R.ClusterRoleBinding.useList()],
  ['ClusterRoles', () => R.ClusterRole.useList()],
  ['ConfigMaps', () => R.ConfigMap.useList()],
  ['CronJobs', () => R.CronJob.useList()],
  ['DaemonSets', () => R.DaemonSet.useList()],
  ['Deployments', () => R.Deployment.useList()],
  ['Endpoints', () => R.Endpoints.useList()],
  ['EndpointSlices', () => R.EndpointSlice.useList()],
  ['Events', () => EventResource.useList()],
  ['HorizontalPodAutoscalers', () => R.HorizontalPodAutoscaler.useList()],
  ['Ingresses', () => R.Ingress.useList()],
  ['Jobs', () => R.Job.useList()],
  ['LimitRanges', () => R.LimitRange.useList()],
  ['MutatingWebhookConfigurations', () => MutatingWebhookConfiguration.useList()],
  ['Namespaces', () => R.Namespace.useList()],
  ['NetworkPolicies', () => R.NetworkPolicy.useList()],
  ['Nodes', () => R.Node.useList()],
  ['PersistentVolumeClaims', () => R.PersistentVolumeClaim.useList()],
  ['PersistentVolumes', () => R.PersistentVolume.useList()],
  ['PodDisruptionBudgets', () => R.PodDisruptionBudget.useList()],
  ['Pods', () => R.Pod.useList()],
  ['ResourceQuotas', () => R.ResourceQuota.useList()],
  ['RoleBindings', () => R.RoleBinding.useList()],
  ['Roles', () => R.Role.useList()],
  ['Secrets', () => R.Secret.useList()],
  ['ServiceAccounts', () => R.ServiceAccount.useList()],
  ['Services', () => R.Service.useList()],
  ['StatefulSets', () => R.StatefulSet.useList()],
  ['StorageClasses', () => R.StorageClass.useList()],
  ['ValidatingAdmissionPolicies', () => ValidatingAdmissionPolicy.useList()],
  ['ValidatingAdmissionPolicyBindings', () => ValidatingAdmissionPolicyBinding.useList()],
  ['ValidatingWebhookConfigurations', () => ValidatingWebhookConfiguration.useList()],
  ...(R.Gateway ? [['Gateways', () => R.Gateway.useList()] as [HealthList, () => unknown]] : []),
  ...(R.HTTPRoute
    ? [['HTTPRoutes', () => R.HTTPRoute.useList()] as [HealthList, () => unknown]]
    : []),
];

function reasonOf(err: any): string {
  if (isForbidden(err)) return 'not allowed to list it';
  return String(err?.message ?? err ?? 'could not be read');
}

/** One check, run so that a throw inside it skips that check and no other. */
function runCheck(
  check: typeof KUBERNETES_CHECKS[number],
  states: ReturnType<typeof buildResourceStates>,
  config: ReturnType<typeof healthConfig>
): CheckResult {
  try {
    return evaluateCheck(check, states, config);
  } catch (err) {
    return resultFromCheck(check, [], 'skipped', `The check failed to run: ${String(err)}`);
  }
}

export function useClusterHealth(cluster: string) {
  const queries = LIST_HOOKS.map(([label, use]) => [label, use() as ListQuery] as const);

  const [includeSystem, setIncludeSystemState] = React.useState(
    () => lastScans.get(cluster)?.includeSystem ?? false
  );
  const [scan, setScan] = React.useState<HealthScan | null>(() => lastScans.get(cluster) ?? null);
  const [scanning, setScanning] = React.useState(false);
  const [wanted, setWanted] = React.useState(0);

  const pending: string[] = [];
  const lists: Partial<Record<HealthList, ResourceState>> = {};
  const unreadable: HealthScan['unreadable'] = [];
  for (const [label, q] of queries) {
    const err = queryError(q);
    if (err) {
      if (!(OPTIONAL_LISTS.includes(label) && isNotFound(err))) {
        unreadable.push({ label, reason: reasonOf(err) });
      }
      lists[label] = { data: [], loading: false };
    } else if (q.items === null || q.items === undefined) {
      pending.push(label);
    } else {
      lists[label] = { data: q.items, loading: false };
    }
  }
  const loading = pending.length > 0;
  const loaded = queries.length - pending.length;

  // The newest lists, for a scan started from a timer after this render.
  const latest = React.useRef({ lists, unreadable });
  latest.current = { lists, unreadable };

  const run = React.useCallback((withSystem: boolean, key: string) => {
    setScanning(true);
    // After the "Scanning" state has painted; the checks run synchronously.
    window.setTimeout(() => {
      const started = performance.now();
      const { lists: now, unreadable: failed } = latest.current;
      const namespaces = (now.Namespaces?.data ?? []).map((n: any) => n?.metadata?.name ?? '');
      const excluded = withSystem ? [] : namespaces.filter(isExcludedByDefault).sort();
      const isExcluded = withSystem ? () => false : isExcludedByDefault;
      const states = buildResourceStates(now, isExcluded);
      const config = healthConfig(withSystem ? [] : excluded);
      const checks = KUBERNETES_CHECKS.map(check => runCheck(check, states, config));
      const resources = Object.values(now).reduce(
        (n, s) =>
          n +
          (s?.data ?? []).filter((i: any) => {
            const ns = namespaceOrName(i);
            return !ns || !isExcluded(ns);
          }).length,
        0
      );
      const result: HealthScan = {
        checks,
        score: scoreChecks(checks),
        at: Date.now(),
        includeSystem: withSystem,
        excluded,
        unreadable: failed,
        resources,
        durationMs: Math.round(performance.now() - started),
      };
      lastScans.set(key, result);
      setScan(result);
      setScanning(false);
    }, 30);
  }, []);

  // Scan once everything has loaded, when there is no scan of this scope yet,
  // and whenever Rescan asks for one.
  React.useEffect(() => {
    if (loading || scanning) return;
    const stale = !scan || scan.includeSystem !== includeSystem;
    if (stale || wanted > 0) {
      setWanted(0);
      run(includeSystem, cluster);
    }
    // `scanning` too, so a scope change made mid-scan runs once that scan ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, scanning, includeSystem, wanted, cluster]);

  return {
    scan,
    scanning: scanning || (loading && !scan),
    loading,
    progress: { loaded, total: queries.length, pending },
    includeSystem,
    setIncludeSystem: (v: boolean) => setIncludeSystemState(v),
    rescan: () => setWanted(w => w + 1),
  };
}
