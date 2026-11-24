/**
 * One Kyverno policy as a card, for the Policies page's card view.
 *
 * The same facts as a row of the policy table — mode, severity, score and what
 * fails it — laid out like the other cards in the plugin: a header, the facts,
 * and a sunken footer. The failing resources fold out underneath, as the row's
 * do.
 */
import React from 'react';
import { PolicyScore, readyToEnforce } from '../../k8s/kyverno';
import { isSystemNamespace } from '../../k8s/namespaces';
import { EvoCloudPalette } from '../../palette';
import { ChevronIcon, Chip, CLIP, MONO, NUMERIC, openOnClick, Pill } from '../../ui/chrome';
import { actionTitle, actionTone } from './PolicyTable';
import { ResourceChip, severityTone } from './shared';
import { scoreColor } from './useScanResults';

export function PolicyCard({
  C,
  policy,
  expanded,
  onToggle,
  onOpen,
}: {
  C: EvoCloudPalette;
  policy: PolicyScore;
  expanded: boolean;
  onToggle: () => void;
  /** Given, a click anywhere on the card opens the side panel; nothing folds out. */
  onOpen?: () => void;
}) {
  const severity = severityTone(C, policy.meta.severity);
  const action = actionTone(C, policy.action);
  const evaluated = policy.evaluated > 0;
  const color = evaluated ? scoreColor(C, policy.score) : C.textDimmer;
  const ready = readyToEnforce(policy);
  const notReady = policy.ready?.state === 'failed';
  // Workloads first, as everywhere else on the page.
  const failing = [...policy.failing].sort(
    (a, b) =>
      Number(isSystemNamespace(a.resource.namespace)) -
      Number(isSystemNamespace(b.resource.namespace))
  );

  return (
    <div
      className="evo-card"
      {...(onOpen ? openOnClick(onOpen, policy.meta.title) : {})}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: '10px',
        overflow: 'hidden',
        transition: 'border-color 140ms ease, background 140ms ease',
        cursor: onOpen ? 'pointer' : undefined,
      }}
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '13px 14px 8px' }}
      >
        <span
          title={policy.meta.title}
          style={{ ...CLIP, fontSize: '14px', fontWeight: 600, letterSpacing: '-0.005em' }}
        >
          {policy.meta.title}
        </span>
        <span style={{ ...CLIP, fontFamily: MONO, fontSize: '11.5px', color: C.textDimmer }}>
          {policy.ref}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '0 14px 10px' }}>
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
          <Pill
            fg={C.healthy}
            bg={C.healthySoft}
            border={C.healthyBorder}
            title="Nothing running today fails it, so enforcing it would block nothing already here."
          >
            Ready to enforce
          </Pill>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '0 14px 13px',
          flex: 1,
        }}
      >
        <div
          aria-hidden
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
        <span style={{ ...NUMERIC, fontSize: '12px', color }}>
          {evaluated ? `${Math.round(policy.score)}%` : '—'}
        </span>
        <span
          style={{ ...NUMERIC, fontFamily: MONO, fontSize: '11.5px', color: C.textMuted }}
          title={
            evaluated
              ? `Failed on ${policy.failed} of the ${policy.evaluated} resources it checked`
              : 'Not reported on any resource yet'
          }
        >
          {evaluated ? `${policy.failed} / ${policy.evaluated} failing` : 'not checked yet'}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px 6px 12px',
          borderTop: `1px solid ${C.divider}`,
          background: C.surfaceSunken,
        }}
      >
        {policy.kind && (
          <Chip C={C}>
            {policy.rules} rule{policy.rules === 1 ? '' : 's'}
          </Chip>
        )}
        {policy.exceptions.length > 0 && (
          <Chip C={C} title={policy.exceptions.join('\n')}>
            {policy.exceptions.length} exception{policy.exceptions.length === 1 ? '' : 's'}
          </Chip>
        )}
        <span style={{ flex: 1 }} />
        {onOpen && failing.length > 0 && (
          <span style={{ ...NUMERIC, fontFamily: MONO, fontSize: '11px', color: C.textDimmer }}>
            {failing.length} failing
          </span>
        )}
        {!onOpen && failing.length > 0 && (
          <button
            type="button"
            className="evo-iconbtn"
            onClick={onToggle}
            aria-expanded={expanded}
            title={expanded ? 'Hide the failing resources' : 'Show the failing resources'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              height: '26px',
              padding: '0 6px',
              background: 'transparent',
              border: 0,
              borderRadius: '6px',
              color: C.textDim,
              fontFamily: MONO,
              fontSize: '10.5px',
              cursor: 'pointer',
            }}
          >
            <span style={NUMERIC}>{failing.length}</span>
            <ChevronIcon open={expanded} />
          </button>
        )}
      </div>

      {!onOpen && expanded && failing.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            padding: '10px 12px 12px',
            borderTop: `1px solid ${C.divider}`,
            background: C.surfaceDeep,
          }}
        >
          {failing.map(({ resource, messages }) => (
            <ResourceChip
              key={resource.key}
              C={C}
              resource={resource}
              title={messages.join('\n\n')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
