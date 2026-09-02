/**
 * App Endpoints — the catalog of applications published in the cluster.
 *
 * Apps reach the catalog two ways, and the page shows both:
 *
 *   1. A dedicated published-app resource, written on purpose.
 *   2. An Ingress or HTTPRoute that opted itself in with an annotation. No
 *      second object exists for these — the route that publishes the app is
 *      also what describes it.
 *
 * The second is the only one that works on a cluster with no operator
 * installed, which is why a missing CRD is no longer treated as the end of the
 * page: it is one empty source out of two, not a wall.
 *
 * Layout and interaction come from the supplied design component; that
 * vocabulary now lives in ui/chrome.tsx so the other EvoCloud pages are the
 * same furniture with different data in it.
 *
 * Data is live, watched over Headlamp's websocket. The design's mock health
 * status is gone — see k8s/publishedApp.ts for why, and what replaced it.
 *
 * This file is composition only. Shaping and filtering the data is in
 * appEndpoints/model.ts; drawing it is in appEndpoints/AppCard.tsx and
 * appEndpoints/AppTable.tsx.
 */
import { K8s } from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import { ANNOTATIONS, appsFromAnnotations, HTTPRoute, HTTPRouteLike } from '../k8s/annotatedApps';
import { AppEndpoint, IngressLike, LegacyPublishedApp } from '../k8s/publishedApp';
import {
  Code,
  EvoPage,
  FilterSelect,
  firstRealError,
  FolderIcon,
  isNotFound,
  Notice,
  queryError,
  SearchBox,
  SectionHeading,
  SidePanel,
  usePalette,
  useSidePanelViable,
  ViewToggle,
} from '../ui/chrome';
import { AppCard } from './appEndpoints/AppCard';
import { AppDetail } from './appEndpoints/AppDetail';
import { AppTable } from './appEndpoints/AppTable';
import { buildAppViews, groupApps, groupsOf, namespacesOf } from './appEndpoints/model';

const CubeIcon = ({ stroke }: { stroke: string }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke={stroke}
    strokeWidth="1.9"
    strokeLinejoin="round"
  >
    <path d="M12 2.6 21 7v10l-9 4.4L3 17V7z" />
    <path d="M3 7l9 4.4L21 7M12 11.4V21.4" />
  </svg>
);

export interface AppEndpointsProps {
  view?: 'grid' | 'list';
  density?: 'comfortable' | 'compact';
}

