/**
 * Which namespaces belong to the platform rather than to the workloads on it.
 *
 * There is no Kubernetes field for this, so it is a convention: the `kube-`
 * namespaces, anything named `*-system` (the habit of most operators, and of
 * EvoCloud's own vela-system and o11y-system), and the namespaces the common
 * platform tools install into under their own names.
 *
 * It matters because system components need what policies forbid. kube-proxy
 * runs privileged and the control plane uses host networking by design, so a
 * Pod Security policy fails them on every cluster. Counted together with the
 * workloads, they make a cluster whose applications are clean look as if they
 * are not.
 */

const PLATFORM_NAMESPACES = new Set([
  'cert-manager',
  'cilium',
  'ingress-nginx',
  'kubescape',
  'kyverno',
  'local-path-storage',
  'tigera-operator',
]);

/** The rule, in words, for a tooltip beside the "system" mark. */
export const SYSTEM_NAMESPACE_RULE =
  'Platform namespace: kube-*, *-system, or one a platform tool installs into (such as kyverno or kubescape).';

export function isSystemNamespace(namespace?: string | null): boolean {
  if (!namespace) {
    return false;
  }
  return (
    namespace.startsWith('kube-') ||
    namespace.endsWith('-system') ||
    PLATFORM_NAMESPACES.has(namespace)
  );
}
