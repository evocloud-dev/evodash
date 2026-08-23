/**
 * Turning CustomResourceDefinitions into what the schema browser renders.
 *
 * Same split as appEndpoints/model.ts: the shape of the data and the rules for
 * filtering it, with no React and no colour in it. The tree walk itself lives in
 * k8s/crdSchema.ts, because it is a fact about OpenAPI rather than about this
 * page.
 *
 * The unit on screen is a *version*, not a CRD. A CRD that serves v1beta1 and v1
 * is two different contracts, and someone reading a schema is reading one of
 * them — collapsing them under a single entry would mean showing fields that the
 * version they are writing against does not have.
 */
import { countFields, CrdSpec, OpenAPIV3Schema, SchemaField } from '../../k8s/crdSchema';
import { EvoCloudPalette } from '../../palette';
import { fuzzyMatch, fuzzyMatchAny } from '../../ui/chrome';

/**
 * A row in an expanded card.
 *
 * `kind` says what the value means rather than what colour it is, so the palette
 * stays out of here — the same split appEndpoints/model.ts uses.
 */
export interface MetaRow {
  k: string;
  v: string;
  kind: 'plain' | 'served' | 'storage';
}

export interface SchemaView {
  /** Stable across re-renders and unique per version. */
  key: string;
  /** `metadata.name` of the CRD — `plural.group`, and the detail route's id. */
  crdName: string;
  group: string;
  version: string;
  kind: string;
  plural: string;
  namespaced: boolean;
  /** Served versions are reachable through the API; unserved ones are not. */
  served: boolean;
  /** The version objects are persisted as. Exactly one per CRD. */
  storage: boolean;
  shortNames: string[];
  categories: string[];
  fieldCount: number;
  created?: string;
  /** Shown when the card is opened; see {@link metaTone}. */
  meta: MetaRow[];
  /** The version's own schema, for the detail page's tree and raw view. */
  schema?: OpenAPIV3Schema;
}

/** Minimal shape of a Headlamp KubeObject, so this file needs no k8s imports. */
interface CrdItem {
  jsonData?: { spec?: CrdSpec };
  metadata: { uid?: string; name: string; creationTimestamp?: string };
}

export function buildSchemaViews(items: CrdItem[] | null): SchemaView[] {
  return (items ?? []).flatMap(item => {
    const spec = item.jsonData?.spec;
    if (!spec?.names) {
      return [];
    }
    const names = spec.names;
    const id = item.metadata.uid || item.metadata.name;

    return (spec.versions ?? []).map(version => {
      const served = version.served ?? false;
      const storage = version.storage ?? false;
      const shortNames = names.shortNames ?? [];
      const categories = names.categories ?? [];
      const fieldCount = countFields(version.schema?.openAPIV3Schema);

      return {
        key: `${id}/${version.name}`,
        crdName: item.metadata.name,
        group: spec.group,
        version: version.name,
        kind: names.kind,
        plural: names.plural,
        namespaced: spec.scope !== 'Cluster',
        served,
        storage,
        shortNames,
        categories,
        fieldCount,
        created: item.metadata.creationTimestamp,
        // What the card face has no room for. `kubectl` first because it is the
        // one people came looking for — the plural is what you actually type,
        // and it is not always the kind lowercased.
        meta: [
          { k: 'kubectl', v: names.plural, kind: 'plain' },
          { k: 'shortNames', v: shortNames.join(', ') || '—', kind: 'plain' },
          { k: 'categories', v: categories.join(', ') || '—', kind: 'plain' },
          { k: 'fields', v: String(fieldCount), kind: 'plain' },
          { k: 'served', v: String(served), kind: 'served' },
          { k: 'storage', v: String(storage), kind: 'storage' },
        ] as MetaRow[],
        schema: version.schema?.openAPIV3Schema,
      };
    });
  });
}

/** Every version of one CRD, newest-looking first — see {@link compareVersions}. */
export function versionsOf(schemas: SchemaView[], crdName: string): SchemaView[] {
  return schemas.filter(s => s.crdName === crdName).sort((a, b) => compareVersions(a, b));
}

/**
 * Kubernetes version precedence: GA above beta above alpha, then by number.
 *
 * `v10` has to sort above `v2`, which a plain string compare gets backwards, and
 * `v1` has to sort above `v1beta1` even though it is the shorter string. This is
 * the order the API server itself prefers versions in, so a CRD's newest stable
 * contract is the one the page opens on.
 */
