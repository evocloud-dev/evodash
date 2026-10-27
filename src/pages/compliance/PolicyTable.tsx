/**
 * The Kyverno policies, each scored by the resources its reports cover.
 *
 * Built like the Frameworks page's control table on purpose: a policy here
 * plays the part a control plays there — a score, the resources failing it,
 * and the reason — so the two Compliance pages read the same way.
 *
 * The heading and its controls belong to the page, which switches between
 * this table and the by-resource one under a single heading.
 */

import React from 'react';
import { FailureAction, PolicyScore, readyToEnforce, SEVERITY_RANK } from '../../k8s/kyverno';
import { isSystemNamespace } from '../../k8s/namespaces';
import { EvoCloudPalette } from '../../palette';
import { Chip, CLIP, Code, MONO, Notice, NUMERIC, Pill } from '../../ui/chrome';
import { Caption, ResourceChip, severityTone } from './shared';
import { scoreColor } from './useScanResults';

/** Enforcing is the strong claim, so only that gets the healthy colour. */
function actionTone(C: EvoCloudPalette, action: FailureAction) {
  switch (action) {
    case 'Enforce':
      return { fg: C.healthy, bg: C.healthySoft, border: C.healthyBorder };
    case 'Audit':
      return { fg: C.gold, bg: C.goldSoft, border: C.goldBorder };
    case 'Mixed':
      return { fg: C.brand, bg: C.brandSoft, border: C.brandBorder };
    default:
      return { fg: C.textDimmer, bg: C.chip, border: C.border };
  }
}

function actionTitle(action: FailureAction): string {
  switch (action) {
    case 'Enforce':
      return 'Violations are blocked at admission.';
    case 'Audit':
      return 'Violations are recorded in reports but allowed.';
    case 'Mixed':
      return 'Some rules in this policy block violations, others only record them.';
    default:
      return 'No failure action is set on the policy or its rules.';
  }
}

/**
 * Where the switch to Enforce is made, which depends on what owns the policy.
 * A chart-installed policy edited in place would be put back on the next
 * upgrade, so for those the answer is the chart's own setting.
 */
function enforceHow(p: PolicyScore): React.ReactNode {
  if (p.kind === 'ValidatingPolicy') {
    return (
      <>
        Add <Code>Deny</Code> to its <Code>spec.validationActions</Code>.
      </>
    );
  }
  if (p.chart.startsWith('kyverno-policies-')) {
    return (
      <>
        It comes from the kyverno-policies chart, so set{' '}
        <Code>validationFailureActionByPolicy.{p.name}: Enforce</Code> in that release&apos;s values
        — for EvoCloud, in the kubeapp-kyverno_policies role.
      </>
    );
  }
  return (
    <>
      Set <Code>failureAction: Enforce</Code> in each rule&apos;s <Code>validate</Code> block.
    </>
  );
}

/* ------------------------------------------------------------------ table */

const COLUMNS = '92px minmax(220px, 1fr) 96px 150px 96px 28px';

function Callout({
  C,
  tone,
  children,
}: {
  C: EvoCloudPalette;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        maxWidth: '86ch',
        padding: '8px 10px',
        borderLeft: `2px solid ${tone}`,
        background: C.surface,
        borderRadius: '0 6px 6px 0',
        fontSize: '12.5px',
        color: C.textMuted,
        lineHeight: 1.55,
      }}
    >
      {children}
    </div>
  );
}

