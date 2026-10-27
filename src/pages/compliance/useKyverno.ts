/**
 * Kyverno's policies and the reports they produce, scored for a page.
 *
 * Unlike Kubescape's results these are ordinary resources, so they are read
 * with Headlamp's watched lists rather than a one-off fetch: no cache, no
 * refresh button, and the scores move as soon as Kyverno writes a report.
 *
 * Reports are read from `wgpolicyk8s.io` whether Kyverno keeps them in etcd or
 * in its reports-server, as EvoCloud installs it: the reports-server registers
 * itself as the API for that group, so the same list answers either way.
 */

import React from 'react';
import {
  CelPolicyException,
  ClusterPolicy,
  ClusterPolicyReport,
  KyvernoPosture,
  Policy,
  PolicyException,
  PolicyReport,
  PolicySource,
  scoreKyverno,
  ValidatingPolicy,
} from '../../k8s/kyverno';
import {
  allNotFound,
  firstRealError,
  isForbidden,
  ListQuery,
  queryError,
  useRevision,
} from '../../ui/chrome';

/** Route name of the Compliance Policies page, registered in index.tsx. */
export const COMPLIANCE_POLICIES_ROUTE = 'evocloud-compliance-policies';

export type KyvernoPhase = 'loading' | 'ready' | 'not-installed' | 'forbidden' | 'error';

export interface KyvernoState {
  phase: KyvernoPhase;
  posture: KyvernoPosture;
  /** Policies are readable but reports are not: the reports API is missing. */
  reportsMissing: boolean;
  error: string | null;
  /** For the live badge. */
  fetching: boolean;
  revision: string;
}

function jsonOf(query: ListQuery): any[] {
  return (query.items ?? []).map((item: any) => item?.jsonData ?? item);
}

export function useKyverno(): KyvernoState {
  const clusterPolicies = ClusterPolicy.useList() as unknown as ListQuery;
  const policies = Policy.useList() as unknown as ListQuery;
  const validating = ValidatingPolicy.useList() as unknown as ListQuery;
  const clusterReports = ClusterPolicyReport.useList() as unknown as ListQuery;
  const reports = PolicyReport.useList() as unknown as ListQuery;
  const exceptions = PolicyException.useList() as unknown as ListQuery;
  const celExceptions = CelPolicyException.useList() as unknown as ListQuery;

  const policyQueries = [clusterPolicies, policies, validating];
  const reportQueries = [clusterReports, reports];
  const exceptionQueries = [exceptions, celExceptions];
  const watched = [...policyQueries, ...reportQueries, ...exceptionQueries];

  const posture = React.useMemo(() => {
    const sources: PolicySource[] = [
      ...jsonOf(clusterPolicies).map(json => ({ kind: 'ClusterPolicy' as const, json })),
      ...jsonOf(policies).map(json => ({ kind: 'Policy' as const, json })),
      ...jsonOf(validating).map(json => ({ kind: 'ValidatingPolicy' as const, json })),
    ];
    return scoreKyverno(
      sources,
      [...jsonOf(clusterReports), ...jsonOf(reports)],
      [...jsonOf(exceptions), ...jsonOf(celExceptions)]
    );
  }, [
    clusterPolicies.items,
    policies.items,
    validating.items,
    clusterReports.items,
    reports.items,
    exceptions.items,
    celExceptions.items,
  ]);

  const revision = useRevision(watched);
  const fetching = watched.some(q => q.isFetching);
  // Exceptions are left out: an account that may not list them can still read
  // every policy and result, and the page should not refuse it for that.
  const failure = firstRealError([...policyQueries, ...reportQueries]);

  let phase: KyvernoPhase;
  // ValidatingPolicy lists several versions, and while Headlamp probes for the
  // one the cluster serves its list is neither loading nor failed — only empty
  // of items. Counting that as settled would flash "no policies yet".
  if (policyQueries.some(q => q.isLoading || (q.items === null && !queryError(q)))) {
    phase = 'loading';
  } else if (allNotFound(policyQueries)) {
    // No Kyverno policy type answers. ValidatingPolicy alone 404s on releases
    // before it existed, which is not the same thing.
    phase = 'not-installed';
  } else if (isForbidden(failure)) {
    phase = 'forbidden';
  } else if (failure) {
    phase = 'error';
  } else {
    phase = 'ready';
  }

  return {
    phase,
    posture,
    reportsMissing: allNotFound(reportQueries),
    error: failure ? failure.message || String(failure) : null,
    fetching,
    revision,
  };
}
