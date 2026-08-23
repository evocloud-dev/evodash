/**
 * Turning ForecastleApp resources into what the catalog renders.
 *
 * Deliberately free of React and of colour: this is the shape of the data and
 * the rules for filtering it, nothing else. The card and the row decide how any
 * of it looks. That split is what makes the page readable — the presentation
 * files have no cluster logic in them and this file has no styling in it.
 */
import {
  ForecastleAppSpec,
  IngressLike,
  LINK_LABEL,
  LinkState,
  ResolvedLink,
  resolveLink,
} from '../../k8s/forecastleApp';
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
  kind: 'plain' | 'network' | 'link';
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
  meta: MetaRow[];
}

/** Minimal shape of a Headlamp KubeObject, so this file needs no k8s imports. */
interface AppItem {
  jsonData?: { spec?: ForecastleAppSpec };
  metadata: { uid?: string; name: string; namespace?: string };
}

export function buildAppViews(items: AppItem[] | null, ingresses: IngressLike[] | null): AppView[] {
  return (items ?? []).map(item => {
    const spec = item.jsonData?.spec ?? ({} as ForecastleAppSpec);
    const ns = item.metadata.namespace;
    const link = resolveLink(spec, ns, ingresses);
    const restricted = spec.networkRestricted ?? false;

    return {
      key: item.metadata.uid || `${ns}/${item.metadata.name}`,
      // spec.name is required by the CRD, but fall back to the object name
      // rather than render an empty card if a resource predates that.
      name: spec.name || item.metadata.name,
      group: spec.group || 'Ungrouped',
      ns: ns ?? '',
      icon: spec.icon,
      instance: spec.instance ?? null,
      restricted,
      link,
      meta: [
        ...Object.entries(spec.properties ?? {}).map(([k, v]): MetaRow => ({ k, v, kind: 'plain' })),
        ...(spec.instance ? [{ k: 'instance', v: spec.instance, kind: 'plain' as const }] : []),
        { k: 'networkRestricted', v: String(restricted), kind: 'network' },
        { k: 'link', v: LINK_LABEL[link.state], kind: 'link' },
      ],
    };
  });
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