function PolicyRow({
  C,
  policy,
  open,
  onToggle,
}: {
  C: EvoCloudPalette;
  policy: PolicyScore;
  open: boolean;
  onToggle: () => void;
}) {
  const severity = severityTone(C, policy.meta.severity);
  const action = actionTone(C, policy.action);
  const evaluated = policy.evaluated > 0;
  const color = evaluated ? scoreColor(C, policy.score) : C.textDimmer;
  const notReady = policy.ready?.state === 'failed';
  const ready = readyToEnforce(policy);
  const systemOnly =
    policy.failed > 0 && policy.failing.every(f => isSystemNamespace(f.resource.namespace));
  const { pass, fail, warn, error, skip } = policy.checks;

  // Workloads first, as in the by-resource view.
  const failing = [...policy.failing].sort(
    (a, b) =>
      Number(isSystemNamespace(a.resource.namespace)) -
      Number(isSystemNamespace(b.resource.namespace))
  );

  return (
    <div style={{ borderTop: `1px solid ${C.divider}` }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        className="evo-row"
        style={{
          display: 'grid',
          gridTemplateColumns: COLUMNS,
          alignItems: 'center',
          gap: '12px',
          padding: '10px 14px',
          cursor: 'pointer',
        }}
      >
        {policy.kind ? (
          <Pill {...action} title={actionTitle(policy.action)}>
            {policy.action}
          </Pill>
        ) : (
          <Pill
            fg={C.textDimmer}
            bg={C.chip}
            border={C.border}
            title="Reported, but no Kyverno policy of this name exists in the cluster."
          >
            Reported
          </Pill>
        )}
        <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ ...CLIP, fontSize: '13px' }} title={policy.meta.title}>
              {policy.meta.title}
            </span>
            {notReady && (
              <Pill
                fg={C.danger}
                bg={`${C.danger}1f`}
                border={`${C.danger}55`}
                title={policy.ready?.message ?? 'Kyverno is not applying this policy.'}
              >
                Not ready
              </Pill>
            )}
            {ready && (
              <Pill
                fg={C.healthy}
                bg={C.healthySoft}
                border={C.healthyBorder}
                title="Nothing running today fails it, so enforcing it would block nothing already here."
              >
                Ready to enforce
              </Pill>
            )}
          </span>
          {policy.meta.title !== policy.ref && (
            <span style={{ ...CLIP, fontFamily: MONO, fontSize: '11px', color: C.textDimmer }}>
              {policy.ref}
            </span>
          )}
        </span>
        <Pill fg={severity.fg} bg={severity.bg} border={severity.border}>
          {policy.meta.severity}
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
              <div style={{ width: `${policy.score}%`, height: '100%', background: color }} />
            )}
          </div>
          <span style={{ ...NUMERIC, width: '34px', textAlign: 'right', fontSize: '12px', color }}>
            {evaluated ? `${Math.round(policy.score)}%` : '—'}
          </span>
        </div>
        <span
          style={{ ...NUMERIC, fontFamily: MONO, fontSize: '11.5px', color: C.textMuted }}
          title={
            evaluated
              ? `Failed on ${policy.failed} of the ${policy.evaluated} resources it checked` +
                (systemOnly ? ', all of them in system namespaces' : '')
              : 'Not reported on any resource yet'
          }
        >
          {evaluated ? `${policy.failed} / ${policy.evaluated}` : 'n/a'}
        </span>
        <span style={{ color: C.textDim, fontSize: '11px', textAlign: 'center' }}>
          {open ? '▾' : '▸'}
        </span>
      </div>

      {open && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            padding: '4px 14px 14px 118px',
            background: C.surfaceDeep,
          }}
        >
          {policy.meta.description && (
            <div
              style={{ fontSize: '12.5px', color: C.textMuted, lineHeight: 1.55, maxWidth: '86ch' }}
            >
              {policy.meta.description}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <Chip C={C}>
              {policy.kind ?? (policy.source || 'unknown source')}
              {policy.namespace ? ` · ${policy.namespace}` : ''}
            </Chip>
            {policy.meta.category && <Chip C={C}>{policy.meta.category}</Chip>}
            {policy.kind && (
              <Chip C={C}>
                {policy.rules} rule{policy.rules === 1 ? '' : 's'}
              </Chip>
            )}
            {policy.ready && (
              <Chip C={C} title={policy.ready.message ?? policy.ready.label}>
                {policy.ready.label}
              </Chip>
            )}
            <Chip C={C} title="Rule results across every resource, as Kyverno counts them">
              {pass} pass · {fail} fail
              {warn ? ` · ${warn} warn` : ''}
              {error ? ` · ${error} error` : ''}
              {skip ? ` · ${skip} skip` : ''}
            </Chip>
            {policy.exceptions.length > 0 && (
              <Chip C={C} title={policy.exceptions.join('\n')}>
                {policy.exceptions.length} exception{policy.exceptions.length === 1 ? '' : 's'}
              </Chip>
            )}
          </div>

          {ready && (
            <Callout C={C} tone={C.healthy}>
              Nothing running today fails this policy, so enforcing it would block nothing already
              here — only new resources that break it. {enforceHow(policy)}
            </Callout>
          )}
          {systemOnly && policy.action !== 'Enforce' && (
            <Callout C={C} tone={C.gold}>
              Every resource failing it is in a system namespace. Record a{' '}
              <Code>PolicyException</Code> for them before enforcing it, so exempting them is a
              decision written down rather than one implied.
            </Callout>
          )}

          {failing.length > 0 && (
            <>
              <Caption C={C}>Failing resources</Caption>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {failing.map(({ resource, messages }) => (
                  <ResourceChip
                    key={resource.key}
                    C={C}
                    resource={resource}
                    title={messages.join('\n\n')}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Worst first: failing policies by score, then by severity and title. */
export function sortPolicies(policies: PolicyScore[]): PolicyScore[] {
  return [...policies].sort((a, b) => {
    if (a.failed > 0 !== b.failed > 0) return a.failed > 0 ? -1 : 1;
    if (a.failed > 0 && a.score !== b.score) return a.score - b.score;
    const bySeverity = SEVERITY_RANK[b.meta.severity] - SEVERITY_RANK[a.meta.severity];
    return bySeverity || a.meta.title.localeCompare(b.meta.title);
  });
}

export function PolicyTable({ C, policies }: { C: EvoCloudPalette; policies: PolicyScore[] }) {
  const [openKey, setOpenKey] = React.useState<string | null>(null);

  if (policies.length === 0) {
    return (
      <Notice C={C} title="No Kyverno policy is failing">
        Every policy passed on every resource it checked.
      </Notice>
    );
  }

  return (
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
        <span title="What a violation does: Enforce blocks it, Audit records it">Mode</span>
        <span>Policy</span>
        <span>Severity</span>
        <span>Score</span>
        <span title="Resources failing / resources checked">Failing</span>
        <span />
      </div>
      {policies.map(policy => (
        <PolicyRow
          key={policy.key}
          C={C}
          policy={policy}
          open={openKey === policy.key}
          onToggle={() => setOpenKey(k => (k === policy.key ? null : policy.key))}
        />
      ))}
    </div>
  );
}
