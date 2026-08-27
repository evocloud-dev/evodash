/**
 * App Endpoints — the catalog of applications published in the cluster.
 *
 * "App Endpoints" is the product name. The data underneath is still Stakater's
 * ForecastleApp custom resource, and the k8s/ modules keep that name because it
 * is the literal API kind; only what the user reads is rebranded.
 *
 * Layout and interaction come from the supplied design component; that
 * vocabulary now lives in ui/chrome.tsx so the other EvoCloud pages are the
 * same furniture with different data in it.
 *
 * Data is live, watched over Headlamp's websocket. The design's mock health
 * status is gone — see k8s/forecastleApp.ts for why, and what replaced it.
 *
 * This file is composition only. Shaping and filtering the data is in
 * appEndpoints/model.ts; drawing it is in appEndpoints/AppCard.tsx and
 * appEndpoints/AppTable.tsx.
 */
import { K8s } from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import { ForecastleApp, IngressLike } from '../k8s/forecastleApp';
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
  usePalette,
  ViewToggle,
} from '../ui/chrome';
import { AppCard } from './appEndpoints/AppCard';
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

  // No refetchInterval, so Headlamp watches both lists over its websocket and
  // the page stays current without polling.
  const appQuery = ForecastleApp.useList();
  const ingressQuery = K8s.ResourceClasses.Ingress.useList();

  const apps = React.useMemo(
    () => buildAppViews(appQuery.items, ingressQuery.items as unknown as IngressLike[] | null),
    [appQuery.items, ingressQuery.items]
  );

  console.log({ apps });

  const groupNames = React.useMemo(() => groupsOf(apps), [apps]);
  const namespaces = React.useMemo(() => namespacesOf(apps), [apps]);

  const filters = { query: q.trim().toLowerCase(), group: groupFilter, namespace: nsFilter };
  const groups = groupApps(apps, filters);
  const shown = groups.reduce((n, g) => n + g.apps.length, 0);
  const filtering = !!filters.query || groupFilter !== 'all' || nsFilter !== 'all';

  const error = firstRealError([appQuery]) ?? queryError(appQuery);
  const notInstalled = isNotFound(queryError(appQuery));

  let body: React.ReactNode;
  if (appQuery.isLoading) {
    body = (
      <Notice C={C} title="Loading applications">
        Reading ForecastleApp resources from the cluster.
      </Notice>
    );
  } else if (notInstalled) {
    // Kept explanatory: this one is actionable — something has to be installed.
    body = (
      <Notice C={C} title="App Endpoints is not installed on this cluster">
        No <Code>forecastleapps.forecastle.stakater.com</Code> resource definition was found.
        Install the operator, then this catalog will populate itself.
      </Notice>
    );
  } else if (error) {
    body = (
      <Notice C={C} title="Could not load applications">
        {error.message || String(error)}
      </Notice>
    );
  } else if (apps.length === 0) {
    // The heading says it. Anything more was explaining a resource kind to
    // someone who just wants to know the list is empty.
    body = <Notice C={C} title="No applications published yet" />;
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
                  />
                ))}
              </div>
            ) : (
              <AppTable C={C} apps={g.apps} />
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
      {/*
        The Forecastle web-UI strip used to sit here — port-forward controls for
        reaching Forecastle's own dashboard. Taken off the page: the catalog
        above is the product, and a panel captioned "optional · the catalog does
        not need it" was telling the truth about itself.

        appEndpoints/WebUiStrip.tsx is left in place, working, and can be dropped
        back in with a single line if the forwarding controls are ever wanted.
      */}
    </EvoPage>
  );
}
