/**
 * The policy table turned inside out: each failing resource, and every policy
 * it fails.
 *
 * The policy view answers "is this rule holding"; this one answers "what do I
 * have to change", which is the question whoever owns a workload brings. One
 * Deployment failing four policies is one row here and four entries there.
 *
 * Workloads come before system components. The platform's own pods fail Pod
 * Security policies by design, and listing them first would bury the handful
 * of rows someone here can actually act on.
 */

import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { ResourceFailures } from '../../k8s/kyverno';
import { EvoCloudPalette } from '../../palette';
import { Chip, CLIP, MONO, Notice, NUMERIC, Pill } from '../../ui/chrome';
import { resourceHref, severityTone, SystemMark } from './shared';

const COLUMNS = 'minmax(240px, 1.4fr) minmax(170px, 1fr) 96px 110px 28px';

function ResourceRow({
  C,
  entry,
  open,
  onToggle,
}: {
  C: EvoCloudPalette;
  entry: ResourceFailures;
  open: boolean;
  onToggle: () => void;
}) {
  const { resource, system, policies } = entry;
  const severity = severityTone(C, entry.severity);
  const href = resourceHref(resource);

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
        <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
          {href ? (
            // Opens the resource; the click stops here so it does not also
            // fold the row open behind it.
            <RouterLink
              to={href}
              onClick={e => e.stopPropagation()}
              title={`Open ${resource.kind} ${resource.name} in Headlamp`}
              style={{ ...CLIP, fontSize: '13px', color: C.link, textDecoration: 'none' }}
            >
              {resource.name}
            </RouterLink>
          ) : (
            <span style={{ ...CLIP, fontSize: '13px' }} title={resource.name}>
              {resource.name}
            </span>
          )}
          <span style={{ ...CLIP, fontFamily: MONO, fontSize: '11px', color: C.textDimmer }}>
            {resource.kind}
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <Chip C={C} title={resource.namespace ?? 'cluster-scoped'}>
            {resource.namespace ?? 'cluster'}
          </Chip>
          {system && <SystemMark C={C} />}
        </span>
        <Pill fg={severity.fg} bg={severity.bg} border={severity.border}>
          {entry.severity}
        </Pill>
        <span
          style={{ ...NUMERIC, fontFamily: MONO, fontSize: '11.5px', color: C.textMuted }}
          title={policies.map(p => p.title).join('\n')}
        >
          {policies.length} {policies.length === 1 ? 'policy' : 'policies'}
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
            gap: '12px',
            padding: '6px 14px 14px',
            background: C.surfaceDeep,
          }}
        >
          {policies.map(({ ref, title, severity: s, failure }) => {
            const tone = severityTone(C, s);
            return (
              <div key={ref} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <Pill fg={tone.fg} bg={tone.bg} border={tone.border}>
                    {s}
                  </Pill>
                  <span style={{ ...CLIP, fontSize: '12.5px', fontWeight: 600 }}>{title}</span>
                  <span
                    style={{ ...CLIP, fontFamily: MONO, fontSize: '11px', color: C.textDimmer }}
                  >
                    {failure.rules.join(', ')}
                  </span>
                </span>
                {failure.messages.map(message => (
                  <span
                    key={message}
                    style={{
                      fontSize: '12px',
                      color: C.textMuted,
                      lineHeight: 1.55,
                      maxWidth: '100ch',
                    }}
                  >
                    {message}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ResourceTable({
  C,
  offenders,
  empty,
}: {
  C: EvoCloudPalette;
  offenders: ResourceFailures[];
  /** What to say when the filter leaves nothing. */
  empty: { title: string; body: string };
}) {
  const [openKey, setOpenKey] = React.useState<string | null>(null);

  if (offenders.length === 0) {
    return (
      <Notice C={C} title={empty.title}>
        {empty.body}
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
        <span>Resource</span>
        <span>Namespace</span>
        <span title="The worst severity among the policies it fails">Severity</span>
        <span>Fails</span>
        <span />
      </div>
      {offenders.map(entry => (
        <ResourceRow
          key={entry.resource.key}
          C={C}
          entry={entry}
          open={openKey === entry.resource.key}
          onToggle={() => setOpenKey(k => (k === entry.resource.key ? null : entry.resource.key))}
        />
      ))}
    </div>
  );
}
