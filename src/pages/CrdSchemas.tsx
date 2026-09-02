/**
 * CRD Schemas — every custom resource contract the cluster will accept.
 *
 * The same furniture as App Endpoints, over a different collection: API groups
 * take the place of catalog groups, and a schema version takes the place of an
 * application. Reading it that way is the point — someone who has used one page
 * already knows how to use this one.
 *
 * Read live from the CustomResourceDefinitions themselves rather than from
 * generated files, so a CRD upgraded this morning is described correctly this
 * afternoon and a cluster with a CRD nobody documented still shows up here.
 *
 * This file is composition only. Shaping and filtering is in crdSchemas/model.ts
 * and k8s/crdSchema.ts; drawing is in crdSchemas/SchemaCard.tsx and
 * crdSchemas/SchemaTable.tsx.
 */
import { K8s } from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import {
  EvoPage,
  FilterSelect,
  FolderIcon,
  isForbidden,
  Notice,
  queryError,
  SearchBox,
  SectionHeading,
  SidePanel,
  usePalette,
  useSidePanelViable,
  ViewToggle,
} from '../ui/chrome';
import CrdSchemaDetail from './CrdSchemaDetail';
import { buildSchemaViews, groupSchemas, groupsOf, ScopeFilter } from './crdSchemas/model';
import { schemaURL } from './crdSchemas/routes';
import { SchemaCard } from './crdSchemas/SchemaCard';
import { SchemaTable } from './crdSchemas/SchemaTable';

const ScopeIcon = ({ stroke }: { stroke: string }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke={stroke}
    strokeWidth="1.9"
    strokeLinejoin="round"
  >
    <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
    <path d="M8 8h8v8H8z" />
  </svg>
);

export interface CrdSchemasProps {
  view?: 'grid' | 'list';
}

