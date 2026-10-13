/**
 * Compliance — how the cluster scores against the security frameworks
 * Kubescape checks it with.
 *
 * Kubescape's operator does the scanning: it checks every resource against its
 * rule library and stores the results in the cluster. This page reads those
 * results and scores them per framework (see k8s/kubescape.ts), so it shows
 * nothing until the operator is installed — and says so, rather than showing
 * zeros that look like a clean bill of health.
 *
 * PCI-DSS was asked for alongside NSA, MITRE and CIS, but Kubescape publishes
 * no PCI-DSS framework, and scoring an invented mapping of controls to PCI
 * requirements would put a compliance number on nothing anyone owns. SOC 2,
 * which Kubescape does publish, takes its place.
 */

import { useCluster } from '@kinvolk/headlamp-plugin/lib/k8s';
import React from 'react';
import {
  ControlScore,
  FrameworkScore,
  scanTotals,
  scoreAllFrameworks,
  Severity,
} from '../k8s/kubescape';
import { EvoCloudPalette } from '../palette';
import {
  Chip,
  CLIP,
  Code,
  CopyButton,
  EvoPage,
  GhostButton,
  MONO,
  Notice,
  NUMERIC,
  Pill,
  Ring,
  SectionHeading,
  StatGrid,
  usePalette,
} from '../ui/chrome';
import { cveStats, scoreColor, useScanResults } from './compliance/useScanResults';

/* ---------------------------------------------------------------- install */

const KUBESCAPE_INSTALL_DOCS = 'https://kubescape.io/docs/install-operator/';

/**
 * The two commands that install the scanner, ready to copy.
 *
 * `continuousScan` is the setting that matters: without it the operator only
 * scans on its daily schedule, so the page would stay empty for up to a day.
 * The cluster name is filled in from Headlamp's so the operator labels its
 * results with the name people know the cluster by.
 */
