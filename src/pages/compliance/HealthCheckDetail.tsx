/**
 * One Cluster Health check in the side panel: what it checks, what it found,
 * how to fix it, and every resource it named.
 *
 * Everything comes from the scan already run for the page, so opening a check
 * makes no request of its own.
 */
import React from 'react';
import { CheckResult, Finding } from '../../k8s/clusterHealth/engine';
import { isSystemNamespace } from '../../k8s/namespaces';
import { EvoCloudPalette } from '../../palette';
import { Chip, Code, KeyValues, MONO, Pill } from '../../ui/chrome';
import { affectedResources, checkSeverity, findingKey, findingLabel, HealthSeverity } from './healthFields';
import { Caption, ResourceChip, SystemMark } from './shared';

const CLUSTER_SCOPED = 'Cluster-scoped';
/** Findings drawn per check before the rest are summed up in a line. */
const FINDING_LIMIT = 150;

export const IGNORE_ANNOTATION = 'kubebuddy.io/ignore-checks';

export function healthTone(C: EvoCloudPalette, severity: HealthSeverity) {
  switch (severity) {
    case 'Critical':
    case 'High':
      return { fg: C.danger, bg: `${C.danger}1f`, border: `${C.danger}55` };
    case 'Warning':
    case 'Medium':
      return { fg: C.gold, bg: C.goldSoft, border: C.goldBorder };
    default:
      return { fg: C.textMuted, bg: C.chip, border: C.border };
  }
}

/** The check's outcome as a pill: failing in red, passing in green, skipped muted. */
export function StatusPill({ C, check }: { C: EvoCloudPalette; check: CheckResult }) {
  if (check.status === 'failed') {
    return (
      <Pill fg={C.danger} bg={C.chip} border={C.border}>
        {check.findings.length} finding{check.findings.length === 1 ? '' : 's'}
      </Pill>
    );
  }
  if (check.status === 'passed') {
    return (
      <Pill fg={C.healthy} bg={C.chip} border={C.border}>
        passing
      </Pill>
    );
  }
  return (
    <Pill fg={C.textDimmer} bg={C.chip} border={C.border} title={check.skippedReason}>
      skipped
    </Pill>
  );
}

function Section({
  C,
  title,
  children,
}: {
  C: EvoCloudPalette;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <Caption C={C}>{title}</Caption>
      {children}
    </section>
  );
}

