/**
 * Apps discovered from annotations on the routes that already expose them.
 *
 * The dedicated custom resource is only half of how a catalog gets populated.
 * The other half — and on a cluster with no operator installed, the only half —
 * is a route that opts itself in with an annotation. Nobody writes a second
 * object for it: the Ingress or HTTPRoute that already publishes the app also
 * describes it.
 *
 * Both kinds are read here. Ingress is the long-standing one; HTTPRoute is what
 * a Gateway API cluster uses instead, and on those there are no Ingresses at
 * all, so leaving it out would show an empty catalog on a cluster full of
 * published apps.
 *
 * Annotations are read from two namespaces: the catalog's own, which is what
 * everything the user reads tells them to write, and the upstream one it
 * replaced, which is still honoured so that resources already annotated in a
 * running cluster do not drop out of the catalog on upgrade.
 */
import { makeCustomResourceClass } from '@kinvolk/headlamp-plugin/lib/lib/k8s/crd';
import {
  DiscoverySource,
  IngressLike,
  ingressUrl,
  ResolvedLink,
} from './publishedApp';

/** The catalog's own annotation namespace — what to write on new resources. */
const NS = 'evocloud.dev';

/**
 * The namespace the upstream catalog used.
 *
 * Still read, never advertised. Resources already annotated this way exist in
 * running clusters, and silently dropping them out of the catalog on upgrade
 * would be a worse outcome than carrying one legacy string. Nothing shows this
 * to the user and nothing writes it.
 */
const LEGACY_NS = 'forecastle.stakater.com';

/** The suffix half of every annotation, shared by both namespaces. */
const SUFFIX = {
  /** Opt-in. Nothing without this is looked at any further. */
  expose: 'expose',
  /** Display name. Falls back to the resource's own name. */
  appName: 'appName',
  icon: 'icon',
  /** Group heading. Falls back to the namespace. */
  group: 'group',
  instance: 'instance',
  /** Overrides the URL derived from the resource. Must carry a scheme. */
  url: 'url',
  /** Comma-separated `key:value` pairs, not JSON — see {@link parseProperties}. */
  properties: 'properties',
  networkRestricted: 'network-restricted',
} as const;

export type AnnotationName = keyof typeof SUFFIX;

/**
 * The keys to write, fully qualified. This is the set the page and the docs
 * quote, so what a user is told to add is always the current namespace.
 */
export const ANNOTATIONS = Object.fromEntries(
  Object.entries(SUFFIX).map(([name, suffix]) => [name, `${NS}/${suffix}`])
) as Record<AnnotationName, string>;

/**
 * One annotation's value, current namespace first.
 *
 * A resource carrying both wins on the native key, so annotating an app the
 * new way is enough to override whatever it said before — no need to strip the
 * old annotation first to change an app's name or group.
 */
export function readAnnotation(
  annotations: Record<string, string> | undefined,
  name: AnnotationName
): string | undefined {
  const a = annotations ?? {};
  return a[`${NS}/${SUFFIX[name]}`] ?? a[`${LEGACY_NS}/${SUFFIX[name]}`];
}

/**
 * Gateway API HTTPRoute.
 *
 * Declared here rather than taken from Headlamp because Headlamp does not ship
 * a Gateway API class this plugin can import. Requesting it on a cluster
 * without Gateway API installed 404s, which the page treats as "none", so this
 * costs nothing where it does not apply.
 */
export const HTTPRoute = makeCustomResourceClass({
  apiInfo: [{ group: 'gateway.networking.k8s.io', version: 'v1' }],
  kind: 'HTTPRoute',
  pluralName: 'httproutes',
  singularName: 'httproute',
  isNamespaced: true,
});

/** Minimal shape needed from an HTTPRoute to derive a URL. */
export interface HTTPRouteLike {
  metadata: { name: string; namespace?: string; annotations?: Record<string, string> };
  spec?: { hostnames?: string[] };
}

