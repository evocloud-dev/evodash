/**
 * Turning published-app resources and annotated routes into what the catalog
 * renders.
 *
 * Deliberately free of React and of colour: this is the shape of the data and
 * the rules for filtering it, nothing else. The card and the row decide how any
 * of it looks. That split is what makes the page readable — the presentation
 * files have no cluster logic in them and this file has no styling in it.
 */
import { AnnotatedApp } from '../../k8s/annotatedApps';
import {
  DiscoverySource,
  IngressLike,
  LINK_LABEL,
  LinkState,
  PublishedAppSpec,
  ResolvedLink,
  resolveLink,
  SOURCE_LABEL,
} from '../../k8s/publishedApp';
import { EvoCloudPalette } from '../../palette';
import { fuzzyMatchAny } from '../../ui/chrome';

/**
 * A row in an expanded card.
 *
 * `kind` says what the value means rather than what colour it is, so the
 * palette stays out of here.
 */
export interface MetaRow {
  k: string;
  v: string;
  kind: 'plain' | 'network' | 'link' | 'source';
}

export interface AppView {
  /** Stable across re-renders and unique per resource. */
  key: string;
  name: string;
  group: string;
  ns: string;
  icon?: string;
  instance: string | null;
  restricted: boolean;
  link: ResolvedLink;
  source: DiscoverySource;
  meta: MetaRow[];
}

/** Minimal shape of a Headlamp KubeObject, so this file needs no k8s imports. */
interface AppItem {
  jsonData?: { spec?: PublishedAppSpec };
  metadata: { uid?: string; name: string; namespace?: string };
}

/** The rows every app shows below its own properties. */
function tail(app: {
  instance: string | null;
  restricted: boolean;
  link: ResolvedLink;
  source: DiscoverySource;
}): MetaRow[] {
  return [
    ...(app.instance ? [{ k: 'instance', v: app.instance, kind: 'plain' as const }] : []),
    { k: 'networkRestricted', v: String(app.restricted), kind: 'network' },
    { k: 'link', v: LINK_LABEL[app.link.state], kind: 'link' },
    { k: 'discoveredFrom', v: SOURCE_LABEL[app.source], kind: 'source' },
  ];
}

function viewOfResource(item: AppItem, ingresses: IngressLike[] | null): AppView {
  const spec = item.jsonData?.spec ?? ({} as PublishedAppSpec);
  const ns = item.metadata.namespace;
  const link = resolveLink(spec, ns, ingresses);
  const restricted = spec.networkRestricted ?? false;
  const instance = spec.instance ?? null;

  return {
    key: item.metadata.uid || `${ns}/${item.metadata.name}`,
    // spec.name is required by the CRD, but fall back to the object name
    // rather than render an empty card if a resource predates that.
    name: spec.name || item.metadata.name,
    group: spec.group || 'Ungrouped',
    ns: ns ?? '',
    icon: spec.icon,
    instance,
    restricted,
    link,
    source: 'Resource',
    meta: [
      ...Object.entries(spec.properties ?? {}).map(([k, v]): MetaRow => ({ k, v, kind: 'plain' })),
      ...tail({ instance, restricted, link, source: 'Resource' }),
    ],
  };
}

function viewOfAnnotated(app: AnnotatedApp): AppView {
  return {
    key: app.key,
    name: app.name,
    group: app.group,
    ns: app.ns,
    icon: app.icon,
    instance: app.instance,
    restricted: app.restricted,
    link: app.link,
    source: app.source,
    meta: [
      ...Object.entries(app.properties).map(([k, v]): MetaRow => ({ k, v, kind: 'plain' })),
      ...tail(app),
    ],
  };
}

/**
 * The catalog, from every direction at once.
 *
 * An app can be described by a dedicated resource — the catalog's own kind or
 * the legacy one — or by an annotation on the route that publishes it, and a
 * cluster may well have several of those at the same time while something is
 * being migrated. The first description of a given app wins, and `items` is
 * consumed in priority order, so the caller decides precedence by the order it
 * passes them: native resource, then legacy, then annotations. Without this an
 * app halfway through a migration would appear twice.
 */
export function buildAppViews(
  items: AppItem[] | null,
  ingresses: IngressLike[] | null,
  annotated: AnnotatedApp[] | null
): AppView[] {
  const seen = new Set<string>();
  const out: AppView[] = [];

  const add = (view: AppView) => {
    const id = `${view.ns}/${view.name.toLowerCase()}`;
    if (!seen.has(id)) {
      seen.add(id);
      out.push(view);
    }
  };

  (items ?? []).forEach(item => add(viewOfResource(item, ingresses)));
  (annotated ?? []).forEach(app => add(viewOfAnnotated(app)));

  return out;
}

/** Distinct groups actually present, alphabetically. */
export function groupsOf(apps: AppView[]): string[] {
  return Array.from(new Set(apps.map(a => a.group))).sort((a, b) => a.localeCompare(b));
}

/** Distinct namespaces actually present, alphabetically. */
export function namespacesOf(apps: AppView[]): string[] {
  return Array.from(new Set(apps.map(a => a.ns).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export interface Filters {
  /** Free text, matched loosely — see {@link fuzzyMatchAny}. */
  query: string;
  group: string;
  namespace: string;
}

export function matchesFilters(a: AppView, f: Filters): boolean {
  return (
    // Each field is matched on its own rather than against one joined string,
    // so a query cannot "match" by straddling two of them — "comdefault" should
    // not find an app just because its URL ends in .com and its namespace is
    // default.
    fuzzyMatchAny(f.query, [a.name, a.link.url, a.ns, a.group]) &&
    (f.group === 'all' || a.group === f.group) &&
    (f.namespace === 'all' || a.ns === f.namespace)
  );
}

/** Apps grouped under their group heading, empty groups dropped. */
export function groupApps(apps: AppView[], f: Filters): { name: string; apps: AppView[] }[] {
  return groupsOf(apps)
    .filter(name => f.group === 'all' || name === f.group)
    .map(name => ({ name, apps: apps.filter(a => a.group === name && matchesFilters(a, f)) }))
    .filter(g => g.apps.length > 0);
}

/* --------------------------------------------------------------- rendering */

/** Green when the app resolves to a URL, gold while pending, red when absent. */
export function linkTone(C: EvoCloudPalette, state: LinkState): string {
  if (state === 'pending') {
    return C.gold;
  }
  return state === 'missing' ? C.danger : C.healthy;
}

/** Colour for a meta row, given what the row means. */
export function metaTone(C: EvoCloudPalette, row: MetaRow, app: AppView): string | undefined {
  if (row.kind === 'network') {
    return app.restricted ? C.gold : C.healthy;
  }
  if (row.kind === 'link') {
    return linkTone(C, app.link.state);
  }
  if (row.kind === 'source') {
    return C.textMuted;
  }
  return undefined;
}

/** Sentence under an expanded card's properties. */
export function accessNote(app: AppView): string {
  return (
    app.link.note ??
    (app.restricted
      ? 'Reachable only from inside the cluster network.'
      : 'Exposed publicly through the ingress controller.')
  );
}
