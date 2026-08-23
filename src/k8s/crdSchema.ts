/**
 * The schema a CustomResourceDefinition carries, turned into a field tree.
 *
 * A CRD publishes its contract as an OpenAPI v3 schema per version, under
 * `spec.versions[].schema.openAPIV3Schema`. That object is the authority on what
 * a manifest may contain — the same thing `kubectl explain` reads — and it is
 * already on a resource Headlamp watches, so nothing here needs a second API
 * call and the tree cannot drift from the CRD it describes.
 *
 * Deliberately free of React and of colour, like the page models: this is the
 * shape of a schema, not a rendering of one.
 */

/** The subset of OpenAPI v3 that structural CRD schemas actually use. */
export interface OpenAPIV3Schema {
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, OpenAPIV3Schema>;
  /** Element schema, when `type` is `array`. */
  items?: OpenAPIV3Schema;
  /** Names of the properties that must be set. */
  required?: string[];
  enum?: unknown[];
  default?: unknown;
  /** `true` where any key is allowed; a schema where the values are typed. */
  additionalProperties?: boolean | OpenAPIV3Schema;
  nullable?: boolean;
  'x-kubernetes-preserve-unknown-fields'?: boolean;
  'x-kubernetes-int-or-string'?: boolean;
}

export interface CrdVersion {
  name: string;
  served?: boolean;
  storage?: boolean;
  /** Absent on the handful of CRDs that still publish no schema at all. */
  schema?: { openAPIV3Schema?: OpenAPIV3Schema };
}

export interface CrdNames {
  kind: string;
  plural: string;
  singular?: string;
  shortNames?: string[];
  categories?: string[];
}

export interface CrdSpec {
  group: string;
  /** `Namespaced` or `Cluster`. */
  scope?: string;
  names: CrdNames;
  versions?: CrdVersion[];
}

/** One property in a schema, with its own properties hanging off it. */
export interface SchemaField {
  /** Dotted path from the object root, e.g. `.spec.storage.size`. */
  path: string;
  name: string;
  /** In `kubectl explain` notation: `string`, `[]string`, `map[string]string`. */
  type: string;
  description?: string;
  /** Named in the parent's `required` list. */
  required: boolean;
  /** Non-empty when the schema pins the value to a fixed set. */
  enumValues: string[];
  /** The schema's default, serialised; undefined when it sets none. */
  defaultValue?: string;
  format?: string;
  children: SchemaField[];
}

/**
 * Structural schemas cannot be cyclic, so the walk terminates on its own. This
 * is a backstop against a malformed CRD taking the page down with it, set well
 * past anything real — the deepest field in Gateway API sits around eight.
 */
const MAX_DEPTH = 20;

/**
 * Where a node's children actually live.
 *
 * An array describes its members in `items`, so `[]Container` has to take its
 * children from there or every list in every CRD renders as a leaf. A map with
 * typed values does the same through `additionalProperties`. Both unwrap
 * repeatedly, since `[][]string` and maps of arrays are legal.
 */
function propertyHolder(schema: OpenAPIV3Schema): OpenAPIV3Schema {
  if (schema.type === 'array' && schema.items) {
    return propertyHolder(schema.items);
  }
  // Only when there are no declared properties: a schema may carry both, and
  // then the named ones are what a manifest author is looking for.
  const extra = schema.additionalProperties;
  if (!schema.properties && extra && typeof extra === 'object') {
    return propertyHolder(extra);
  }
  return schema;
}

/**
 * The type as Kubernetes tooling writes it.
 *
 * Untyped schemas are the interesting case: a node with no `type` and
 * `x-kubernetes-preserve-unknown-fields` is the CRD saying "anything goes here",
 * which is worth showing as `any` rather than silently as `object` — it is the
 * difference between a field with a contract and a field without one.
 */
export function typeLabel(schema: OpenAPIV3Schema): string {
  if (schema['x-kubernetes-int-or-string']) {
    return 'int-or-string';
  }
  if (schema.type === 'array') {
    return `[]${schema.items ? typeLabel(schema.items) : 'object'}`;
  }
  const extra = schema.additionalProperties;
  if (!schema.properties && extra && typeof extra === 'object') {
    return `map[string]${typeLabel(extra)}`;
  }
  if (!schema.type) {
    return schema['x-kubernetes-preserve-unknown-fields'] ? 'any' : 'object';
  }
  return schema.type;
}

/** A schema literal as it would be written in YAML. */
function literal(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value) ?? String(value);
}

/**
 * The properties of `schema` as a tree, alphabetically.
 *
 * Alphabetical because that is the order `kubectl explain` uses and the order
 * the fields are read in: nobody scans a schema for the field the CRD author
 * happened to declare third.
 */
export function fieldsOf(
  schema: OpenAPIV3Schema | undefined,
  parentPath = '',
  depth = 0
): SchemaField[] {
  if (!schema || depth > MAX_DEPTH) {
    return [];
  }
  const holder = propertyHolder(schema);
  const properties = holder.properties;
  if (!properties) {
    return [];
  }
  const required = new Set(holder.required ?? []);

  return Object.keys(properties)
    .sort((a, b) => a.localeCompare(b))
    .map(name => {
      const child = properties[name];
      const path = `${parentPath}.${name}`;
      return {
        path,
        name,
        type: typeLabel(child),
        description: child.description?.trim() || undefined,
        required: required.has(name),
        enumValues: (child.enum ?? []).map(literal),
        defaultValue: child.default === undefined ? undefined : literal(child.default),
        format: child.format,
        children: fieldsOf(child, path, depth + 1),
      };
    });
}

/**
 * Fields at every depth, counted without building the tree.
 *
 * The catalog only needs the number. Building every CRD's tree to get it would
 * allocate tens of thousands of objects for a page that shows none of them —
 * Gateway API and Flux alone run to five figures on a normal cluster.
 */
export function countFields(schema: OpenAPIV3Schema | undefined, depth = 0): number {
  if (!schema || depth > MAX_DEPTH) {
    return 0;
  }
  const properties = propertyHolder(schema).properties;
  if (!properties) {
    return 0;
  }
  return Object.values(properties).reduce(
    (total, child) => total + 1 + countFields(child, depth + 1),
    0
  );
}

/** The smallest manifest that would be accepted, as a starting point to copy. */
export function manifestStub(
  group: string,
  version: string,
  kind: string,
  namespaced: boolean
): string {
  const lines = [
    `apiVersion: ${group}/${version}`,
    `kind: ${kind}`,
    'metadata:',
    '  name: example',
  ];
  if (namespaced) {
    lines.push('  namespace: default');
  }
  return lines.join('\n');
}
