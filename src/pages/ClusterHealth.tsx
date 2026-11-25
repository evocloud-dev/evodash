/**
 * Cluster Health — KubeBuddy's checks for everyday cluster hygiene, run in the
 * browser against what Headlamp already watches.
 *
 * The third Compliance page, and the one that needs nothing installed:
 * Security Benchmark reads Kubescape's operator and Kyverno Policies reads
 * Kyverno's reports, while these checks (k8s/clusterHealth, ported from
 * KubeBuddy under its MIT licence) run here on the resource lists. Their reach
 * is wider than security: services with no endpoints, unused config, missing
 * probes and limits, single replicas, PodDisruptionBudgets that block drains.
 *
 * Platform namespaces are left out by default, as KubeBuddy does, so the
 * score is about the workloads rather than the control plane.
 */
import { useCluster } from '@kinvolk/headlamp-plugin/lib/k8s';
import React from 'react';
import { CheckResult } from '../k8s/clusterHealth/engine';
import { EvoCloudPalette } from '../palette';
import {
  CLIP,
  EvoPage,
  FilterSelect,
  GhostButton,
  MONO,
  Notice,
  NUMERIC,
  openOnClick,
  Pill,
  Ring,
  SearchBox,
  SectionHeading,
  SidePanel,
  SortHeader,
  StatGrid,
  usePalette,
  useSidePanelViable,
} from '../ui/chrome';
import { SortState } from '../ui/listModel';
import { ListToolbar, useListView } from '../ui/listView';
import { REVEAL_MARGIN, useRevealSection } from '../ui/reveal';
import { HealthCheckCard } from './compliance/HealthCheckCard';
import {
  HealthCheckDetail,
  HealthFindings,
  healthTone,
  StatusPill,
} from './compliance/HealthCheckDetail';
import {
  affectedResources,
  checkSeverity,
  CheckStatus,
  DEFAULT_HEALTH_SORT,
  HEALTH_EXPORT_FIELDS,
  HEALTH_GROUP_FIELDS,
  HEALTH_SEVERITY_ORDER,
  HEALTH_SORT_FIELDS,
  HEALTH_STATUS_LABEL,
  HealthSeverity,
  matchesCheck,
  scoreSections,
  SectionScore,
} from './compliance/healthFields';
import { useClusterHealth } from './compliance/useClusterHealth';
import { scoreColor } from './compliance/useScanResults';

const KUBEBUDDY_URL = 'https://github.com/KubeDeckio/KubeBuddy';