export function compareVersions(a: { version: string }, b: { version: string }): number {
  const rank = (v: string): [number, number, number] => {
    const m = /^v(\d+)(?:(alpha|beta)(\d+))?$/.exec(v);
    if (!m) {
      return [-1, 0, 0];
    }
    const stage = m[2] === 'alpha' ? 0 : m[2] === 'beta' ? 1 : 2;
    return [stage, Number(m[1]), Number(m[3] ?? 0)];
  };
  const [as, amaj, amin] = rank(a.version);
  const [bs, bmaj, bmin] = rank(b.version);
  return bs - as || bmaj - amaj || bmin - amin || a.version.localeCompare(b.version);
}

/** Distinct API groups actually present, alphabetically. */
export function groupsOf(schemas: SchemaView[]): string[] {
  return Array.from(new Set(schemas.map(s => s.group))).sort((a, b) => a.localeCompare(b));
}

export type ScopeFilter = 'all' | 'namespaced' | 'cluster';

export interface Filters {
  /** Free text, matched loosely — see {@link fuzzyMatchAny}. */
  query: string;
  group: string;
  scope: ScopeFilter;
}

export function matchesFilters(s: SchemaView, f: Filters): boolean {
  return (
    // Each field on its own rather than one joined string, so a query cannot
    // match by straddling two of them — the same reasoning as the catalog's.
    fuzzyMatchAny(f.query, [s.kind, s.group, s.plural, s.version, ...s.shortNames]) &&
    (f.group === 'all' || s.group === f.group) &&
    (f.scope === 'all' || (f.scope === 'namespaced') === s.namespaced)
  );
}

/** Schemas under their API group heading, empty groups dropped. */
export function groupSchemas(
  schemas: SchemaView[],
  f: Filters
): { name: string; schemas: SchemaView[] }[] {
  return groupsOf(schemas)
    .filter(name => f.group === 'all' || name === f.group)
    .map(name => ({
      name,
      schemas: schemas
        .filter(s => s.group === name && matchesFilters(s, f))
        // Kind first, then the version ladder, so the two contracts of one kind
        // sit together with the current one on top.
        .sort((a, b) => a.kind.localeCompare(b.kind) || compareVersions(a, b)),
    }))
    .filter(g => g.schemas.length > 0);
}

/* ------------------------------------------------------------ field search */

/**
 * Whether a field itself matches the query.
 *
 * A leading dot means path-only: `.spec.cluster` finds the field at that path
 * and not everything that mentions it in prose, which is what you want once you
 * know roughly where you are going.
 *
 * Names and paths are matched loosely, descriptions as a plain substring.
 * Subsequence matching over two lines of prose is not a filter — almost any
 * short query is a subsequence of that much text — so allowing it would quietly
 * turn every search into "show everything".
 */
export function fieldMatches(field: SchemaField, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  if (q.startsWith('.')) {
    return fuzzyMatch(q, field.path);
  }
  return (
    fuzzyMatch(q, field.name) ||
    fuzzyMatch(q, field.path) ||
    !!field.description?.toLowerCase().includes(q)
  );
}

/**
 * The tree with only the branches that lead to a match.
 *
 * A field is kept when it matches or when a descendant does, so a hit deep in
 * `.spec` arrives with its parents around it rather than as a bare path. A
 * matching field keeps its whole subtree: having searched out `.spec.storage`,
 * what is inside it is the next thing you want.
 */
export function pruneFields(fields: SchemaField[], query: string): SchemaField[] {
  if (!query.trim()) {
    return fields;
  }
  return fields.flatMap(field => {
    if (fieldMatches(field, query)) {
      return [field];
    }
    const children = pruneFields(field.children, query);
    return children.length > 0 ? [{ ...field, children }] : [];
  });
}

/** How many fields survive a prune, at every depth. */
export function countTree(fields: SchemaField[]): number {
  return fields.reduce((total, f) => total + 1 + countTree(f.children), 0);
}

/* --------------------------------------------------------------- rendering */

/**
 * Colour for a meta row, given what the row means.
 *
 * Only the two rows that change what you can do with the version are toned.
 * `served: false` is the one that can waste someone's afternoon — the schema
 * reads normally and the API server will not accept it — so it is the one
 * marked. A version that is merely not the storage version is unremarkable;
 * every CRD with more than one version has some, and saying so in green is
 * enough without implying the others are wrong.
 */
export function metaTone(C: EvoCloudPalette, row: MetaRow, s: SchemaView): string | undefined {
  if (row.kind === 'served') {
    return s.served ? C.healthy : C.gold;
  }
  if (row.kind === 'storage') {
    return s.storage ? C.healthy : undefined;
  }
  return undefined;
}

/** Sentence under an expanded card's properties. */
export function scopeNote(s: SchemaView): string {
  if (!s.served) {
    return 'Not served by the API server — kept only for objects already stored.';
  }
  return s.namespaced
    ? 'Namespaced: every object belongs to one namespace.'
    : 'Cluster-scoped: manifests carry no namespace.';
}
