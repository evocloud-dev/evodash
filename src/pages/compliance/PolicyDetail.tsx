/**
 * One Kyverno policy in the side panel: everything the page knows about it.
 *
 * The row and the card only have room for the headline — mode, severity,
 * score. This is the rest: what the policy is for, what its mode means and how
 * to change it, the full outcome counts, the exceptions that relax it, and
 * every failing resource with Kyverno's own message for each, in full.
 */
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { FailingResource, PolicyScore, readyToEnforce } from '../../k8s/kyverno';
import { isSystemNamespace } from '../../k8s/namespaces';
import { EvoCloudPalette } from '../../palette';
import { Code, KeyValue, KeyValues, MONO, NUMERIC, Pill } from '../../ui/chrome';
import {
  actionTitle,
  actionTone,
  Callout,
  enforceHow,
  failsOnlyInSystem,
  workloadsFirst,
} from './PolicyTable';
import { Caption, resourceHref, resourceLabel, severityTone, SystemMark } from './shared';
import { scoreColor } from './useScanResults';

/** Messages longer than this start folded, so one verbose result cannot bury the rest. */
const LONG_MESSAGE = 320;

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

/** The five outcomes Kyverno counts, each with its number, zeros dimmed. */
function Outcomes({ C, policy }: { C: EvoCloudPalette; policy: PolicyScore }) {
  const { pass, fail, warn, error, skip } = policy.checks;
  const cells: { label: string; value: number; color: string }[] = [
    { label: 'pass', value: pass, color: C.healthy },
    { label: 'fail', value: fail, color: C.danger },
    { label: 'warn', value: warn, color: C.gold },
    { label: 'error', value: error, color: C.danger },
    { label: 'skip', value: skip, color: C.textMuted },
  ];
  return (
    <div
      title="Rule results across every resource, as Kyverno counts them"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '6px' }}
    >
      {cells.map(cell => (
        <div
          key={cell.label}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            padding: '7px 4px',
            background: C.surfaceSunken,
            border: `1px solid ${C.border}`,
            borderRadius: '8px',
          }}
        >
          <span
            style={{
              ...NUMERIC,
              fontFamily: MONO,
              fontSize: '15px',
              fontWeight: 600,
              color: cell.value ? cell.color : C.textDimmer,
            }}
          >
            {cell.value}
          </span>
          <span style={{ fontSize: '10.5px', color: C.textDim }}>{cell.label}</span>
        </div>
      ))}
    </div>
  );
}

/** One failing resource: a link to it, the rules it broke, and Kyverno's messages. */
function FailingItem({ C, failure }: { C: EvoCloudPalette; failure: FailingResource }) {
  const { resource, rules, messages } = failure;
  const long = messages.join('').length > LONG_MESSAGE;
  const [open, setOpen] = React.useState(!long);
  const href = resourceHref(resource);
  const label = resourceLabel(resource);
  const system = isSystemNamespace(resource.namespace);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '9px 11px',
        background: C.surfaceSunken,
        border: `1px solid ${C.border}`,
        borderRadius: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        {href ? (
          <RouterLink
            to={href}
            title={`Open ${label} in Headlamp`}
            style={{
              fontFamily: MONO,
              fontSize: '12px',
              color: C.link,
              textDecoration: 'none',
              wordBreak: 'break-all',
            }}
          >
            {label}
          </RouterLink>
        ) : (
          <span style={{ fontFamily: MONO, fontSize: '12px', wordBreak: 'break-all' }}>
            {label}
          </span>
        )}
        {system && <SystemMark C={C} />}
      </div>
      {rules.length > 0 && (
        <div style={{ fontSize: '11px', color: C.textDim }}>
          {rules.length === 1 ? 'rule' : 'rules'}{' '}
          <span style={{ fontFamily: MONO, color: C.textMuted }}>{rules.join(', ')}</span>
        </div>
      )}
      {messages.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            ...(open
              ? {}
              : {
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical' as const,
                  overflow: 'hidden',
                }),
          }}
        >
          {messages.map((message, i) => (
            <div
              key={i}
              style={{
                fontSize: '12px',
                color: C.textMuted,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {message}
            </div>
          ))}
        </div>
      )}
      {long && (
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          style={{
            alignSelf: 'flex-start',
            padding: 0,
            background: 'transparent',
            border: 0,
            color: C.link,
            fontFamily: 'inherit',
            fontSize: '11.5px',
            cursor: 'pointer',
          }}
        >
          {open ? 'Show less' : 'Show the full message'}
        </button>
      )}
    </div>
  );
}