function InstallSteps({ C, cluster }: { C: EvoCloudPalette; cluster: string }) {
  const name = cluster || 'my-cluster';
  const steps = [
    {
      label: 'Add the Kubescape Helm repository',
      command: 'helm repo add kubescape https://kubescape.github.io/helm-charts/',
    },
    {
      label: 'Install the operator with continuous scanning',
      command:
        'helm upgrade --install kubescape kubescape/kubescape-operator -n kubescape ' +
        `--create-namespace --set clusterName=${name} --set capabilities.continuousScan=enable`,
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        margin: '16px 0 14px',
        textAlign: 'left',
      }}
    >
      {steps.map((step, i) => (
        <div key={step.label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11.5px', color: C.textDim }}>
            {i + 1}. {step.label}
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '8px 10px',
              background: C.surfaceDeep,
              border: `1px solid ${C.border}`,
              borderRadius: '8px',
            }}
          >
            <code
              style={{
                flex: 1,
                fontFamily: MONO,
                fontSize: '11.5px',
                color: C.textValue,
                wordBreak: 'break-all',
                lineHeight: 1.5,
              }}
            >
              {step.command}
            </code>
            <CopyButton C={C} value={step.command} label={step.label} what="command" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ tones */

function severityTone(C: EvoCloudPalette, severity: Severity) {
  switch (severity) {
    case 'Critical':
    case 'High':
      return { fg: C.danger, bg: `${C.danger}1f`, border: `${C.danger}55` };
    case 'Medium':
      return { fg: C.gold, bg: C.goldSoft, border: C.goldBorder };
    default:
      return { fg: C.textMuted, bg: C.chip, border: C.border };
  }
}

function ago(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
}

/* ------------------------------------------------------------------ cards */

function FrameworkCard({
  C,
  fs,
  selected,
  onSelect,
}: {
  C: EvoCloudPalette;
  fs: FrameworkScore;
  selected: boolean;
  onSelect: () => void;
}) {
  const score = Math.round(fs.score);
  const color = scoreColor(C, fs.score);
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
      title={`Show the ${fs.framework.label} controls`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        background: C.surface,
        border: `1px solid ${selected ? C.goldBorder : C.border}`,
        boxShadow: selected ? `inset 0 0 0 1px ${C.goldBorder}` : undefined,
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'border-color 140ms ease, background 140ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <Ring
          C={C}
          value={score}
          total={100}
          color={color}
          size={64}
          stroke={6}
          label={`${fs.framework.label} compliance score`}
        />
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ ...CLIP, fontSize: '15px', fontWeight: 700 }}>{fs.framework.label}</span>
          <span style={{ fontSize: '12px', color: C.textMuted, lineHeight: 1.35 }}>
            {fs.framework.description}
          </span>
        </div>
      </div>
      <div
        style={{
          ...NUMERIC,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px 12px',
          paddingTop: '10px',
          borderTop: `1px solid ${C.divider}`,
          fontSize: '12px',
          color: C.textMuted,
        }}
      >
        <span>
          <b style={{ color: fs.failingControls ? C.danger : C.healthy }}>{fs.failingControls}</b>{' '}
          failing control{fs.failingControls === 1 ? '' : 's'}
        </span>
        <span>
          <b style={{ color: C.text }}>{fs.failingResources}</b> resource
          {fs.failingResources === 1 ? '' : 's'} affected
        </span>
        <span
          style={{ gridColumn: '1 / -1', fontFamily: MONO, fontSize: '11px', color: C.textDimmer }}
          title="Controls with nothing to check on this cluster count as compliant, as in Kubescape."
        >
          {fs.evaluatedControls} of {fs.controls.length} controls evaluated here
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ table */

const COLUMNS = '92px minmax(220px, 1fr) 96px 150px 96px 28px';

function ControlRow({
  C,
  control,
  open,
  onToggle,
}: {
  C: EvoCloudPalette;
  control: ControlScore;
  open: boolean;
  onToggle: () => void;
}) {
  const tone = severityTone(C, control.severity);
  const evaluated = control.evaluated > 0;
  const color = evaluated ? scoreColor(C, control.score) : C.textDimmer;
  const expandable = control.failed > 0;

  return (
    <div style={{ borderTop: `1px solid ${C.divider}` }}>
      <div
        role={expandable ? 'button' : undefined}
        tabIndex={expandable ? 0 : undefined}
        aria-expanded={expandable ? open : undefined}
        onClick={expandable ? onToggle : undefined}
        onKeyDown={
          expandable
            ? e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggle();
                }
              }
            : undefined
        }
        className={expandable ? 'evo-row' : undefined}
        style={{
          display: 'grid',
          gridTemplateColumns: COLUMNS,
          alignItems: 'center',
          gap: '12px',
          padding: '10px 14px',
          cursor: expandable ? 'pointer' : undefined,
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: '11.5px', color: C.textMuted }}>
          {control.controlID}
        </span>
        <span style={{ ...CLIP, fontSize: '13px' }} title={control.name}>
          {control.name}
        </span>
        <Pill fg={tone.fg} bg={tone.bg} border={tone.border}>
          {control.severity}
        </Pill>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              flex: 1,
              height: '6px',
              borderRadius: '3px',
              background: C.surfaceSunken,
              overflow: 'hidden',
            }}
          >
            {evaluated && (
              <div style={{ width: `${control.score}%`, height: '100%', background: color }} />
            )}
          </div>
          <span style={{ ...NUMERIC, width: '34px', textAlign: 'right', fontSize: '12px', color }}>
            {evaluated ? `${Math.round(control.score)}%` : '—'}
          </span>
        </div>
        <span
          style={{ ...NUMERIC, fontFamily: MONO, fontSize: '11.5px', color: C.textMuted }}
          title={
            evaluated
              ? `Failed on ${control.failed} of the ${control.evaluated} resources it checked`
              : 'Nothing on this cluster for this control to check'
          }
        >
          {evaluated ? `${control.failed} / ${control.evaluated}` : 'n/a'}
        </span>
        <span style={{ color: C.textDim, fontSize: '11px', textAlign: 'center' }}>
          {expandable ? (open ? '▾' : '▸') : ''}
        </span>
      </div>

      {open && expandable && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            padding: '4px 14px 14px 118px',
            background: C.surfaceDeep,
          }}
        >
          {control.failing.map(({ resource: r, excepted }) => {
            const label = `${r.kind} ${r.namespace ? `${r.namespace}/` : ''}${r.name}`;
            return (
              <Chip
                C={C}
                key={r.key}
                title={excepted ? `${label} — failed, with a posture exception filed` : label}
              >
                {label}
                {excepted ? ' · excepted' : ''}
              </Chip>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ControlTable({ C, fs }: { C: EvoCloudPalette; fs: FrameworkScore }) {
  const [openID, setOpenID] = React.useState<string | null>(null);
  const [failingOnly, setFailingOnly] = React.useState(true);

  // Worst first: failing controls by score, then the rest by ID.
  const sorted = [...fs.controls].sort((a, b) => {
    if (a.failed > 0 !== b.failed > 0) return a.failed > 0 ? -1 : 1;
    if (a.failed > 0) return a.score - b.score;
    return a.controlID.localeCompare(b.controlID, undefined, { numeric: true });
  });
  const shown = failingOnly ? sorted.filter(c => c.failed > 0) : sorted;

  return (
    <>
      <SectionHeading
        C={C}
        label={`${fs.framework.label} controls`}
        count={shown.length}
        right={
          <GhostButton
            C={C}
            active={!failingOnly}
            onClick={() => setFailingOnly(v => !v)}
            title="Switch between failing controls and every control in the framework"
          >
            {failingOnly ? `Show all ${fs.controls.length}` : 'Failing only'}
          </GhostButton>
        }
      />
      {shown.length === 0 ? (
        <Notice C={C} title={`No ${fs.framework.label} control is failing`}>
          Every control in this framework passed on every resource it checked.
        </Notice>
      ) : (
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: '10px',
            overflow: 'hidden',
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
            <span>Control</span>
            <span>Name</span>
            <span>Severity</span>
            <span>Score</span>
            <span title="Resources failing / resources checked">Failing</span>
            <span />
          </div>
          {shown.map(control => (
            <ControlRow
              key={control.controlID}
              C={C}
              control={control}
              open={openID === control.controlID}
              onToggle={() =>
                setOpenID(id => (id === control.controlID ? null : control.controlID))
              }
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------- page */

export default function Compliance() {
  const C = usePalette();
  const cluster = useCluster() ?? '';
  const { snapshot, phase, read, error, fetching, refresh } = useScanResults(cluster);
  const [selected, setSelected] = React.useState('NSA');

  const resources = snapshot?.resources ?? [];
  const frameworks = React.useMemo(() => scoreAllFrameworks(resources), [resources]);
  const totals = React.useMemo(() => scanTotals(resources), [resources]);
  const current = frameworks.find(f => f.framework.name === selected) ?? frameworks[0];

  let summary: React.ReactNode;
  if (fetching) {
    summary =
      read > 0 ? `Reading Kubescape scans · ${read} resources so far` : 'Reading Kubescape scans';
  } else if (phase === 'not-installed') {
    summary = 'Kubescape is not installed on this cluster';
  } else if (phase === 'ready' && snapshot) {
    summary = `${totals.resources} resources scanned by Kubescape · read ${ago(snapshot.readAt)}`;
  } else {
    summary = 'Kubescape scan results';
  }

  const actions =
    !fetching && (phase === 'ready' || phase === 'error') ? (
      <GhostButton C={C} onClick={refresh} title="Read the scan results again">
        Refresh
      </GhostButton>
    ) : null;

  let body: React.ReactNode;
  if (phase === 'loading') {
    body = (
      <Notice C={C} title="Reading Kubescape scan results" busy>
        {read > 0 ? `${read} resources read so far. ` : ''}A few hundred resources take several
        seconds; the result is kept while you move around the plugin.
      </Notice>
    );
  } else if (phase === 'not-installed') {
    body = (
      <Notice C={C} title="Kubescape is not installed on this cluster">
        Compliance scores come from the Kubescape operator, which scans every resource in the
        cluster. Install it with Helm, with continuous scanning on, and the scores appear here after
        its first scan — usually within a few minutes.
        <InstallSteps C={C} cluster={cluster} />
        <a href={KUBESCAPE_INSTALL_DOCS} target="_blank" rel="noreferrer noopener">
          Kubescape installation guide ↗
        </a>
      </Notice>
    );
  } else if (phase === 'forbidden') {
    body = (
      <Notice C={C} title="Not allowed to read Kubescape's scan results">
        Your account cannot list <Code>workloadconfigurationscansummaries</Code> in this cluster.
      </Notice>
    );
  } else if (phase === 'error') {
    body = (
      <Notice C={C} title="Could not read Kubescape's scan results">
        {error}
      </Notice>
    );
  } else if (resources.length === 0) {
    body = (
      <Notice C={C} title="Kubescape has not scanned anything yet">
        The operator is installed but has stored no results. The first scan usually lands within a
        few minutes of installing it.
      </Notice>
    );
  } else {
    const failed = totals.failedChecks;
    const checks = totals.checks;
    const images = snapshot?.images ?? null;
    body = (
      <>
        {/* Three rows of four, so the tiles line up: every check by outcome,
            then what was scanned and the image vulnerabilities, then failed
            checks by severity. A check is one control tested against one
            resource — the unit KubeStellar's console counts too. */}
        <StatGrid
          C={C}
          min="230px"
          spacing="12px"
          stats={[
            {
              label: 'Total checks',
              value: checks.total,
              sub: `on ${totals.resources} resources`,
            },
            {
              label: 'Passed',
              value: checks.passed,
              sub: `of ${checks.total} checks`,
              tone: C.healthy,
              ratio: { value: checks.passed, total: checks.total, of: 'checks passed' },
            },
            {
              label: 'Failed',
              value: checks.failed,
              sub: `across ${totals.failingResources} resources`,
              tone: checks.failed ? C.danger : C.healthy,
              ratio: { value: checks.failed, total: checks.total, of: 'checks failed' },
            },
            {
              label: 'Skipped',
              value: checks.skipped,
              // Kubescape skips a control it cannot run as configured.
              sub: 'need configuration to run',
              tone: checks.skipped ? C.gold : undefined,
            },
          ]}
        />
        <StatGrid
          C={C}
          min="230px"
          spacing="12px"
          stats={[
            {
              label: 'Resources',
              value: totals.resources,
              sub: `${totals.failingResources} failing at least one check`,
              ratio: {
                value: totals.failingResources,
                total: totals.resources,
                of: 'resources failing at least one check',
              },
              tone: totals.failingResources ? C.danger : C.healthy,
            },
            {
              label: 'Images',
              value: images ? images.length : '—',
              sub: 'scanned for vulnerabilities',
            },
            // Image vulnerabilities sit beside the configuration results: the
            // same operator finds both, and they answer different questions.
            ...cveStats(C, images),
          ]}
        />
        <StatGrid
          C={C}
          min="230px"
          stats={[
            {
              label: 'Critical checks',
              value: failed.Critical,
              sub: 'failed',
              tone: failed.Critical ? C.danger : undefined,
            },
            {
              label: 'High checks',
              value: failed.High,
              sub: 'failed',
              tone: failed.High ? C.danger : undefined,
            },
            {
              label: 'Medium checks',
              value: failed.Medium,
              sub: 'failed',
              tone: failed.Medium ? C.gold : undefined,
            },
            { label: 'Low checks', value: failed.Low, sub: 'failed' },
          ]}
        />

        <SectionHeading C={C} label="Frameworks" count={frameworks.length} />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '12px',
            marginBottom: '26px',
          }}
        >
          {frameworks.map(fs => (
            <FrameworkCard
              key={fs.framework.name}
              C={C}
              fs={fs}
              selected={fs.framework.name === current?.framework.name}
              onSelect={() => setSelected(fs.framework.name)}
            />
          ))}
        </div>

        {current && <ControlTable key={current.framework.name} C={C} fs={current} />}
      </>
    );
  }

  return (
    <EvoPage section="Compliance" title="Compliance" summary={summary} actions={actions}>
      {body}
    </EvoPage>
  );
}
