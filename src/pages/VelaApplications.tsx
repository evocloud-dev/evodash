/**
 * KubeVela Applications — what has been delivered to this cluster, and how.
 *
 * A KubeVela Application is a deployment described by intent rather than by
 * manifests: a list of components with settings, traits bolted onto them, and a
 * workflow that applies the lot. The objects it produces are visible in
 * Headlamp already; what is not visible anywhere else is the intent above them,
 * which is what this page shows.
 *
 * Everything here is read from the Application resource itself. VelaUX keeps a
 * second copy of some of this in its own store, and that copy is deliberately
 * not consulted — the resource is what the controller acts on, so it is the
 * only account of the cluster that cannot be stale.
 *
 * Addons are applications too: KubeVela installs each one as an Application in
 * vela-system, carrying an addon label. They are shown, but marked and
 * separable, because on a cluster that is only just set up they are all there
 * is, and an unmarked list of them reads as a busy platform when it is an empty
 * one.
 *
 * This file is composition only. Shaping and filtering is in velaApps/model.ts;
 * the detail panel is velaApps/AppDetail.tsx.
 */
import React from 'react';
import { readyTone, tally } from '../k8s/conditions';
import { Application } from '../k8s/kubevela';
import {
  age,
  allNotFound,
  Chip,
  CLIP,
  Code,
  Column,
  DataTable,
  Dot,
  EvoPage,
  FilterSelect,
  firstRealError,
  FolderIcon,
  ListQuery,
  LiveBadge,
  Mono,
  Notice,
  Pill,
  SearchBox,
  SectionHeading,
  SidePanel,
  StatGrid,
  usePalette,
  useRevision,
  useSidePanelViable,
} from '../ui/chrome';
import { AppDetail } from './velaApps/AppDetail';
import { AppView, buildAppViews, matchesApp, namespacesOf, Origin } from './velaApps/model';