export function PolicyDetail({ C, policy }: { C: EvoCloudPalette; policy: PolicyScore }) {
  const severity = severityTone(C, policy.meta.severity);
  const action = actionTone(C, policy.action);
  const evaluated = policy.evaluated > 0;
  const color = evaluated ? scoreColor(C, policy.score) : C.textDimmer;
  const ready = readyToEnforce(policy);
  const notReady = policy.ready?.state === 'failed';
  const systemOnly = failsOnlyInSystem(policy);
  const failing = workloadsFirst(policy);
  const workloadFailures = failing.filter(f => !isSystemNamespace(f.resource.namespace)).length;

  const facts: KeyValue[] = [
    { k: 'ref', v: policy.ref },
    {
      k: 'kind',
      v: policy.kind ?? `reported only, by ${policy.source || 'an unknown engine'}`,
    },
  ];
  if (policy.namespace) {
    facts.push({ k: 'namespace', v: policy.namespace });
  }
  if (policy.meta.category) {
    facts.push({ k: 'category', v: policy.meta.category });
  }
  if (policy.chart) {
    facts.push({ k: 'chart', v: policy.chart });
  }
  if (policy.kind) {
    facts.push({ k: 'rules', v: String(policy.rules) });
  }
  if (policy.ready) {
    facts.push({
      k: 'readiness',
      // Kyverno's message is often just "Ready" again; say it once.
      v:
        policy.ready.message &&
        policy.ready.message.trim().toLowerCase() !== policy.ready.label.toLowerCase()
          ? `${policy.ready.label}: ${policy.ready.message}`
          : policy.ready.label,
      color: notReady ? C.danger : undefined,
    });
  }
  facts.push(
    { k: 'resources checked', v: String(policy.evaluated) },
    { k: 'passing', v: String(policy.evaluated - policy.failed) },
    {
      k: 'failing',
      v: policy.failed
        ? `${policy.failed} (${workloadFailures} workload, ${
            policy.failed - workloadFailures
          } system)`
        : '0',
      color: policy.failed ? C.danger : undefined,
    }
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        <Pill fg={severity.fg} bg={severity.bg} border={severity.border}>
          {policy.meta.severity}
        </Pill>
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
          <Pill fg={C.healthy} bg={C.healthySoft} border={C.healthyBorder}>
            Ready to enforce
          </Pill>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span style={{ ...NUMERIC, fontSize: '26px', fontWeight: 700, color }}>
            {evaluated ? `${Math.round(policy.score)}%` : '—'}
          </span>
          <span style={{ fontSize: '12.5px', color: C.textMuted }}>
            {evaluated
              ? `${policy.failed} of ${policy.evaluated} resources failing`
              : 'Not reported on any resource yet'}
          </span>
        </div>
        <div
          aria-hidden
          style={{
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
      </div>

      {policy.meta.description && (
        <div style={{ fontSize: '12.5px', color: C.textMuted, lineHeight: 1.6 }}>
          {policy.meta.description}
        </div>
      )}

      <Section C={C} title="Facts">
        <KeyValues C={C} rows={facts} />
      </Section>

      <Section C={C} title="Results">
        <Outcomes C={C} policy={policy} />
      </Section>

      <Section C={C} title="Mode">
        <div style={{ fontSize: '12.5px', color: C.textMuted, lineHeight: 1.6 }}>
          {policy.kind ? (
            <>
              <b style={{ color: action.fg }}>{policy.action}.</b> {actionTitle(policy.action)}
            </>
          ) : (
            'This policy is known only from reports, so its mode cannot be read from the cluster.'
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
        {policy.kind && policy.action === 'Audit' && workloadFailures > 0 && (
          <Callout C={C} tone={C.gold}>
            {workloadFailures} workload{workloadFailures === 1 ? '' : 's'} fail
            {workloadFailures === 1 ? 's' : ''} it today. Enforcing it would not touch what is
            already running, but would block the next change to{' '}
            {workloadFailures === 1 ? 'it' : 'them'} until fixed — fix them, or record exceptions,
            first. {enforceHow(policy)}
          </Callout>
        )}
      </Section>

      <Section C={C} title={`Exceptions (${policy.exceptions.length})`}>
        {policy.exceptions.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {policy.exceptions.map(exception => (
              <span
                key={exception}
                style={{ fontFamily: MONO, fontSize: '12px', color: C.textValue }}
              >
                {exception}
              </span>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: '12.5px', color: C.textDimmer }}>
            No PolicyException relaxes this policy.
          </span>
        )}
      </Section>

      <Section C={C} title={`Failing resources (${failing.length})`}>
        {failing.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {failing.map(failure => (
              <FailingItem key={failure.resource.key} C={C} failure={failure} />
            ))}
          </div>
        ) : (
          <span style={{ fontSize: '12.5px', color: C.textDimmer }}>
            {evaluated
              ? 'Every resource it checked passed.'
              : 'Kyverno has not reported this policy on any resource yet.'}
          </span>
        )}
      </Section>
    </div>
  );
}
