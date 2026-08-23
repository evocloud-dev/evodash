/**
 * One custom resource contract, field by field.
 *
 * The page answers the question you actually have in front of an unfamiliar
 * CRD — what may I put in this manifest — so it opens on a copyable stub and a
 * searchable field tree rather than on the CRD object itself. Headlamp's own CRD
 * page shows the resource; this shows the schema inside it.
 *
 * Reached from the schema index at /evocloud/crd-schemas, keyed by the CRD's
 * name and one of its versions, because a version is the unit of contract — see
 * crdSchemas/model.ts.
 */
import { K8s, Router } from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import { Link as RouterLink, useHistory, useParams } from 'react-router-dom';
import { fieldsOf, manifestStub } from '../k8s/crdSchema';
import {
  age,
  Chip,
  Code,
  CopyButton,
  EvoPage,
  FilterSelect,
  GhostButton,
  isForbidden,
  KeyValues,
  MONO,
  Mono,
  Notice,
  NUMERIC,
  Panel,
  SearchBox,
  usePalette,
} from '../ui/chrome';
import { buildSchemaViews, countTree, pruneFields, versionsOf } from './crdSchemas/model';
import { CRD_SCHEMAS_ROUTE, schemaURL } from './crdSchemas/routes';
import { SchemaTree } from './crdSchemas/SchemaTree';

// Via the namespace, not `lib/lib/router` — see the note in ui/chrome.tsx.
const { createRouteURL } = Router;

const PRE: React.CSSProperties = {
  margin: 0,
  padding: '13px 14px',
  overflowX: 'auto',
  fontFamily: MONO,
  fontSize: '12px',
  lineHeight: 1.6,
  whiteSpace: 'pre',
};