function ago(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/* --------------------------------------------------------------- sections */

function SectionCard({
  C,
  s,
  selected,
  onSelect,
}: {
  C: EvoCloudPalette;
  s: SectionScore;
  selected: boolean;
  onSelect: () => void;
}) {
  const color = scoreColor(C, s.score.value);
  return (
    <div
      className="evo-card"
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      title={selected ? 'Show every section' : `Show only the ${s.section} checks`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 14px',
        background: C.surface,
        border: `1px solid ${selected ? C.goldBorder : C.border}`,
        boxShadow: selected ? `inset 0 0 0 1px ${C.goldBorder}` : undefined,
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'border-color 140ms ease, background 140ms ease',
      }}
    >
      <Ring
        C={C}
        value={s.score.value}
        total={100}
        color={color}
        size={48}
        stroke={5}
        label={`${s.section} health score`}
      />
      <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ ...CLIP, fontSize: '14px', fontWeight: 700 }}>{s.section}</span>
        <span style={{ ...NUMERIC, fontSize: '12px', color: C.textMuted }}>
          <b style={{ color: s.score.failed ? C.danger : C.healthy }}>{s.score.failed}</b> of{' '}
          {s.score.total} checks failing
        </span>
        {s.failingBySeverity.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {s.failingBySeverity.map(({ severity, count }) => {
              const tone = healthTone(C, severity);
              return (
                <Pill key={severity} fg={tone.fg} bg={tone.bg} border={tone.border}>
                  {count} {severity.toLowerCase()}
                </Pill>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ table */

const COLUMNS = '84px minmax(220px, 1fr) 170px 92px 120px 28px';

function HealthRow({
  C,
  check,
  open,
  onToggle,
  onOpen,
}: {
  C: EvoCloudPalette;
  check: CheckResult;
  open: boolean;
  onToggle: () => void;
  onOpen?: () => void;
}) {
  const severity = checkSeverity(check);
  const tone = healthTone(C, severity);
  const expandable = check.findings.length > 0 && !onOpen;
  const toggleProps = expandable
    ? {
        role: 'button' as const,
        tabIndex: 0,
        'aria-expanded': open,
        onClick: onToggle,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        },
      }
    : {};
  const resources = affectedResources(check);

  return (
    <div style={{ borderTop: `1px solid ${C.divider}` }}>
      <div
        {...(onOpen ? openOnClick(onOpen, `${check.id} ${check.name}`) : toggleProps)}
        className={onOpen || expandable ? 'evo-row' : undefined}
        style={{
          display: 'grid',
          gridTemplateColumns: COLUMNS,
          alignItems: 'center',
          gap: '12px',
          padding: '10px 14px',
          cursor: onOpen || expandable ? 'pointer' : undefined,
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: '11.5px', color: C.textMuted }}>{check.id}</span>
        <span style={{ ...CLIP, fontSize: '13px' }} title={check.name}>
          {check.name}
        </span>
        <span style={{ ...CLIP, fontSize: '12px', color: C.textMuted }} title={check.section}>
          {check.section}
        </span>
        <span>
          <Pill fg={tone.fg} bg={tone.bg} border={tone.border}>
            {severity}
          </Pill>
        </span>
        <span
          title={
            check.status === 'failed'
              ? `${plural(check.findings.length, 'finding')} on ${plural(resources, 'resource')}`
              : check.skippedReason
          }
        >
          <StatusPill C={C} check={check} />
        </span>
        <span style={{ color: C.textDim, fontSize: '11px', textAlign: 'center' }}>
          {expandable ? (open ? '▾' : '▸') : ''}
        </span>
      </div>
      {open && expandable && (
        <div style={{ padding: '6px 14px 14px 110px', background: C.surfaceDeep }}>
          <HealthFindings C={C} check={check} />
        </div>
      )}
    </div>
  );
}

function HealthGrid({
  C,
  checks,
  sort,
  onSort,
  onOpen,
}: {
  C: EvoCloudPalette;
  checks: CheckResult[];
  sort: SortState;
  onSort: (key: string) => void;
  onOpen?: (check: CheckResult) => void;
}) {
  const [openID, setOpenID] = React.useState<string | null>(null);
  const head = (key: string, label: string, title?: string) => (
    <SortHeader
      C={C}
      label={label}
      title={title}
      active={sort.key === key}
      dir={sort.dir}
      onClick={() => onSort(key)}
    />
  );
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: '10px',
        overflow: 'hidden',
        overflowX: 'auto',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: COLUMNS,
          gap: '12px',
          padding: '9px 14px',
          background: C.surfaceSunken,
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.11em',
          textTransform: 'uppercase',
          color: C.textFaint,
        }}
      >
        {head('id', 'Check')}
        {head('name', 'Name')}
        {head('section', 'Section')}
        {head('severity', 'Severity')}
        {head('findings', 'Findings')}
        <span />
      </div>
      {checks.map(check => (
        <HealthRow
          key={check.id}
          C={C}
          check={check}
          open={openID === check.id}
          onToggle={() => setOpenID(id => (id === check.id ? null : check.id))}
          onOpen={onOpen ? () => onOpen(check) : undefined}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- list */

function HealthList({
  C,
  checks,
  section,
  setSection,
  onOpen,
}: {
  C: EvoCloudPalette;
  checks: CheckResult[];
  section: string;
  setSection: (s: string) => void;
  onOpen?: (check: CheckResult) => void;
}) {
  const anyFailing = checks.some(c => c.status === 'failed');
  const [q, setQ] = React.useState('');
  // Failing only by default, unless nothing fails: then an empty list would
  // say less than the full one.
  const [status, setStatus] = React.useState<'all' | CheckStatus>(anyFailing ? 'failed' : 'all');
  const [severity, setSeverity] = React.useState<'all' | HealthSeverity>('all');
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [closed, setClosed] = React.useState<Record<string, boolean>>({});

  const shown = React.useMemo(
    () => checks.filter(c => matchesCheck(c, { query: q, status, severity, section })),
    [checks, q, status, severity, section]
  );
  const list = useListView({
    id: 'cluster-health',
    rows: shown,
    sortFields: HEALTH_SORT_FIELDS,
    groupFields: HEALTH_GROUP_FIELDS,
    defaultSort: DEFAULT_HEALTH_SORT,
    defaultView: 'list',
  });

  const filtering = !!q.trim() || status !== 'all' || severity !== 'all' || section !== 'all';
  const clearFilters = () => {
    setQ('');
    setStatus('all');
    setSeverity('all');
    setSection('all');
  };

  const countBy = (pick: (c: CheckResult) => boolean) => checks.filter(pick).length;
  const sections = [...new Set(checks.map(c => c.section))].sort();
  const statusOptions = [
    { value: 'all', label: `Any status (${checks.length})` },
    ...(['failed', 'passed', 'skipped'] as CheckStatus[])
      .filter(s => s !== 'skipped' || checks.some(c => c.status === 'skipped'))
      .map(value => ({
        value,
        label: `${HEALTH_STATUS_LABEL[value]} (${countBy(c => c.status === value)})`,
      })),
  ];
  const severityOptions = [
    { value: 'all', label: 'Any severity' },
    ...HEALTH_SEVERITY_ORDER.filter(sev => checks.some(c => checkSeverity(c) === sev)).map(sev => ({
      value: sev,
      label: `${sev} (${countBy(c => checkSeverity(c) === sev)})`,
    })),
  ];
  const sectionOptions = [
    { value: 'all', label: 'Any section' },
    ...sections.map(s => ({ value: s, label: `${s} (${countBy(c => c.section === s)})` })),
  ];
  const onlyStatusFilter = status === 'failed' && !q.trim() && severity === 'all';

  return (
    <>
      <SectionHeading C={C} label="Checks" count={shown.length} />
      <ListToolbar
        C={C}
        list={list}
        shown={shown.length}
        total={checks.length}
        noun="checks"
        onClearFilters={filtering ? clearFilters : undefined}
        sortFields={HEALTH_SORT_FIELDS}
        groupFields={HEALTH_GROUP_FIELDS}
        exportFields={HEALTH_EXPORT_FIELDS}
        exportName="Cluster health checks"
        filters={
          <>
            <SearchBox C={C} value={q} onChange={setQ} placeholder="Filter checks" width="180px" />
            <FilterSelect
              C={C}
              value={status}
              onChange={v => setStatus(v as 'all' | CheckStatus)}
              options={statusOptions}
              label="Filter checks by status"
            />
            <FilterSelect
              C={C}
              value={severity}
              onChange={v => setSeverity(v as 'all' | HealthSeverity)}
              options={severityOptions}
              label="Filter checks by severity"
            />
            <FilterSelect
              C={C}
              value={section}
              onChange={setSection}
              options={sectionOptions}
              label="Filter checks by section"
            />
          </>
        }
      />
      {shown.length === 0 ? (
        onlyStatusFilter ? (
          <Notice
            C={C}
            title={section === 'all' ? 'No check is failing' : `No ${section} check is failing`}
          >
            Every check passed on every resource it looked at.
          </Notice>
        ) : (
          <Notice C={C} title="No checks match the current filters" />
        )
      ) : (
        list.groups.map(group => {
          const open = !closed[group.name];
          return (
            <section key={group.name} style={{ marginBottom: list.grouped ? '22px' : 0 }}>
              {list.grouped && (
                <SectionHeading
                  C={C}
                  label={group.name}
                  count={group.rows.length}
                  open={open}
                  onToggle={() => setClosed(st => ({ ...st, [group.name]: !st[group.name] }))}
                />
              )}
              {open &&
                (list.view === 'grid' ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                      gap: '12px',
                      alignItems: 'start',
                    }}
                  >
                    {group.rows.map(check => (
                      <HealthCheckCard
                        key={check.id}
                        C={C}
                        check={check}
                        expanded={!!expanded[check.id]}
                        onToggle={() => setExpanded(st => ({ ...st, [check.id]: !st[check.id] }))}
                        onOpen={onOpen ? () => onOpen(check) : undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <HealthGrid
                    C={C}
                    checks={group.rows}
                    sort={list.sort}
                    onSort={list.sortBy}
                    onOpen={onOpen}
                  />
                ))}
            </section>
          );
        })
      )}
    </>
  );
}

/* ------------------------------------------------------------------- page */

export default function ClusterHealth() {
  const C = usePalette();
  const cluster = useCluster() ?? '';
  const { scan, scanning, progress, includeSystem, setIncludeSystem, rescan } =
    useClusterHealth(cluster);
  const [section, setSection] = React.useState('all');
  const [selectedID, setSelectedID] = React.useState<string | null>(null);
  const panelViable = useSidePanelViable();
  const closePanel = React.useCallback(() => setSelectedID(null), []);
  // Picking a section swaps the checks list below the cards: bring it into view.
  const [checksRef, revealChecks] = useRevealSection();

  const checks = scan?.checks ?? [];
  const sections = React.useMemo(() => scoreSections(checks), [checks]);
  const selected = (selectedID && checks.find(c => c.id === selectedID)) || null;

  let summary: React.ReactNode;
  if (!scan) {
    summary = `Reading the cluster · ${progress.loaded} of ${progress.total} lists`;
  } else {
    summary = [
      `${scan.checks.length} checks on ${scan.resources} resources`,
      scan.includeSystem
        ? 'all namespaces'
        : `${scan.excluded.length} platform namespaces left out`,
      scanning ? 'scanning' : `scanned ${ago(scan.at)}`,
    ].join(' · ');
  }

  const actions = scan ? (
    <>
      <GhostButton
        C={C}
        onClick={() => setIncludeSystem(!includeSystem)}
        active={includeSystem}
        title={
          includeSystem
            ? 'Leave platform namespaces (kube-*, *-system and the like) out of the scan'
            : `Scan platform namespaces too: ${scan.excluded.join(', ') || 'none here'}`
        }
      >
        {includeSystem ? 'Including platform namespaces' : 'Include platform namespaces'}
      </GhostButton>
      <GhostButton C={C} onClick={rescan} title="Run every check again on the cluster as it is now">
        {scanning ? 'Scanning…' : 'Rescan'}
      </GhostButton>
    </>
  ) : null;

  let body: React.ReactNode;
  if (!scan) {
    body = (
      <Notice C={C} title="Reading the cluster" busy>
        {progress.loaded} of {progress.total} resource lists loaded. The checks run in this browser
        on what Headlamp reads, so nothing is installed in the cluster. The result is kept while you
        move around the plugin.
      </Notice>
    );
  } else {
    const { score } = scan;
    const failing = checks.filter(c => c.status === 'failed');
    const findings = failing.reduce((n, c) => n + c.findings.length, 0);
    const affected = new Set(
      failing.flatMap(c =>
        c.findings.map(f => f.uid || `${f.kind ?? ''}/${f.namespace ?? ''}/${f.resource}`)
      )
    ).size;
    const bySeverity = (sev: HealthSeverity) =>
      failing.filter(c => checkSeverity(c) === sev).length;

    body = (
      <>
        {scan.unreadable.length > 0 && (
          <Notice C={C} title={`${plural(scan.unreadable.length, 'list')} could not be read`}>
            The checks that read them saw nothing there, so they may pass when they should not:{' '}
            {scan.unreadable.map(u => `${u.label} (${u.reason})`).join(', ')}.
          </Notice>
        )}
        <StatGrid
          C={C}
          min="230px"
          spacing="12px"
          stats={[
            {
              label: 'Health score',
              value: score.value,
              sub: 'out of 100',
              tone: scoreColor(C, score.value),
              ratio: { value: score.value, total: 100, of: 'health score' },
            },
            {
              label: 'Checks run',
              value: score.total,
              sub: score.skipped ? `${score.skipped} skipped` : 'every check in the catalog',
            },
            {
              label: 'Failing checks',
              value: score.failed,
              sub: `of ${score.total}`,
              tone: score.failed ? C.danger : C.healthy,
              ratio: { value: score.failed, total: score.total, of: 'checks failing' },
            },
            {
              label: 'Findings',
              value: findings,
              sub: `on ${plural(affected, 'resource')}`,
              tone: findings ? C.danger : C.healthy,
            },
          ]}
        />
        <StatGrid
          C={C}
          min="170px"
          stats={HEALTH_SEVERITY_ORDER.map(sev => {
            const n = bySeverity(sev);
            const tone = healthTone(C, sev);
            return {
              label: `${sev} checks`,
              value: n,
              sub: 'failing',
              tone: n && sev !== 'Low' ? tone.fg : undefined,
            };
          })}
        />

        <SectionHeading C={C} label="Sections" count={sections.length} />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '12px',
            marginBottom: '26px',
          }}
        >
          {sections.map(s => (
            <SectionCard
              key={s.section}
              C={C}
              s={s}
              selected={section === s.section}
              onSelect={() => {
                setSection(section === s.section ? 'all' : s.section);
                revealChecks();
              }}
            />
          ))}
        </div>

        <div ref={checksRef} style={REVEAL_MARGIN}>
          <HealthList
            // A new scan starts the filters afresh: what failed may have changed.
            key={scan.at}
            C={C}
            checks={checks}
            section={section}
            setSection={setSection}
            onOpen={panelViable ? check => setSelectedID(check.id) : undefined}
          />
        </div>

        <p style={{ margin: '22px 0 0', fontSize: '11.5px', color: C.textDimmer }}>
          Checks from{' '}
          <a
            href={KUBEBUDDY_URL}
            target="_blank"
            rel="noreferrer noopener"
            style={{ color: C.link }}
          >
            KubeBuddy
          </a>{' '}
          v0.0.38, MIT licence. Ran in {scan.durationMs} ms in this browser.
        </p>
      </>
    );
  }

  return (
    <EvoPage section="Compliance" title="Cluster Health" summary={summary} actions={actions}>
      {body}
      <SidePanel
        C={C}
        open={!!selected}
        title={selected?.name ?? ''}
        subtitle={selected && `${selected.id} · ${selected.section}`}
        onClose={closePanel}
      >
        {selected && (
          <div style={{ padding: '16px' }}>
            <HealthCheckDetail C={C} check={selected} />
          </div>
        )}
      </SidePanel>
    </EvoPage>
  );
}
