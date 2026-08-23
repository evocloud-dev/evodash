/**
 * ForecastleApp custom resource — forecastle.stakater.com/v1alpha1.
 *
 * Field set below is the CRD's own `openAPIV3Schema`, read from the cluster
 * rather than assumed. `name`, `group` and `icon` are required by the schema;
 * everything else is optional.
 *
 * Note there is no `status` subresource. The controller does not write health
 * back onto the object, so nothing here can report whether an app is actually
 * up — see {@link resolveLink} for what *can* be determined.
 */
import { makeCustomResourceClass } from '@kinvolk/headlamp-plugin/lib/lib/k8s/crd';

export interface ForecastleAppSpec {
  /** Display name. Required by the CRD. */
  name: string;
  /** Group heading this app is filed under. Required by the CRD. */
  group: string;
  /** Absolute URL of an icon image. Required by the CRD. */
  icon: string;
  /** Absolute URL of the app, when set directly. */
  url?: string;
  /** Forecastle instance this app belongs to. */
  instance?: string;
  networkRestricted?: boolean;
  properties?: Record<string, string>;
  /** Take the URL from another resource instead of `url`. */
  urlFrom?: {
    ingressRef?: { name: string };
    routeRef?: { name: string };
    ingressRouteRef?: { name: string };
    httpRouteRef?: { name: string };
  };
}

export const ForecastleApp = makeCustomResourceClass({
  apiInfo: [{ group: 'forecastle.stakater.com', version: 'v1alpha1' }],
  kind: 'ForecastleApp',
  pluralName: 'forecastleapps',
  singularName: 'forecastleapp',
  isNamespaced: true,
});

/**
 * How an app's URL was arrived at.
 *
 * This replaces the mock design's `healthy | degraded | unreachable`, which had
 * no source — the CRD carries no health and the plugin cannot probe the app
 * from the browser. What is genuinely knowable is whether the app resolves to a
 * URL at all, so that is what the status dot reports.
 */
export type LinkState = 'direct' | 'resolved' | 'pending' | 'missing';

export interface ResolvedLink {
  /** Absolute URL, or null when nothing resolved. */
  url: string | null;
  state: LinkState;
  /** Human-readable explanation, shown when the state is not a plain success. */
  note?: string;
}

/** Minimal shape needed from an Ingress to derive a URL. */
export interface IngressLike {
  metadata: { name: string; namespace?: string };
  spec?: {
    rules?: { host?: string }[];
    tls?: unknown[];
  };
}

const REF_KINDS: [keyof NonNullable<ForecastleAppSpec['urlFrom']>, string][] = [
  ['routeRef', 'Route'],
  ['ingressRouteRef', 'IngressRoute'],
  ['httpRouteRef', 'HTTPRoute'],
];

/**
 * Work out an app's URL the way Forecastle's own controller does.
 *
 * A direct `spec.url` wins. Otherwise `urlFrom.ingressRef` is looked up against
 * the Ingresses passed in and the first rule's host is used, over https when the
 * Ingress declares TLS.
 *
 * The other three reference kinds — OpenShift Route, Traefik IngressRoute and
 * Gateway API HTTPRoute — are reported as pending rather than guessed at. Each
 * is a separate CRD that may not be installed, and inventing a URL for one would
 * put a dead link in front of the user.
 */
export function resolveLink(
  spec: ForecastleAppSpec,
  namespace: string | undefined,
  ingresses: IngressLike[] | null
): ResolvedLink {
  if (spec.url) {
    return { url: spec.url, state: 'direct' };
  }

  const ingressName = spec.urlFrom?.ingressRef?.name;
  if (ingressName) {
    const match = ingresses?.find(
      i => i.metadata.name === ingressName && i.metadata.namespace === namespace
    );
    if (!match) {
      return {
        url: null,
        state: 'pending',
        // Also the case while the Ingress list is still loading, or when the
        // user cannot list Ingresses — all three read the same from here.
        note: `Ingress "${ingressName}" not found in ${namespace ?? 'this namespace'}`,
      };
    }
    const host = match.spec?.rules?.find(r => r.host)?.host;
    if (!host) {
      return { url: null, state: 'pending', note: `Ingress "${ingressName}" declares no host` };
    }
    const scheme = match.spec?.tls?.length ? 'https' : 'http';
    return { url: `${scheme}://${host}`, state: 'resolved' };
  }

  for (const [key, kind] of REF_KINDS) {
    const ref = spec.urlFrom?.[key];
    if (ref?.name) {
      return { url: null, state: 'pending', note: `Resolved by Forecastle from ${kind} "${ref.name}"` };
    }
  }

  return { url: null, state: 'missing', note: 'No url or urlFrom set on the resource' };
}

export const LINK_LABEL: Record<LinkState, string> = {
  direct: 'direct',
  resolved: 'from ingress',
  pending: 'pending',
  missing: 'no url',
};