export default function CrdSchemaDetail() {
  const C = usePalette();
  const history = useHistory();
  const { name = '', version = '' } = useParams<{ name: string; version: string }>();

  const [q, setQ] = React.useState('');
  const [openPaths, setOpenPaths] = React.useState<Record<string, boolean>>({});
  /** What a path with no entry in `openPaths` does — flipped by expand all. */
  const [expandedByDefault, setExpandedByDefault] = React.useState(false);
  const [showRaw, setShowRaw] = React.useState(false);
  const rawRef = React.useRef<HTMLDivElement | null>(null);

  // A single object rather than the whole list: the index may not have been
  // visited, and this page is routinely arrived at by a shared link.
  //
  // Read through `data` and `error`, not by index. The hook's result is typed as
  // a tuple but returned as a plain object with a `Symbol.iterator` bolted on,
  // so `[0]` type-checks and is undefined at runtime — it can be destructured or
  // read by name, and nothing else.
  const crdQuery = K8s.ResourceClasses.CustomResourceDefinition.useGet(name);
  const crd = crdQuery.data;
  const error = crdQuery.error;

  const versions = React.useMemo(() => {
    const built = buildSchemaViews(crd ? [crd as any] : null);
    return versionsOf(built, name);
  }, [crd, name]);

  const schema = versions.find(v => v.version === version);

  const fields = React.useMemo(() => fieldsOf(schema?.schema), [schema?.schema]);
  const shown = React.useMemo(() => pruneFields(fields, q), [fields, q]);

  const searching = q.trim().length > 0;

  // A search opens what it finds, so a hit eight levels down is on screen
  // rather than behind eight chevrons. Leaving search puts the tree back the way
  // it was left, which is why the overrides are dropped on the way in and out.
  React.useEffect(() => setOpenPaths({}), [searching]);

  /**
   * Bring the raw schema into view when it is asked for.
   *
   * The button is in the header and the panel opens below the field tree, which
   * on anything the size of HTTPRoute is several screens down — so without this
   * the control appears to do nothing at all. Runs after the panel has mounted,
   * because `showRaw` is what renders it.
   */
  React.useEffect(() => {
    if (!showRaw || !rawRef.current) {
      return;
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    rawRef.current.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }, [showRaw]);

  const isOpen = (path: string) => openPaths[path] ?? (searching || expandedByDefault);
  const toggle = (path: string) =>
    setOpenPaths(s => ({ ...s, [path]: !(s[path] ?? (searching || expandedByDefault)) }));
  const setAll = (open: boolean) => {
    setExpandedByDefault(open);
    setOpenPaths({});
  };

  let body: React.ReactNode;
  if (!crd && !error) {
    body = <Notice C={C} title="Loading schema" />;
  } else if (isForbidden(error)) {
    body = (
      <Notice C={C} title="Not allowed to read this definition">
        Reading a schema needs get access on <Code>{name}</Code>.
      </Notice>
    );
  } else if (error || !crd) {
    body = (
      <Notice C={C} title="No such definition on this cluster">
        Nothing is installed under <Code>{name}</Code>.
      </Notice>
    );
  } else if (!schema) {
    body = (
      <Notice C={C} title={`Version “${version}” is not one of this definition's versions`}>
        {versions.length > 0
          ? `It serves ${versions.map(v => v.version).join(', ')}.`
          : 'It declares no versions at all.'}
      </Notice>
    );
  } else {
    body = (
      <>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '12px',
            marginBottom: '22px',
          }}
        >
          <Panel C={C} caption="Definition">
            <div style={{ padding: '13px 14px' }}>
              <KeyValues
                C={C}
                rows={[
                  { k: 'group', v: schema.group, color: C.textValue },
                  {
                    k: 'versions',
                    v: versions.map(v => `${v.version}${v.storage ? ' (storage)' : ''}`).join(', '),
                    color: C.textValue,
                  },
                  {
                    k: 'scope',
                    v: schema.namespaced ? 'Namespaced' : 'Cluster',
                    color: C.textValue,
                  },
                  { k: 'kubectl', v: schema.plural, color: C.textValue },
                  {
                    k: 'shortNames',
                    v: schema.shortNames.join(', ') || '—',
                    color: C.textValue,
                  },
                  { k: 'categories', v: schema.categories.join(', ') || '—', color: C.textValue },
                  { k: 'installed', v: age(schema.created), color: C.textValue },
                  {
                    k: 'resource',
                    v: (
                      <RouterLink
                        to={createRouteURL(
                          K8s.ResourceClasses.CustomResourceDefinition.detailsRoute,
                          { name: schema.crdName }
                        )}
                      >
                        {schema.crdName}
                      </RouterLink>
                    ),
                  },
                ]}
              />
            </div>
          </Panel>

          {/*
            A stub rather than a full example. Everything below the first four
            lines is what the field tree is for, and a generated example would
            have to invent values the schema does not supply.
          */}
          <Panel
            C={C}
            caption="Manifest"
            right={
              <CopyButton
                C={C}
                value={manifestStub(schema.group, schema.version, schema.kind, schema.namespaced)}
                label={`the ${schema.kind} stub`}
              />
            }
          >
            <pre style={{ ...PRE, color: C.textValue }}>
              {manifestStub(schema.group, schema.version, schema.kind, schema.namespaced)}
            </pre>
          </Panel>
        </div>

        <Panel
          C={C}
          caption="Fields"
          right={
            <span
              style={{
                ...NUMERIC,
                fontWeight: 500,
                letterSpacing: 0,
                textTransform: 'none',
                fontFamily: MONO,
              }}
            >
              {searching
                ? `${countTree(shown)} of ${schema.fieldCount} match`
                : `${schema.fieldCount} fields · type .path to search by path`}
            </span>
          }
        >
          {fields.length === 0 ? (
            <div style={{ padding: '20px 14px', fontSize: '12.5px', color: C.textMuted }}>
              This version publishes no structural schema, so the API server accepts any content
              under <Code>spec</Code>.
            </div>
          ) : shown.length === 0 ? (
            <div style={{ padding: '20px 14px', fontSize: '12.5px', color: C.textMuted }}>
              No field matches “{q}”.
            </div>
          ) : (
            <SchemaTree C={C} fields={shown} isOpen={isOpen} onToggle={toggle} />
          )}
        </Panel>

        {showRaw && (
          <div ref={rawRef} style={{ marginTop: '12px', scrollMarginTop: '12px' }}>
            <Panel
              C={C}
              caption="Raw schema"
              right={
                <CopyButton
                  C={C}
                  value={JSON.stringify(schema.schema ?? {}, null, 2)}
                  label={`the ${schema.kind} schema`}
                />
              }
            >
              <pre style={{ ...PRE, maxHeight: '520px', overflowY: 'auto', color: C.textValue }}>
                {JSON.stringify(schema.schema ?? {}, null, 2)}
              </pre>
            </Panel>
          </div>
        )}
      </>
    );
  }

  return (
    <EvoPage
      section="CRD Schemas"
      sectionRoute={CRD_SCHEMAS_ROUTE}
      title={schema?.kind ?? name}
      summary={
        schema ? (
          <>
            <Mono C={C}>
              {schema.group}/{schema.version}
            </Mono>
            {'  ·  '}
            {schema.namespaced ? 'Namespaced' : 'Cluster-scoped'}
            {'  ·  '}
            {schema.fieldCount} fields
            {schema.storage && '  ·  storage version'}
            {!schema.served && '  ·  not served'}
          </>
        ) : (
          name
        )
      }
      actions={
        schema && (
          <>
            <SearchBox C={C} value={q} onChange={setQ} placeholder="Filter fields" />
            {versions.length > 1 && (
              <FilterSelect
                C={C}
                value={schema.version}
                onChange={v => history.push(schemaURL(schema.crdName, v))}
                label="Schema version"
                options={versions.map(v => ({
                  value: v.version,
                  label: v.storage ? `${v.version} (storage)` : v.version,
                }))}
              />
            )}
            <GhostButton C={C} onClick={() => setAll(true)} title="Open every field">
              Expand all
            </GhostButton>
            <GhostButton C={C} onClick={() => setAll(false)} title="Close every field">
              Collapse all
            </GhostButton>
            <GhostButton
              C={C}
              onClick={() => setShowRaw(v => !v)}
              active={showRaw}
              title="The OpenAPI v3 schema as the CRD publishes it"
            >
              Raw schema
            </GhostButton>
          </>
        )
      }
    >
      {body}
      {/* Only reachable when a query hid everything; the tree above is the page. */}
      {schema && searching && shown.length === 0 && (
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Chip C={C}>tip</Chip>
          <span style={{ fontSize: '12px', color: C.textMuted }}>
            A leading dot searches paths only — <Code>.spec.</Code> lists everything under spec.
          </span>
        </div>
      )}
    </EvoPage>
  );
}
