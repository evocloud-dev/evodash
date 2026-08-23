/**
 * GitOps delivery — the Flux control loop, as the cluster reports it.
 *
 * Two tables, because Flux itself is split in two: sources fetch a revision
 * into the cluster, appliers reconcile that revision onto it. Splitting them
 * the same way makes a stalled delivery readable at a glance — a source stuck
 * on an old revision is a different problem from an applier that cannot apply
 * the new one.
 *
 * Everything shown is read from the resources; nothing is derived by probing
 * or guessing. When the flux-operator is installed its FluxReport supplies the
 * distribution version and per-controller health, which no amount of counting
 * custom resources could tell us.
 */
import { useTheme } from '@mui/material/styles';
import React from 'react';
import {
  Readiness,
  readiness,
  ReadyState,
  readyTone,
  tally,
} from '../k8s/conditions';
import {
  APPLIER_KINDS,
  Bucket,
  fluxOrigin,
  FluxReport,
  FluxReportSpec,
  fluxRevision,
  GitRepository,
  HelmRelease,
  HelmRepository,
  imageTag,
  Kustomization,
  OCIRepository,
  SOURCE_KINDS,
} from '../k8s/flux';
import { EVOCLOUD_DARK, EVOCLOUD_LIGHT } from '../palette';
import {
  age,
  allNotFound,
  Chip,
  Code,
  Column,
  DataTable,
  Dot,
  EvoPage,
  FilterSelect,
  firstRealError,
  FolderIcon,
  KeyValues,
  ListQuery,
  LiveBadge,
  MONO,
  Mono,
  Notice,
  Panel,
  Pill,
  SearchBox,
  SectionHeading,
  shortRevision,
  StatGrid,
  useRevision,
} from '../ui/chrome';

interface FluxRow {
  key: string;
  kind: string;
  name: string;
  ns: string;
  /** URL for a source, `Kind/ns/name` for an applier. */
  origin: string | null;
  revision: string | null;
  /** Reconcile period from `spec.interval`. */
  interval: string | null;
  ready: Readiness;
}

/** Turn a Headlamp list result into rows, tagging each with the kind it came from. */
function rowsOf(kind: string, query: ListQuery): FluxRow[] {
  return (query.items ?? []).map((item: any) => {
    const json = item.jsonData ?? {};
    const ns = item.metadata?.namespace ?? '';
    return {
      key: item.metadata?.uid || `${kind}/${ns}/${item.metadata?.name}`,
      kind,
      name: item.metadata?.name ?? '',
      ns,
      origin: fluxOrigin(json),
      revision: fluxRevision(json),
      interval: json.spec?.interval ?? null,
      ready: readiness(json),
    };
  });
}

