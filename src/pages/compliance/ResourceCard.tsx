/**
 * One failing resource as a card, for the Policies page's by-resource card
 * view: what it is, where it lives, how bad its worst failure is, and every
 * policy it fails.
 */
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { ResourceFailures } from '../../k8s/kyverno';
import { EvoCloudPalette } from '../../palette';
import { Chip, CLIP, MONO, openOnClick, Pill } from '../../ui/chrome';
import { resourceHref, severityTone, SystemMark } from './shared';

export function ResourceCard({
  C,
  entry,
  onOpen,
}: {
  C: EvoCloudPalette;
  entry: ResourceFailures;
  /** Given, a click anywhere on the card opens the side panel. */
  onOpen?: () => void;
}) {
  const { resource, system, policies } = entry;
  const severity = severityTone(C, entry.severity);
  const href = resourceHref(resource);

  return (
    <div
      className="evo-card"
      {...(onOpen ? openOnClick(onOpen, `${resource.kind} ${resource.name}`) : {})}
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
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          padding: '13px 14px 10px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 }}>
          {href ? (
            <RouterLink
              to={href}
              title={`Open ${resource.kind} ${resource.name} in Headlamp`}
              style={{
                ...CLIP,
                fontSize: '14px',
                fontWeight: 600,
                color: C.link,
                textDecoration: 'none',
              }}
            >
              {resource.name}
            </RouterLink>
          ) : (
            <span title={resource.name} style={{ ...CLIP, fontSize: '14px', fontWeight: 600 }}>
              {resource.name}
            </span>
          )}
          <span style={{ ...CLIP, fontFamily: MONO, fontSize: '11.5px', color: C.textDimmer }}>
            {resource.kind}
          </span>
        </div>
        <Pill
          fg={severity.fg}
          bg={severity.bg}
          border={severity.border}
          title="The worst severity among the policies it fails"
        >
          {entry.severity}
        </Pill>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignContent: 'flex-start',
          gap: '6px',
          padding: '0 14px 13px',
          flex: 1,
        }}
      >
        {policies.map(({ ref, title, severity: s, failure }) => {
          const tone = severityTone(C, s);
          return (
            <span
              key={ref}
              title={[`${title} (${s})`, ...failure.messages].join('\n\n')}
              style={{
                ...CLIP,
                maxWidth: '100%',
                fontSize: '11px',
                color: C.textMuted,
                background: C.chip,
                border: `1px solid ${C.border}`,
                borderLeft: `3px solid ${tone.fg}`,
                borderRadius: '4px',
                padding: '2px 6px',
              }}
            >
              {title}
            </span>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '7px 12px',
          borderTop: `1px solid ${C.divider}`,
          background: C.surfaceSunken,
        }}
      >
        <Chip C={C} title={resource.namespace ?? 'cluster-scoped'}>
          {resource.namespace ?? 'cluster'}
        </Chip>
        {system && <SystemMark C={C} />}
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: MONO, fontSize: '11px', color: C.textDimmer }}>
          {policies.length} {policies.length === 1 ? 'policy' : 'policies'}
        </span>
      </div>
    </div>
  );
}
