/**
 * EvoCloud Overview — what this cluster looks like through the plugin's eyes.
 *
 * Deliberately not a dashboard of Kubernetes health: Headlamp already has one,
 * and a second set of pod counts would be a worse copy of it. This answers the
 * question the plugin is for — what is published here, and what contracts do
 * the custom resources declare — and hands you to the page that goes deeper.
 *
 * Reads the same queries the section pages do rather than a summary endpoint,
 * because there is no such endpoint and because Headlamp watches these lists
 * over one websocket: opening Overview first makes the pages behind it warm
 * rather than costing a second fetch.
 *
 * {@link SECTIONS} is the extension point. A future section is a new entry
 * there plus its route in index.tsx — this file needs no other edit, which is
 * the whole reason the cards are generated from data instead of written out.
 */
import { K8s, Router } from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { appsFromAnnotations, HTTPRoute, HTTPRouteLike } from '../k8s/annotatedApps';
import { AppEndpoint, IngressLike, LegacyPublishedApp } from '../k8s/publishedApp';
import {
  allNotFound,
  Chip,
  firstRealError,
  isForbidden,
  Notice,
  Panel,
  Stat,
  StatGrid,
  usePalette,
  EvoPage,
} from '../ui/chrome';
import { buildAppViews, groupsOf as appGroupsOf } from './appEndpoints/model';
import { BarChart, Slice, StackedBar } from './overview/Charts';
import { buildSchemaViews, groupsOf as schemaGroupsOf } from './crdSchemas/model';
import { CRD_SCHEMAS_ROUTE } from './crdSchemas/routes';

// Via the namespace, not `lib/lib/router` — see the note in ui/chrome.tsx.
const { createRouteURL } = Router;

/** Route name of the catalog, kept beside the one it is paired with. */
const APP_ENDPOINTS_ROUTE = 'evocloud-app-endpoints';

/** A section of the plugin, as the Overview advertises it. */
interface SectionCard {
  /** Route name registered in index.tsx. */
  route: string;
  title: string;
  /** One line: what the page answers, not what it contains. */
  blurb: string;
  /** Live count, or null while it cannot be known. */
  count: number | null;
  /** What the count counts, singular. Pluralised with a bare "s". */
  unit: string;
  /** Second line of detail — a breakdown, a caveat. */
  detail?: React.ReactNode;
}