/** An app the annotations described, in the shape the catalog renders. */
export interface AnnotatedApp {
  key: string;
  name: string;
  group: string;
  ns: string;
  icon?: string;
  instance: string | null;
  restricted: boolean;
  properties: Record<string, string>;
  link: ResolvedLink;
  source: DiscoverySource;
}

function isTrue(v: string | undefined): boolean {
  return String(v ?? '').trim().toLowerCase() === 'true';
}

/**
 * `Version:1.0.0,Platform:EvoCloud` → `{ Version: '1.0.0', Platform: 'EvoCloud' }`.
 *
 * Split on the *first* colon only, so a value that is itself a URL survives.
 * A JSON object is accepted too: it is not the documented form, but it is the
 * shape the custom resource's own `properties` field takes, and someone moving
 * an app from the resource to an annotation will reach for it.
 */
export function parseProperties(raw: string | undefined): Record<string, string> {
  const text = (raw ?? '').trim();
  if (!text) {
    return {};
  }

  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v)]));
      }
    } catch (e) {
      // Fall through and read it as the comma-separated form instead.
    }
  }

  const out: Record<string, string> = {};
  for (const pair of text.split(',')) {
    const at = pair.indexOf(':');
    if (at <= 0) {
      continue;
    }
    const k = pair.slice(0, at).trim();
    const v = pair.slice(at + 1).trim();
    if (k) {
      out[k] = v;
    }
  }
  return out;
}

interface Annotated {
  metadata: { uid?: string; name: string; namespace?: string; annotations?: Record<string, string> };
}

/**
 * Shared reading of the annotation set. `derived` is the URL the resource
 * itself implies, which the `url` annotation may override.
 */
function toApp(item: Annotated, source: DiscoverySource, derived: string | null): AnnotatedApp {
  const a = item.metadata.annotations;
  const ns = item.metadata.namespace ?? '';
  const override = readAnnotation(a, 'url')?.trim();

  let link: ResolvedLink;
  if (override) {
    link = { url: override, state: 'direct' };
  } else if (derived) {
    link = { url: derived, state: 'resolved', note: `Resolved from ${source} "${item.metadata.name}"` };
  } else {
    link = { url: null, state: 'missing', note: `${source} "${item.metadata.name}" declares no host` };
  }

  return {
    // Namespaced by source as well as name: an Ingress and an HTTPRoute in one
    // namespace may legitimately share a name.
    key: item.metadata.uid || `${source}/${ns}/${item.metadata.name}`,
    name: readAnnotation(a, 'appName')?.trim() || item.metadata.name,
    // The documented default is the namespace, not a catch-all bucket.
    group: readAnnotation(a, 'group')?.trim() || ns || 'Ungrouped',
    ns,
    icon: readAnnotation(a, 'icon')?.trim() || undefined,
    instance: readAnnotation(a, 'instance')?.trim() || null,
    restricted: isTrue(readAnnotation(a, 'networkRestricted')),
    properties: parseProperties(readAnnotation(a, 'properties')),
    link,
    source,
  };
}

function exposed(item: Annotated): boolean {
  return isTrue(readAnnotation(item.metadata.annotations, 'expose'));
}

/**
 * An HTTPRoute names hosts but not scheme — TLS is declared on the Gateway
 * listener it attaches to, which is a separate object this page does not read.
 * https is the assumption, and the `url` annotation is the way to say otherwise.
 */
function httpRouteUrl(route: HTTPRouteLike): string | null {
  const host = route.spec?.hostnames?.find(Boolean);
  return host ? `https://${host}` : null;
}

export function appsFromAnnotations(
  ingresses: IngressLike[] | null,
  httpRoutes: HTTPRouteLike[] | null
): AnnotatedApp[] {
  return [
    ...(ingresses ?? [])
      .filter(exposed)
      .map(ing => toApp(ing, 'Ingress', ingressUrl(ing))),
    ...(httpRoutes ?? [])
      .filter(exposed)
      .map(route => toApp(route, 'HTTPRoute', httpRouteUrl(route))),
  ];
}