export default function CrdSchemas({ view: viewProp = 'grid' }: CrdSchemasProps) {
  const C = usePalette();

  const [q, setQ] = React.useState('');
  const [view, setView] = React.useState<'grid' | 'list'>(viewProp);
  const [groupFilter, setGroupFilter] = React.useState('all');
  const [scopeFilter, setScopeFilter] = React.useState<ScopeFilter>('all');
  const [closed, setClosed] = React.useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  /**
   * The schema shown in the side panel, or null for none.
   *
   * Held here rather than in the URL: the panel is a way of looking at one row
   * of this list without leaving it, so it deliberately has no address. The
   * detail route stays registered and every link still points at it, which is
   * what a shared link, a new tab and a narrow screen all fall back to.
   */
  const [selected, setSelected] = React.useState<{
    crdName: string;
    version: string;
    kind: string;
  } | null>(null);
  const panelViable = useSidePanelViable();

  // No refetchInterval, so Headlamp watches the list over its websocket and a
  // newly installed operator appears without the page being reloaded.
  const crdQuery = K8s.ResourceClasses.CustomResourceDefinition.useList();

  // Every CRD's schema is walked to count its fields, which is the one
  // expensive thing this page does — memoised on the items so it happens per
  // change rather than per keystroke in the filter box.
  const schemas = React.useMemo(() => buildSchemaViews(crdQuery.items), [crdQuery.items]);

  const groupNames = React.useMemo(() => groupsOf(schemas), [schemas]);

  const filters = { query: q.trim().toLowerCase(), group: groupFilter, scope: scopeFilter };
  const groups = groupSchemas(schemas, filters);
  const shown = groups.reduce((n, g) => n + g.schemas.length, 0);
  const filtering = !!filters.query || groupFilter !== 'all' || scopeFilter !== 'all';

  const error = queryError(crdQuery);

  let body: React.ReactNode;
  if (crdQuery.isLoading) {
    body = (
      <Notice C={C} busy title="Loading schemas">
        Reading CustomResourceDefinitions from the cluster.
      </Notice>
    );
  } else if (isForbidden(error)) {
    // Actionable, and the only error here that is about the user rather than
    // the cluster. Listing CRDs is cluster-scoped, so a namespace-bound role
    // reaches this page and can read nothing on it.
    body = (
      <Notice C={C} title="Not allowed to list CustomResourceDefinitions">
        Reading schemas needs cluster-scoped list access on
        customresourcedefinitions.apiextensions.k8s.io.
      </Notice>
    );
  } else if (error) {
    body = (
      <Notice C={C} title="Could not load schemas">
        {error.message || String(error)}
      </Notice>
    );
  } else if (schemas.length === 0) {
    body = <Notice C={C} title="No custom resource definitions on this cluster" />;
  } else if (groups.length === 0) {
    body = (
      <Notice
        C={C}
        title={filters.query ? `No schemas match “${q}”` : 'No schemas in this selection'}
      />
    );
  } else {
    body = groups.map(g => {
      const open = !closed[g.name];
      return (
        <section key={g.name} style={{ marginBottom: '26px' }}>
          <SectionHeading
            C={C}
            label={g.name}
            count={g.schemas.length}
            open={open}
            onToggle={() => setClosed(s => ({ ...s, [g.name]: !s[g.name] }))}
          />
          {open &&
            (view === 'grid' ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))',
                  gap: '12px',
                }}
              >
                {g.schemas.map(schema => (
                  <SchemaCard
                    key={schema.key}
                    C={C}
                    schema={schema}
                    href={schemaURL(schema.crdName, schema.version)}
                    onOpen={
                      panelViable
                        ? () =>
                            setSelected({
                              crdName: schema.crdName,
                              version: schema.version,
                              kind: schema.kind,
                            })
                        : undefined
                    }
                    expanded={!!expanded[schema.key]}
                    onToggle={() => setExpanded(s => ({ ...s, [schema.key]: !s[schema.key] }))}
                  />
                ))}
              </div>
            ) : (
              <SchemaTable
                C={C}
                schemas={g.schemas}
                href={s => schemaURL(s.crdName, s.version)}
                onOpen={
                  panelViable
                    ? s => setSelected({ crdName: s.crdName, version: s.version, kind: s.kind })
                    : undefined
                }
              />
            ))}
        </section>
      );
    });
  }

  return (
    <EvoPage
      section="CRD Schemas"
      title="Custom Resource Schemas"
      summary={
        filtering
          ? `${shown} of ${schemas.length} schemas match`
          : `${schemas.length} schemas · ${groupNames.length} API groups`
      }
      actions={
        <>
          <SearchBox C={C} value={q} onChange={setQ} placeholder="Filter kinds and groups" />
          <FilterSelect
            C={C}
            value={groupFilter}
            onChange={setGroupFilter}
            label="Filter by API group"
            icon={<FolderIcon size={14} stroke={C.textDim} />}
            options={[
              { value: 'all', label: 'All API groups' },
              ...groupNames.map(name => ({
                value: name,
                label: `${name} (${schemas.filter(s => s.group === name).length})`,
              })),
            ]}
          />
          <FilterSelect
            C={C}
            value={scopeFilter}
            onChange={v => setScopeFilter(v as ScopeFilter)}
            label="Filter by scope"
            icon={<ScopeIcon stroke={C.textDim} />}
            options={[
              { value: 'all', label: 'All scopes' },
              { value: 'namespaced', label: 'Namespaced' },
              { value: 'cluster', label: 'Cluster' },
            ]}
          />
          <ViewToggle C={C} value={view} onChange={setView} />
        </>
      }
    >
      {body}
      <SidePanel
        C={C}
        open={!!selected}
        title={selected?.kind ?? ''}
        subtitle={selected && `${selected.crdName} · ${selected.version}`}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <CrdSchemaDetail
            embedded
            name={selected.crdName}
            version={selected.version}
            // Switching version inside the panel must not navigate the list
            // behind it — that is the whole point of opening here.
            onVersionChange={version => setSelected(sel => sel && { ...sel, version })}
          />
        )}
      </SidePanel>
    </EvoPage>
  );
}