/** Text from the catalog, with its `backticked` commands shown as code. */
function Prose({ C, text }: { C: EvoCloudPalette; text: string }) {
  const parts = text.split(/`([^`]+)`/);
  return (
    <p
      style={{
        margin: 0,
        fontSize: '12.5px',
        lineHeight: 1.6,
        color: C.textMuted,
        whiteSpace: 'pre-wrap',
      }}
    >
      {parts.map((part, i) => (i % 2 ? <Code key={i}>{part}</Code> : part))}
    </p>
  );
}

function byNamespace<F extends Finding>(findings: F[]): [string, F[]][] {
  const groups = new Map<string, F[]>();
  for (const f of findings) {
    const ns = f.namespace || CLUSTER_SCOPED;
    groups.set(ns, [...(groups.get(ns) ?? []), f]);
  }
  const rank = (ns: string) => (ns === CLUSTER_SCOPED ? 2 : isSystemNamespace(ns) ? 1 : 0);
  return [...groups].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
}

/** One finding: the resource, linked where Headlamp has a page, and what is wrong. */
function FindingRow({
  C,
  finding,
  note,
}: {
  C: EvoCloudPalette;
  finding: Finding;
  note?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '7px 9px',
        background: C.surfaceDeep,
        border: `1px solid ${C.dividerSoft}`,
        borderRadius: '6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
        {finding.kind ? (
          <ResourceChip
            C={C}
            resource={{
              kind: finding.kind,
              name: finding.resource,
              namespace: finding.namespace ?? null,
            }}
          />
        ) : (
          <span style={{ fontFamily: MONO, fontSize: '10.5px', color: C.textMuted }}>
            {findingLabel(finding)}
          </span>
        )}
        {note && (
          <Pill fg={C.gold} bg={C.goldSoft} border={C.goldBorder}>
            {note}
          </Pill>
        )}
      </div>
      {finding.details && (
        <span style={{ fontSize: '12px', lineHeight: 1.5, color: C.textMuted, wordBreak: 'break-word' }}>
          {finding.details}
        </span>
      )}
      {finding.yamlSnippet && (
        <pre
          style={{
            margin: 0,
            padding: '6px 8px',
            fontFamily: MONO,
            fontSize: '11px',
            lineHeight: 1.45,
            color: C.textDim,
            background: C.surfaceSunken,
            borderRadius: '4px',
            overflowX: 'auto',
          }}
        >
          {finding.yamlSnippet}
        </pre>
      )}
    </div>
  );
}

/**
 * The findings of a check by namespace, workload namespaces first. Also used
 * inline, where a window is too narrow for the side panel.
 */
export function HealthFindings({ C, check }: { C: EvoCloudPalette; check: CheckResult }) {
  const shown = check.findings.slice(0, FINDING_LIMIT);
  const groups = byNamespace(shown);
  const rest = check.findings.length - shown.length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {groups.map(([ns, items]) => (
        <div key={ns} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontFamily: MONO, fontSize: '11.5px', color: C.textMuted }}>{ns}</span>
            {ns !== CLUSTER_SCOPED && isSystemNamespace(ns) && <SystemMark C={C} />}
            <span style={{ fontSize: '11px', color: C.textDimmer }}>{items.length}</span>
          </div>
          {items.map((f, i) => (
            <FindingRow key={`${findingKey(f)}-${i}`} C={C} finding={f} />
          ))}
        </div>
      ))}
      {rest > 0 && (
        <span style={{ fontSize: '12px', color: C.textDimmer }}>
          and {rest} more. Export the list for all of them.
        </span>
      )}
    </div>
  );
}

export function HealthCheckDetail({ C, check }: { C: EvoCloudPalette; check: CheckResult }) {
  const severity = checkSeverity(check);
  const tone = healthTone(C, severity);
  const suppressed = check.suppressedFindings ?? [];
  const resources = affectedResources(check);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
        <Pill fg={tone.fg} bg={tone.bg} border={tone.border}>
          {severity}
        </Pill>
        <StatusPill C={C} check={check} />
        <Chip C={C}>{check.section}</Chip>
        {check.category && check.category !== check.section && (
          <Chip C={C}>{check.category}</Chip>
        )}
      </div>

      <KeyValues
        C={C}
        rows={[
          { k: 'check', v: check.id },
          { k: 'checks', v: check.resourceKind },
          ...(check.status === 'skipped'
            ? [{ k: 'skipped', v: check.skippedReason ?? 'not run' }]
            : [
                {
                  k: 'findings',
                  v: check.findings.length
                    ? `${check.findings.length} on ${resources} resource${resources === 1 ? '' : 's'}`
                    : 'none',
                  color: check.findings.length ? C.danger : C.healthy,
                },
              ]),
          ...(suppressed.length
            ? [{ k: 'ignored', v: `${suppressed.length} by annotation` }]
            : []),
          { k: 'weight', v: `${check.weight} in the health score` },
        ]}
      />

      <Section C={C} title="What it checks">
        <Prose C={C} text={check.description} />
      </Section>

      {check.status === 'failed' && (
        <Section C={C} title="What's wrong">
          <Prose C={C} text={check.failMessage} />
        </Section>
      )}

      <Section C={C} title="How to fix it">
        <Prose C={C} text={check.recommendation} />
      </Section>

      {check.status !== 'skipped' && (
        <Section C={C} title={`Findings (${check.findings.length})`}>
          {check.findings.length === 0 ? (
            <Prose C={C} text="Nothing in the scanned namespaces fails this check." />
          ) : (
            <HealthFindings C={C} check={check} />
          )}
        </Section>
      )}

      {suppressed.length > 0 && (
        <Section C={C} title={`Ignored (${suppressed.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {suppressed.map((f, i) => (
              <FindingRow
                key={`${findingKey(f)}-${i}`}
                C={C}
                finding={{
                  ...f,
                  details: [f.suppressionReason, f.suppressionUntil && `until ${f.suppressionUntil}`]
                    .filter(Boolean)
                    .join(' · '),
                }}
                note="ignored"
              />
            ))}
          </div>
        </Section>
      )}

      <Section C={C} title="Ignoring a finding">
        <span style={{ fontSize: '12.5px', lineHeight: 1.6, color: C.textMuted }}>
          Annotate the resource with <Code>{`${IGNORE_ANNOTATION}: ${check.id}`}</Code>. Add{' '}
          <Code>kubebuddy.io/ignore-reason</Code> to say why, and{' '}
          <Code>kubebuddy.io/ignore-until</Code> with a date for it to lapse.
        </span>
      </Section>

      {check.docs && (
        <Section C={C} title="Reference">
          <a
            href={check.docs}
            target="_blank"
            rel="noreferrer noopener"
            style={{ fontSize: '12px', color: C.link, wordBreak: 'break-all' }}
          >
            {check.docs}
          </a>
        </Section>
      )}
    </div>
  );
}