export default function GitOpsDelivery() {
  const [q, setQ] = React.useState('');
  const [kindFilter, setKindFilter] = React.useState('all');
  const [stateFilter, setStateFilter] = React.useState('all');

  const isDark = useTheme().palette.mode === 'dark';
  const C = isDark ? EVOCLOUD_DARK : EVOCLOUD_LIGHT;

  // No refetchInterval, so Headlamp watches every list over its websocket and
  // the page stays current without polling.
  const gitRepos = GitRepository.useList() as unknown as ListQuery;
  const ociRepos = OCIRepository.useList() as unknown as ListQuery;
  const helmRepos = HelmRepository.useList() as unknown as ListQuery;
  const buckets = Bucket.useList() as unknown as ListQuery;
  const kustomizations = Kustomization.useList() as unknown as ListQuery;
  const helmReleases = HelmRelease.useList() as unknown as ListQuery;
  const reports = FluxReport.useList() as unknown as ListQuery;

  const toolkit = [gitRepos, ociRepos, helmRepos, buckets, kustomizations, helmReleases];
  const watched = [...toolkit, reports];

  const sources = React.useMemo(
    () => [
      ...rowsOf('GitRepository', gitRepos),
      ...rowsOf('OCIRepository', ociRepos),
      ...rowsOf('HelmRepository', helmRepos),
      ...rowsOf('Bucket', buckets),
    ],
    [gitRepos.items, ociRepos.items, helmRepos.items, buckets.items]
  );

  const appliers = React.useMemo(
    () => [...rowsOf('Kustomization', kustomizations), ...rowsOf('HelmRelease', helmReleases)],
    [kustomizations.items, helmReleases.items]
  );

  const report: FluxReportSpec | null = (reports.items?.[0]?.jsonData?.spec as FluxReportSpec) ?? null;

  const revision = useRevision(watched);
  const fetching = watched.some(x => x.isFetching);
  const loading = toolkit.every(x => x.isLoading);
  const notInstalled = allNotFound(toolkit);
  const hardError = firstRealError(toolkit);

  const all = [...sources, ...appliers];
  const counts = tally(all.map(r => r.ready.state));

  const query = q.trim().toLowerCase();
  const matches = (r: FluxRow) =>
    (!query || `${r.name} ${r.ns} ${r.kind} ${r.origin ?? ''} ${r.revision ?? ''}`.toLowerCase().includes(query)) &&
    (kindFilter === 'all' || r.kind === kindFilter) &&
    (stateFilter === 'all' || r.ready.state === stateFilter);

  const shownSources = sources.filter(matches);
  const shownAppliers = appliers.filter(matches);
  const filtering = !!query || kindFilter !== 'all' || stateFilter !== 'all';

  const distributionVersion = report?.distribution?.version ?? null;

  let summary: React.ReactNode;
  if (loading) {
    summary = 'Reading Flux resources from the cluster';
  } else if (notInstalled) {
    summary = 'Flux is not installed on this cluster';
  } else if (filtering) {
    summary = `${shownSources.length + shownAppliers.length} of ${all.length} resources match`;
  } else {
    const parts = [
      `${sources.length} ${sources.length === 1 ? 'source' : 'sources'}`,
      `${appliers.length} ${appliers.length === 1 ? 'applier' : 'appliers'}`,
    ];
    if (distributionVersion) {
      parts.push(`Flux ${distributionVersion}`);
    }
    summary = parts.join(' · ');
  }

  const kindOptions = [
    { value: 'all', label: 'All kinds' },
    ...[...SOURCE_KINDS, ...APPLIER_KINDS].map(k => {
      const n = all.filter(r => r.kind === k).length;
      return { value: k, label: `${k} (${n})` };
    }),
  ];

  const stateOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'Any status' },
    { value: 'ready', label: `Ready (${counts.ready})` },
    { value: 'failed', label: `Failed (${counts.failed})` },
    { value: 'reconciling', label: `Reconciling (${counts.reconciling})` },
    { value: 'suspended', label: `Suspended (${counts.suspended})` },
    { value: 'unknown', label: `Unknown (${counts.unknown})` },
  ];

  const StatusCell = ({ ready }: { ready: Readiness }) => {
    const tone = readyTone(C, ready.state);
    return (
      <>
        <Dot color={tone.fg} title={ready.message ?? ready.label} />
        <Mono C={C} title={ready.message ?? ready.label} color={tone.fg}>
          {ready.label}
        </Mono>
      </>
    );
  };

  const KindCell = ({ kind }: { kind: string }) => (
    <Pill fg={C.brand} bg={C.brandSoft} border={C.brandBorder}>
      {kind}
    </Pill>
  );

  const columns: Column<FluxRow>[] = [
    { key: 'kind', label: 'Kind', width: 'minmax(118px, 130px)', render: r => <KindCell kind={r.kind} /> },
    {
      key: 'name',
      label: 'Name',
      width: 'minmax(130px, 1.1fr)',
      render: r => (
        <span
          title={r.name}
          style={{
            fontSize: '13.5px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
          }}
        >
          {r.name}
        </span>
      ),
    },
    {
      key: 'ns',
      label: 'Namespace',
      width: 'minmax(100px, 0.8fr)',
      render: r => <Chip C={C} title={r.ns}>{r.ns}</Chip>,
    },
    {
      key: 'origin',
      label: 'Source',
      width: 'minmax(150px, 1.5fr)',
      render: r => (
        <Mono C={C} title={r.origin ?? 'No source recorded on the resource'}>
          {r.origin ?? '—'}
        </Mono>
      ),
    },
    {
      key: 'revision',
      label: 'Revision',
      width: 'minmax(130px, 1.2fr)',
      render: r => (
        <Mono
          C={C}
          color={r.revision ? C.textValue : C.textDimmer}
          title={r.revision ?? 'Nothing reconciled yet'}
        >
          {shortRevision(r.revision)}
        </Mono>
      ),
    },
    { key: 'status', label: 'Status', width: 'minmax(112px, 130px)', render: r => <StatusCell ready={r.ready} /> },
    {
      key: 'interval',
      label: 'Every',
      width: '72px',
      render: r => <Mono C={C}>{r.interval ?? '—'}</Mono>,
    },
    {
      key: 'age',
      label: 'Changed',
      width: '78px',
      align: 'right',
      render: r => (
        <Mono C={C} color={C.textDimmer} title={r.ready.since ?? undefined}>
          {age(r.ready.since)}
        </Mono>
      ),
    },
  ];

  const actions = (
    <>
      <SearchBox C={C} value={q} onChange={setQ} placeholder="Filter resources" />
      <FilterSelect
        C={C}
        value={kindFilter}
        onChange={setKindFilter}
        options={kindOptions}
        label="Filter by kind"
        icon={<FolderIcon size={14} stroke={C.textDim} />}
      />
      <FilterSelect C={C} value={stateFilter} onChange={setStateFilter} options={stateOptions} label="Filter by status" />
      <LiveBadge
        C={C}
        fetching={fetching}
        error={notInstalled ? null : hardError}
        revision={revision}
        what="Flux sources and appliers"
      />
    </>
  );

  /** The flux-operator's own account of the installation. */
  const distribution = report && (
    <div style={{ marginBottom: '26px' }}>
      <SectionHeading C={C} label="Distribution" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
        <Panel C={C} caption="Flux installation">
          <div style={{ padding: '12px 14px 14px' }}>
            <KeyValues
              C={C}
              rows={[
                { k: 'version', v: report.distribution?.version ?? '—', color: C.gold },
                { k: 'status', v: report.distribution?.status ?? '—' },
                { k: 'managed by', v: report.distribution?.managedBy ?? 'unmanaged' },
                { k: 'entitlement', v: report.distribution?.entitlement ?? '—' },
                { k: 'operator', v: report.operator?.version ?? '—' },
                {
                  k: 'cluster',
                  v: [report.cluster?.serverVersion, report.cluster?.platform].filter(Boolean).join(' · ') || '—',
                },
              ]}
            />
          </div>
        </Panel>

        <Panel
          C={C}
          caption="Controllers"
          right={
            <span style={{ fontFamily: MONO, fontSize: '10.5px', textTransform: 'none', letterSpacing: 0 }}>
              {(report.components ?? []).filter(c => c.ready).length}/{(report.components ?? []).length} ready
            </span>
          }
        >
          <div style={{ padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {(report.components ?? []).length === 0 && (
              <span style={{ fontSize: '12px', color: C.textDimmer }}>
                The report lists no controller components.
              </span>
            )}
            {(report.components ?? []).map(component => (
              <div key={component.name} style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                <Dot
                  color={component.ready ? C.healthy : C.danger}
                  title={component.status ?? (component.ready ? 'ready' : 'not ready')}
                />
                <span style={{ fontSize: '12.5px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {component.name}
                </span>
                <span style={{ flex: 1 }} />
                <Mono C={C} color={C.textDimmer} title={component.image}>
                  {imageTag(component.image) ?? '—'}
                </Mono>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );

  const table = (label: string, rows: FluxRow[], total: number, emptyText: string) => (
    <section style={{ marginBottom: '26px' }}>
      <SectionHeading C={C} label={label} count={rows.length} />
      {rows.length === 0 ? (
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
          {total === 0 ? emptyText : 'No matches in this group.'}
        </div>
      ) : (
        <DataTable C={C} columns={columns} rows={rows} rowKey={r => r.key} />
      )}
    </section>
  );

  let body: React.ReactNode;
  if (loading) {
    body = <Notice C={C} title="Loading GitOps resources">Reading Flux custom resources from the cluster.</Notice>;
  } else if (notInstalled) {
    body = (
      <Notice C={C} title="Flux is not installed on this cluster">
        No <Code>source.toolkit.fluxcd.io</Code> or <Code>kustomize.toolkit.fluxcd.io</Code> resource definitions were
        found. Install Flux — or the flux-operator — and every source and applier it reconciles appears here.
      </Notice>
    );
  } else if (hardError) {
    body = (
      <Notice C={C} title="Could not load GitOps resources">
        {hardError.message || String(hardError)}
      </Notice>
    );
  } else if (all.length === 0) {
    body = (
      <Notice C={C} title="Flux is installed but reconciling nothing">
        The Flux CRDs are present and no <Code>GitRepository</Code>, <Code>OCIRepository</Code>,{' '}
        <Code>Kustomization</Code> or <Code>HelmRelease</Code> exists yet. Commit one to the cluster and its delivery
        state shows up here.
      </Notice>
    );
  } else {
    body = (
      <>
        <StatGrid
          C={C}
          stats={[
            { label: 'Sources', value: sources.length, sub: SOURCE_KINDS.length + ' kinds watched' },
            { label: 'Appliers', value: appliers.length, sub: 'Kustomization · HelmRelease' },
            {
              label: 'Ready',
              value: counts.ready,
              sub: `of ${counts.total}`,
              tone: counts.ready === counts.total ? C.healthy : undefined,
            },
            {
              label: 'Failed',
              value: counts.failed,
              sub: counts.failed ? 'needs attention' : 'none',
              tone: counts.failed ? C.danger : undefined,
            },
            {
              label: 'Reconciling',
              value: counts.reconciling,
              sub: 'in flight',
              tone: counts.reconciling ? C.gold : undefined,
            },
            {
              label: 'Suspended',
              value: counts.suspended,
              sub: counts.suspended ? 'not reconciling' : 'none',
              tone: counts.suspended ? C.gold : undefined,
            },
          ]}
        />
        {distribution}
        {table('Sources', shownSources, sources.length, 'No sources are defined on this cluster.')}
        {table('Appliers', shownAppliers, appliers.length, 'Nothing is applying a source to this cluster.')}
      </>
    );
  }

  return (
    <EvoPage
      section="GitOps"
      title="GitOps Delivery"
      summary={summary}
      actions={actions}
    >
      {body}
    </EvoPage>
  );
}

/** Re-exported so the Overview page can colour its Flux tile the same way. */
export type { ReadyState };