export default function VelaApplications() {
  const C = usePalette();

  const [q, setQ] = React.useState('');
  const [nsFilter, setNsFilter] = React.useState('all');
  const [stateFilter, setStateFilter] = React.useState('all');
  const [originFilter, setOriginFilter] = React.useState<Origin>('all');
  /**
   * Key of the application in the panel, not the view itself, so the panel
   * re-reads the live list on every render: an application whose workflow moves
   * on while the panel is open updates in place, and one that is deleted closes
   * it.
   */
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const panelViable = useSidePanelViable();

  // No refetchInterval — Headlamp watches the list over its websocket, so a
  // deploy in flight advances here without the page polling for it.
  const appQuery = Application.useList() as unknown as ListQuery;

  const apps = React.useMemo(() => buildAppViews(appQuery.items), [appQuery.items]);

  const revision = useRevision([appQuery]);
  const loading = appQuery.isLoading;
  const notInstalled = allNotFound([appQuery]);
  const hardError = firstRealError([appQuery]);

  const counts = tally(apps.map(a => a.health.state));
  const addons = apps.filter(a => a.addon).length;
  const components = apps.reduce((n, a) => n + a.components.length, 0);
  // Components the controller has reported healthy. Counted against what the
  // applications declare rather than against what `status` lists, so a
  // component that has produced no service yet reads as not-yet-healthy instead
  // of being left out of the denominator and flattering the figure.
  const healthy = apps.reduce((n, a) => n + (a.healthyServices ?? 0), 0);

  const filter = { query: q, ns: nsFilter, state: stateFilter, origin: originFilter };
  const shown = apps.filter(a => matchesApp(a, filter));
  const filtering =
    !!q.trim() || nsFilter !== 'all' || stateFilter !== 'all' || originFilter !== 'all';

  const selected = selectedKey ? apps.find(a => a.key === selectedKey) ?? null : null;

  let summary: React.ReactNode;
  if (loading) {
    summary = 'Reading KubeVela applications from the cluster';
  } else if (notInstalled) {
    summary = 'KubeVela is not installed on this cluster';
  } else if (filtering) {
    summary = `${shown.length} of ${apps.length} applications match`;
  } else {
    const parts = [`${apps.length} ${apps.length === 1 ? 'application' : 'applications'}`];
    parts.push(`${components} ${components === 1 ? 'component' : 'components'}`);
    if (addons) {
      parts.push(`${addons} from addons`);
    }
    summary = parts.join(' · ');
  }

  const nsOptions = [
    { value: 'all', label: 'All namespaces' },
    ...namespacesOf(apps).map(ns => ({
      value: ns,
      label: `${ns} (${apps.filter(a => a.ns === ns).length})`,
    })),
  ];

  const stateOptions = [
    { value: 'all', label: 'Any status' },
    { value: 'ready', label: `Running (${counts.ready})` },
    { value: 'failed', label: `Failed (${counts.failed})` },
    { value: 'reconciling', label: `In progress (${counts.reconciling})` },
    { value: 'suspended', label: `Suspended (${counts.suspended})` },
    { value: 'unknown', label: `Unknown (${counts.unknown})` },
  ];

  const originOptions = [
    { value: 'all', label: `Everything (${apps.length})` },
    { value: 'own', label: `Deployed apps (${apps.length - addons})` },
    { value: 'addon', label: `Addons (${addons})` },
  ];

  const columns: Column<AppView>[] = [
    {
      key: 'name',
      label: 'Application',
      width: 'minmax(160px, 1.4fr)',
      render: app => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {panelViable ? (
            <button
              type="button"
              onClick={() => setSelectedKey(app.key)}
              title={`Open ${app.name}`}
              style={{
                ...CLIP,
                minWidth: 0,
                padding: 0,
                background: 'transparent',
                border: 0,
                textAlign: 'left',
                font: 'inherit',
                fontSize: '13.5px',
                fontWeight: 600,
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              {app.name}
            </button>
          ) : (
            <span style={{ ...CLIP, fontSize: '13.5px', fontWeight: 600, minWidth: 0 }}>
              {app.name}
            </span>
          )}
          {app.addon && (
            <Chip C={C} title={`Installed by the ${app.addon.name} addon`}>
              addon
            </Chip>
          )}
        </div>
      ),
    },
    {
      key: 'ns',
      label: 'Namespace',
      width: 'minmax(100px, 0.8fr)',
      render: app => (
        <Chip C={C} title={app.ns}>
          {app.ns}
        </Chip>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: 'minmax(108px, 122px)',
      render: app => {
        const tone = readyTone(C, app.health.state);
        return (
          <>
            <Dot color={tone.fg} title={app.health.message ?? app.health.label} />
            <Mono C={C} color={tone.fg} title={app.health.message ?? app.health.label}>
              {app.health.label}
            </Mono>
          </>
        );
      },
    },
    {
      key: 'components',
      label: 'Components',
      width: 'minmax(140px, 1.3fr)',
      render: app => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <Mono C={C} color={C.textValue}>
            {app.components.length}
          </Mono>
          {app.types.slice(0, 2).map(type => (
            <Pill key={type} fg={C.accent} bg={C.accentSoft} border={C.accentBorder}>
              {type}
            </Pill>
          ))}
          {app.types.length > 2 && (
            <Mono C={C} color={C.textDimmer} title={app.types.join(', ')}>
              +{app.types.length - 2}
            </Mono>
          )}
        </div>
      ),
    },
    {
      key: 'workflow',
      label: 'Workflow',
      width: 'minmax(110px, 130px)',
      render: app => {
        const workflow = app.workflow;
        if (!workflow) {
          return (
            <Mono C={C} color={C.textDimmer}>
              —
            </Mono>
          );
        }
        const steps = workflow.steps ?? [];
        const done = steps.filter(s => s.phase === 'succeeded').length;
        return (
          <Mono
            C={C}
            title={`${workflow.status ?? 'unknown'} · ${done} of ${steps.length} steps succeeded`}
          >
            {workflow.status ?? '—'}
            {steps.length > 0 && ` ${done}/${steps.length}`}
          </Mono>
        );
      },
    },
    {
      key: 'revision',
      label: 'Revision',
      width: 'minmax(110px, 1fr)',
      render: app => (
        <Mono
          C={C}
          color={app.revision ? C.textValue : C.textDimmer}
          title={app.revision ?? 'Nothing published yet'}
        >
          {app.revision ?? '—'}
        </Mono>
      ),
    },
    {
      key: 'age',
      label: 'Age',
      width: '70px',
      align: 'right',
      render: app => (
        <Mono C={C} color={C.textDimmer} title={app.created ?? undefined}>
          {age(app.created)}
        </Mono>
      ),
    },
  ];

  const actions = (
    <>
      <SearchBox C={C} value={q} onChange={setQ} placeholder="Filter applications" />
      <FilterSelect
        C={C}
        value={originFilter}
        onChange={v => setOriginFilter(v as Origin)}
        options={originOptions}
        label="Filter by origin"
        icon={<FolderIcon size={14} stroke={C.textDim} />}
      />
      <FilterSelect
        C={C}
        value={nsFilter}
        onChange={setNsFilter}
        options={nsOptions}
        label="Filter by namespace"
      />
      <FilterSelect
        C={C}
        value={stateFilter}
        onChange={setStateFilter}
        options={stateOptions}
        label="Filter by status"
      />
      <LiveBadge
        C={C}
        fetching={appQuery.isFetching}
        error={notInstalled ? null : hardError}
        revision={revision}
        what="KubeVela applications"
      />
    </>
  );

  let body: React.ReactNode;
  if (loading) {
    body = (
      <Notice C={C} title="Loading applications">
        Reading KubeVela applications from the cluster.
      </Notice>
    );
  } else if (notInstalled) {
    body = (
      <Notice C={C} title="KubeVela is not installed on this cluster">
        No <Code>core.oam.dev</Code> Application resource definition was found. Install KubeVela and
        every application delivered through it appears here.
      </Notice>
    );
  } else if (hardError) {
    body = (
      <Notice C={C} title="Could not load applications">
        {hardError.message || String(hardError)}
      </Notice>
    );
  } else if (apps.length === 0) {
    body = (
      <Notice C={C} title="KubeVela is installed but has delivered nothing">
        The <Code>Application</Code> resource definition is present and no application exists yet.
        Deploy one and its components, settings and workflow show up here.
      </Notice>
    );
  } else {
    body = (
      <>
        <StatGrid
          C={C}
          min="220px"
          stats={[
            {
              label: 'Applications',
              value: apps.length,
              sub: addons ? `${apps.length - addons} yours` : 'all yours',
              ratio: { value: apps.length - addons, total: apps.length, of: 'yours' },
            },
            {
              label: 'Components',
              value: components,
              sub: `${healthy} healthy`,
              ratio: { value: healthy, total: components, of: 'healthy' },
            },
            {
              label: 'Running',
              value: counts.ready,
              sub: `of ${counts.total}`,
              tone: counts.ready === counts.total ? C.healthy : undefined,
              ratio: { value: counts.ready, total: counts.total, of: 'running' },
            },
            {
              label: 'Failed',
              value: counts.failed,
              sub: counts.failed ? 'needs attention' : 'none',
              tone: counts.failed ? C.danger : undefined,
              ratio: { value: counts.failed, total: counts.total, of: 'failed' },
            },
            {
              label: 'In progress',
              value: counts.reconciling,
              sub: 'deploying',
              tone: counts.reconciling ? C.gold : undefined,
              ratio: { value: counts.reconciling, total: counts.total, of: 'deploying' },
            },
            {
              label: 'Suspended',
              value: counts.suspended,
              sub: counts.suspended ? 'awaiting resume' : 'none',
              tone: counts.suspended ? C.gold : undefined,
              ratio: { value: counts.suspended, total: counts.total, of: 'suspended' },
            },
          ]}
        />

        <section style={{ marginTop: '26px' }}>
          <SectionHeading C={C} label="Applications" count={shown.length} />
          {shown.length === 0 ? (
            <div
              style={{
                padding: '22px',
                border: `1px dashed ${C.border}`,
                borderRadius: '10px',
                background: C.surfaceSunken,
                fontSize: '12.5px',
                color: C.textMuted,
                textAlign: 'center',
              }}
            >
              No applications match the current filters.
            </div>
          ) : (
            <DataTable C={C} columns={columns} rows={shown} rowKey={app => app.key} />
          )}
        </section>
      </>
    );
  }

  return (
    <EvoPage section="KubeVela" title="KubeVela Applications" summary={summary} actions={actions}>
      {body}

      <SidePanel
        C={C}
        open={!!selected}
        title={selected?.name ?? ''}
        subtitle={selected && `${selected.components.length} components · ${selected.ns}`}
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
