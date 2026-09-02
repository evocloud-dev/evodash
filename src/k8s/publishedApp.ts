/**
 * The custom resources behind App Endpoints.
 *
 * Two kinds, one spec. `AppEndpoint` is the catalog's own — the one to write,
 * shipped as a CRD in `crds/` — and `LegacyPublishedApp` is the upstream kind
 * it replaced, still read so that a cluster already carrying those objects does
 * not lose them. They are schema-compatible, so a single {@link PublishedAppSpec}
 * covers both and the page treats them as one list.
 *
 * The legacy group and kind are wire identifiers: they are what that cluster
 * answers to, so they stay literal. Nothing displays them and nothing writes
 * them.
 *
 * Note there is no `status` subresource on either. No controller writes health
 * back onto the object, so nothing here can report whether an app is actually
 * up — see {@link resolveLink} for what *can* be determined.
 */
import { makeCustomResourceClass } from '@kinvolk/headlamp-plugin/lib/lib/k8s/crd';

export interface PublishedAppSpec {
  /** Display name. Required. */
  name: string;
  /** Group heading this app is filed under. Required. */
  group: string;
  /** Absolute URL of an icon image. */
  icon?: string;
  /** Absolute URL of the app, when set directly. */
  url?: string;
  /** Catalog instance this app belongs to. */
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

/** The catalog's own resource. `crds/appendpoint-crd.yaml` installs it. */
export const AppEndpoint = makeCustomResourceClass({
  apiInfo: [{ group: 'evocloud.dev', version: 'v1alpha1' }],
  kind: 'AppEndpoint',
  pluralName: 'appendpoints',
  singularName: 'appendpoint',
  isNamespaced: true,
});

/**
 * The upstream kind this replaced. Read, never advertised — see the file
 * comment. Absent on most clusters, which reads as an empty list rather than
 * an error.
 */
export const LegacyPublishedApp = makeCustomResourceClass({
  apiInfo: [{ group: 'forecastle.stakater.com', version: 'v1alpha1' }],
  kind: 'ForecastleApp',
  pluralName: 'forecastleapps',
  singularName: 'forecastleapp',
  isNamespaced: true,
});

/**
 * Where an app in the catalog came from.
 *
 * A dedicated resource is one someone wrote on purpose; the other two are
 * routes that opted in with an annotation. Worth surfacing: the two are edited
 * in completely different places, so "why is this app here" has a different
 * answer for each.
 */
export type DiscoverySource = 'Resource' | 'Ingress' | 'HTTPRoute';

export const SOURCE_LABEL: Record<DiscoverySource, string> = {
  Resource: 'Resource',
  Ingress: 'Ingress',
  HTTPRoute: 'HTTPRoute',
};

/**
 * How an app's URL was arrived at.
 *
 * This replaces the mock design's `healthy | degraded | unreachable`, which had
 * no source — neither the CRD nor an annotation carries health, and the plugin
 * cannot probe the app from the browser. What is genuinely knowable is whether
 * the app resolves to a URL at all, so that is what the status dot reports.
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
  metadata: { name: string; namespace?: string; annotations?: Record<string, string> };
  spec?: {
    rules?: { host?: string }[];
    tls?: unknown[];
  };
}

const REF_KINDS: [keyof NonNullable<PublishedAppSpec['urlFrom']>, string][] = [
  ['routeRef', 'Route'],
  ['ingressRouteRef', 'IngressRoute'],
  ['httpRouteRef', 'HTTPRoute'],
];

/** First rule host on an Ingress, and whether it is served over TLS. */
export function ingressUrl(ing: IngressLike): string | null {
  const host = ing.spec?.rules?.find(r => r.host)?.host;
  if (!host) {
    return null;
  }
  return `${ing.spec?.tls?.length ? 'https' : 'http'}://${host}`;
}

/**
 * Work out an app's URL the way the catalog controller does.
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
  spec: PublishedAppSpec,
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
    const url = ingressUrl(match);
    if (!url) {
      return { url: null, state: 'pending', note: `Ingress "${ingressName}" declares no host` };
    }
    return { url, state: 'resolved', note: `Resolved from Ingress "${ingressName}"` };
  }

  for (const [key, kind] of REF_KINDS) {
    const ref = spec.urlFrom?.[key];
    if (ref?.name) {
      return { url: null, state: 'pending', note: `Resolved by the controller from ${kind} "${ref.name}"` };
    }
  }

  return { url: null, state: 'missing', note: 'No url or urlFrom set on the resource' };
}

export const LINK_LABEL: Record<LinkState, string> = {
  direct: 'direct',
  resolved: 'resolved',
  pending: 'pending',
  missing: 'no url',
};