export default function AppEndpoints({
  view: viewProp = 'grid',
  density = 'comfortable',
}: AppEndpointsProps) {
  const C = usePalette();

  const [q, setQ] = React.useState('');
  const [view, setView] = React.useState<'grid' | 'list'>(viewProp);
  const [groupFilter, setGroupFilter] = React.useState('all');
  const [nsFilter, setNsFilter] = React.useState('all');
  const [closed, setClosed] = React.useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  /**
   * Key of the app shown in the side panel, or null for none.
   *
   * A key rather than the view itself, so the panel re-reads the live list on
   * every render instead of pinning a snapshot — an app whose route changes
   * while the panel is open updates in place, and one that is deleted closes it.
   */
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const panelViable = useSidePanelViable();

  // No refetchInterval, so Headlamp watches every list over its websocket and
  // the page stays current without polling. Any of the three may 404 — an
  // absent CRD, a cluster without Gateway API — which reads as "none of those"
  // rather than as a failure; see the error handling below.
  const appQuery = AppEndpoint.useList();
  const legacyQuery = LegacyPublishedApp.useList();
  const ingressQuery = K8s.ResourceClasses.Ingress.useList();
  const routeQuery = HTTPRoute.useList();

  // Headlamp hands back KubeObjects, whose spec lives under jsonData for a
  // class built from a CRD and directly on the object for a built-in one.
  // Flattened here so neither the model nor the discovery code has to know.
  const ingresses = React.useMemo(
    () =>
      (ingressQuery.items ?? []).map((i: any) => ({
        metadata: i.metadata,
        spec: i.jsonData?.spec ?? i.spec,
      })) as IngressLike[],
    [ingressQuery.items]
  );

  const httpRoutes = React.useMemo(
    () =>
      (routeQuery.items ?? []).map((r: any) => ({
        metadata: r.metadata,
        spec: r.jsonData?.spec ?? r.spec,
      })) as HTTPRouteLike[],
    [routeQuery.items]
  );

  const annotated = React.useMemo(
    () => appsFromAnnotations(ingresses, httpRoutes),
    [ingresses, httpRoutes]
  );

  // Order is precedence: the catalog's own resource describes an app before
  // the legacy kind does, and both before an annotation on its route.
  const resources = React.useMemo(
    () => [...(appQuery.items ?? []), ...(legacyQuery.items ?? [])],
    [appQuery.items, legacyQuery.items]
  );

  const apps = React.useMemo(
    () => buildAppViews(resources, ingresses, annotated),
    [resources, ingresses, annotated]
  );

  const selected = selectedKey ? apps.find(a => a.key === selectedKey) ?? null : null;

  const groupNames = React.useMemo(() => groupsOf(apps), [apps]);
  const namespaces = React.useMemo(() => namespacesOf(apps), [apps]);

  const filters = { query: q.trim().toLowerCase(), group: groupFilter, namespace: nsFilter };
  const groups = groupApps(apps, filters);
  const shown = groups.reduce((n, g) => n + g.apps.length, 0);
  const filtering = !!filters.query || groupFilter !== 'all' || nsFilter !== 'all';

  // A 404 on any one list is a source that is not present, not an error: the
  // CRD may not be installed, or the cluster may have no Gateway API. Only a
  // real failure — RBAC, a broken connection — should take the page down.
  const error = firstRealError([appQuery, legacyQuery, ingressQuery, routeQuery]);
  const loading =
    appQuery.isLoading || legacyQuery.isLoading || ingressQuery.isLoading || routeQuery.isLoading;

  let body: React.ReactNode;
  if (loading && apps.length === 0) {
    body = (
      <Notice C={C} busy title="Loading applications">
        Reading published apps and annotated routes from the cluster.
      </Notice>
    );
  } else if (error) {
    body = (
      <Notice C={C} title="Could not load applications">
        {error.message || String(error)}
      </Notice>
    );
  } else if (apps.length === 0) {
    // Both sources came back empty. Which of the two is even available changes
    // what there is to say, so say only the part that is actionable: with no
    // CRD the annotation is the whole answer, and it works either way.
    body = (
      <Notice C={C} title="No applications published yet">
        Annotate an Ingress or HTTPRoute with <Code>{ANNOTATIONS.expose}</Code> set to{' '}
        <Code>true</Code> and it appears here.
      </Notice>
    );
  } else if (groups.length === 0) {
    body = (
      <Notice
        C={C}
        title={filters.query ? `No applications match “${q}”` : 'No applications in this group'}
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
            count={g.apps.length}
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
                {g.apps.map(app => (
                  <AppCard
                    key={app.key}
                    C={C}
                    app={app}
                    dense={density === 'compact'}
                    expanded={!!expanded[app.key]}
                    onToggle={() => setExpanded(s => ({ ...s, [app.key]: !s[app.key] }))}
                    onOpen={panelViable ? () => setSelectedKey(app.key) : undefined}
                  />
                ))}
              </div>
            ) : (
              <AppTable
                C={C}
                apps={g.apps}
                onOpen={panelViable ? a => setSelectedKey(a.key) : undefined}
              />
            ))}
        </section>
      );
    });
  }

  return (
    <EvoPage
      section="App Endpoints"
      title="Application Catalog"
      summary={
        filtering
          ? `${shown} of ${apps.length} applications match`
          : `${apps.length} applications · ${groupNames.length} groups`
      }
      actions={
        <>
          <SearchBox C={C} value={q} onChange={setQ} placeholder="Filter applications" />
          <FilterSelect
            C={C}
            value={groupFilter}
            onChange={setGroupFilter}
            label="Filter by group"
            icon={<FolderIcon size={14} stroke={C.textDim} />}
            options={[
              { value: 'all', label: 'All groups' },
              ...groupNames.map(name => ({
                value: name,
                label: `${name} (${apps.filter(a => a.group === name).length})`,
              })),
            ]}
          />
          {/*
            The design put a refresh button here, which became a live badge once
            the list turned out to be websocket-watched. Neither earned the slot:
            the watch keeps the page current whether or not anything says so. A
            namespace filter is the useful thing to put here — apps genuinely
            span namespaces and nothing else filtered by one. Only worth showing
            when there is more than one to choose between.
          */}
          {namespaces.length > 1 && (
            <FilterSelect
              C={C}
              value={nsFilter}
              onChange={setNsFilter}
              label="Filter by namespace"
              icon={<CubeIcon stroke={C.textDim} />}
              options={[
                { value: 'all', label: 'All namespaces' },
                ...namespaces.map(ns => ({
                  value: ns,
                  label: `${ns} (${apps.filter(a => a.ns === ns).length})`,
                })),
              ]}
            />
          )}
          <ViewToggle C={C} value={view} onChange={setView} />
        </>
      }
    >
      {body}
      <SidePanel
        C={C}
        open={!!selected}
        title={selected?.name ?? ''}
        subtitle={selected && `${selected.group} · ${selected.ns}`}
        onClose={() => setSelectedKey(null)}
      >
        {selected && (
          <div style={{ padding: '16px' }}>
            <AppDetail C={C} app={selected} />
          </div>
        )}
      </SidePanel>
    </EvoPage>
  );
}
