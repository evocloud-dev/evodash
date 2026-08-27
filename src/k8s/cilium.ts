/**
 * Cilium custom resources, plus the selector reading that lets Cilium and core
 * Kubernetes network policies share one table.
 *
 * Cilium policies are a superset of `networking.k8s.io` NetworkPolicy: same
 * idea of a pod selector with ingress and egress rules, expressed with
 * different field names and with L7 rules the core type cannot carry. The
 * helpers below normalise both into the handful of facts a network policy table
 * needs, so a cluster running Cilium and a cluster running anything else are
 * presented the same way.
 */
import { makeCustomResourceClass } from '@kinvolk/headlamp-plugin/lib/lib/k8s/crd';

const CILIUM = 'cilium.io';

export const CiliumNetworkPolicy = makeCustomResourceClass({
  apiInfo: [{ group: CILIUM, version: 'v2' }],
  kind: 'CiliumNetworkPolicy',
  pluralName: 'ciliumnetworkpolicies',
  singularName: 'ciliumnetworkpolicy',
  isNamespaced: true,
});

export const CiliumClusterwideNetworkPolicy = makeCustomResourceClass({
  apiInfo: [{ group: CILIUM, version: 'v2' }],
  kind: 'CiliumClusterwideNetworkPolicy',
  pluralName: 'ciliumclusterwidenetworkpolicies',
  singularName: 'ciliumclusterwidenetworkpolicy',
  isNamespaced: false,
});

export const CiliumEndpoint = makeCustomResourceClass({
  apiInfo: [{ group: CILIUM, version: 'v2' }],
  kind: 'CiliumEndpoint',
  pluralName: 'ciliumendpoints',
  singularName: 'ciliumendpoint',
  isNamespaced: true,
});

export const CiliumNode = makeCustomResourceClass({
  apiInfo: [{ group: CILIUM, version: 'v2' }],
  kind: 'CiliumNode',
  pluralName: 'ciliumnodes',
  singularName: 'ciliumnode',
  isNamespaced: false,
});

/** Where a policy row came from, which decides how its fields are read. */
export type PolicyOrigin = 'cilium' | 'kubernetes';

/**
 * The rule blocks in a policy.
 *
 * A Cilium policy carries its rules either directly on `spec` or as a list
 * under `specs`, and the two are mutually exclusive. Flattening them here means
 * every caller counts rules the same way.
 */
function ciliumRuleBlocks(json: any): any[] {
  const specs = json?.specs;
  if (Array.isArray(specs) && specs.length) {
    return specs;
  }
  return json?.spec ? [json.spec] : [];
}

/** Label selector the policy applies to, as `k=v` pairs. */
export function policySelector(json: any, origin: PolicyOrigin): string {
  const matchLabels =
    origin === 'cilium'
      ? ciliumRuleBlocks(json)[0]?.endpointSelector?.matchLabels ?? ciliumRuleBlocks(json)[0]?.nodeSelector?.matchLabels
      : json?.spec?.podSelector?.matchLabels;

  const pairs = Object.entries(matchLabels ?? {}).map(([k, v]) => `${k}=${v}`);
  // An empty selector is not "nothing" — it is every endpoint in scope, which
  // is the single most consequential thing a policy row can say.
  return pairs.length ? pairs.join(',') : 'all endpoints';
}

/** Which directions the policy actually constrains. */
export function policyDirections(json: any, origin: PolicyOrigin): string[] {
  if (origin === 'kubernetes') {
    const declared: string[] = json?.spec?.policyTypes ?? [];
    if (declared.length) {
      return declared.map(d => d.toLowerCase());
    }
    const inferred: string[] = [];
    if (json?.spec?.ingress) {
      inferred.push('ingress');
    }
    if (json?.spec?.egress) {
      inferred.push('egress');
    }
    return inferred;
  }

  const directions = new Set<string>();
  for (const block of ciliumRuleBlocks(json)) {
    for (const key of ['ingress', 'ingressDeny', 'egress', 'egressDeny'] as const) {
      if (Array.isArray(block?.[key]) && block[key].length) {
        directions.add(key.startsWith('ingress') ? 'ingress' : 'egress');
      }
    }
  }
  return [...directions];
}

/** How many rule entries the policy contains, across both directions. */
export function policyRuleCount(json: any, origin: PolicyOrigin): number {
  if (origin === 'kubernetes') {
    return (json?.spec?.ingress?.length ?? 0) + (json?.spec?.egress?.length ?? 0);
  }
  return ciliumRuleBlocks(json).reduce(
    (n: number, block: any) =>
      n +
      (block?.ingress?.length ?? 0) +
      (block?.ingressDeny?.length ?? 0) +
      (block?.egress?.length ?? 0) +
      (block?.egressDeny?.length ?? 0),
    0
  );
}

/**
 * True when any rule reaches above L4.
 *
 * This is the thing a Cilium policy can express and a core NetworkPolicy
 * cannot, so it is worth calling out on the row rather than leaving the two
 * looking equivalent.
 */
export function hasLayer7(json: any): boolean {
  return ciliumRuleBlocks(json).some((block: any) =>
    ['ingress', 'ingressDeny', 'egress', 'egressDeny'].some((key: string) =>
      (block?.[key] ?? []).some((rule: any) =>
        (rule?.toPorts ?? []).some((port: any) => !!port?.rules)
      )
    )
  );
}