export default function Overview() {
  const C = usePalette();

  // The same four lists App Endpoints reads. Any of them may 404 — an absent
  // CRD, a cluster with no Gateway API — which means "none of those" and not a
  // failure; see the error handling below.
  const appQuery = AppEndpoint.useList();
  const legacyQuery = LegacyPublishedApp.useList();
  const ingressQuery = K8s.ResourceClasses.Ingress.useList();
  const routeQuery = HTTPRoute.useList();
  const crdQuery = K8s.ResourceClasses.CustomResourceDefinition.useList();

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

  const resources = React.useMemo(
    () => [...(appQuery.items ?? []), ...(legacyQuery.items ?? [])],
    [appQuery.items, legacyQuery.items]
  );

  const apps = React.useMemo(
    () => buildAppViews(resources, ingresses, annotated),
    [resources, ingresses, annotated]
  );

  const schemas = React.useMemo(() => buildSchemaViews(crdQuery.items), [crdQuery.items]);

  const appQueries = [appQuery, legacyQuery, ingressQuery, routeQuery];
  const loading =
    [...appQueries, crdQuery].some(q => q.isLoading) && apps.length === 0 && schemas.length === 0;
  const error = firstRealError([...appQueries, crdQuery]);

  const byResource = apps.filter(a => a.source === 'Resource').length;
  const byAnnotation = apps.length - byResource;
  const unreachable = apps.filter(a => !a.link.url).length;
  const restricted = apps.filter(a => a.restricted).length;

  /**
   * Schemas per API group, largest first.
   *
   * Tailed off past the eighth: a cluster with Gateway API and a service mesh
   * runs to twenty-odd groups, and the long tail of one-schema groups tells you
   * nothing a single "Other" row does not.
   */
  const schemasByGroup: Slice[] = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const schema of schemas) {
      counts.set(schema.group, (counts.get(schema.group) ?? 0) + 1);
    }

    const sorted = [...counts]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

    const TOP = 8;
    if (sorted.length <= TOP + 1) {
      return sorted;
    }
    const tail = sorted.slice(TOP).reduce((n, g) => n + g.value, 0);
    return [...sorted.slice(0, TOP), { label: `Other (${sorted.length - TOP} groups)`, value: tail }];
  }, [schemas]);

  // Fixed order, so a source dropping to zero never repaints the others.
  const bySource: Slice[] = React.useMemo(
    () => [
      { label: 'Resource', value: apps.filter(a => a.source === 'Resource').length },
      { label: 'Ingress', value: apps.filter(a => a.source === 'Ingress').length },
      { label: 'HTTPRoute', value: apps.filter(a => a.source === 'HTTPRoute').length },
    ],
    [apps]
  );

  // One filled segment is a stat tile with extra ink, and one bar is not a bar
  // chart — below two categories each figure is dropped rather than drawn.
  const sourcesUsed = bySource.filter(s => s.value > 0).length;

  const appGroups = appGroupsOf(apps).length;
  const apiGroups = schemaGroupsOf(schemas).length;

  // Every list 404ing is a cluster with nowhere for apps to come from, which is
  // worth saying once here rather than as four empty tiles.
  const noAppSources = allNotFound(appQueries);

  const stats: Stat[] = [
    {
      label: 'Applications',
      value: apps.length,
      sub: appGroups === 1 ? '1 group' : `${appGroups} groups`,
      route: APP_ENDPOINTS_ROUTE,
    },
    {
      label: 'From annotations',
      value: byAnnotation,
      sub: 'Ingress · HTTPRoute',
      tone: byAnnotation > 0 ? C.brand : undefined,
    },
    {
      label: 'From resources',
      value: byResource,
      sub: 'AppEndpoint',
      tone: byResource > 0 ? C.brand : undefined,
    },
    {
      label: 'Network restricted',
      value: restricted,
      sub: restricted === 1 ? '1 of ' + apps.length : `${restricted} of ${apps.length}`,
      tone: restricted > 0 ? C.gold : undefined,
    },
    {
      label: 'Without a URL',
      value: unreachable,
      sub: 'published, unreachable',
      tone: unreachable > 0 ? C.danger : C.healthy,
    },
    {
      label: 'CRD schemas',
      value: schemas.length,
      sub: apiGroups === 1 ? '1 API group' : `${apiGroups} API groups`,
      route: CRD_SCHEMAS_ROUTE,
    },
  ];

  const SECTIONS: SectionCard[] = [
    {
      route: APP_ENDPOINTS_ROUTE,
      title: 'App Endpoints',
      blurb: 'Everything published in this cluster, and how to reach it.',
      count: apps.length,
      unit: 'application',
      detail: (
        <>
          <Chip C={C}>{byAnnotation} annotated</Chip>
          <Chip C={C}>{byResource} declared</Chip>
        </>
      ),
    },
    {
      route: CRD_SCHEMAS_ROUTE,
      title: 'CRD Schemas',
      blurb: 'What may go in a manifest, field by field, for every custom resource.',
      count: schemas.length,
      unit: 'schema',
      detail: <Chip C={C}>{apiGroups} API groups</Chip>,
    },
  ];

  let body: React.ReactNode;
  if (loading) {
    body = (
      <Notice C={C} busy title="Reading the cluster">
        Collecting published applications and custom resource definitions.
      </Notice>
    );
  } else if (isForbidden(error)) {
    body = (
      <Notice C={C} title="Not allowed to read this cluster">
        The overview needs list access to ingresses, custom resources and
        customresourcedefinitions.
      </Notice>
    );
  } else if (error) {
    body = (
      <Notice C={C} title="Could not read the cluster">
        {error.message || String(error)}
      </Notice>
    );
  } else {
    body = (
      <>
        <StatGrid C={C} stats={stats} />

        {(sourcesUsed > 1 || schemasByGroup.length > 1) && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '12px',
              marginBottom: '26px',
              alignItems: 'start',
            }}
          >
            {sourcesUsed > 1 && (
              <Panel C={C} caption="Applications by source">
                <div style={{ padding: '16px 16px 14px' }}>
                  <StackedBar C={C} slices={bySource} unit="application" />
                </div>
              </Panel>
            )}

            {schemasByGroup.length > 1 && (
              <Panel C={C} caption="Schemas by API group">
                <div style={{ padding: '12px 16px 14px' }}>
                  <BarChart C={C} rows={schemasByGroup} unit="schema" />
                </div>
              </Panel>
            )}
          </div>
        )}

        {noAppSources && (
          <div style={{ marginBottom: '22px' }}>
            <Notice C={C} title="Nothing can publish an app here yet">
              None of the sources the catalog reads exist on this cluster. Installing the
              AppEndpoint CRD, or annotating an Ingress or HTTPRoute, gives it something to
              show.
            </Notice>
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '12px',
          }}
        >
          {SECTIONS.map(section => (
            <RouterLink
              key={section.route}
              to={createRouteURL(section.route)}
              className="evo-navcard"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '15px 16px 14px',
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: '10px',
                transition: 'border-color 140ms ease, background 140ms ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '9px' }}>
                <span
                  className="evo-navcard-title"
                  style={{ fontSize: '14.5px', fontWeight: 700, letterSpacing: '-0.005em' }}
                >
                  {section.title}
                </span>
                <span style={{ flex: 1 }} />
                {section.count !== null && (
                  <span style={{ fontSize: '13px', color: C.textMuted }}>
                    {section.count} {section.unit}
                    {section.count === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12.5px', color: C.textDimmer, lineHeight: 1.55 }}>
                {section.blurb}
              </div>
              {section.detail && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                  {section.detail}
                </div>
              )}
            </RouterLink>
          ))}
        </div>
      </>
    );
  }

  return (
    <EvoPage
      section="Overview"
      title="Platform Overview"
      summary={
        loading
          ? 'Reading the cluster'
          : `${apps.length} application${apps.length === 1 ? '' : 's'} · ${
              schemas.length
            } schema${schemas.length === 1 ? '' : 's'}`
      }
    >
      {body}
    </EvoPage>
  );
}
