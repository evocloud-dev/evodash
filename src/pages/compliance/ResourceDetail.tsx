/**
 * One failing resource in the side panel: what it is, where it lives, and
 * every Kyverno policy it fails with the messages in full.
 *
 * The question this answers is "what do I have to change here", so each
 * failure carries the rule that broke and Kyverno's own explanation, and each
 * policy title leads to that policy's own panel.
 */
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { ResourceFailures } from '../../k8s/kyverno';
import { SYSTEM_NAMESPACE_RULE } from '../../k8s/namespaces';
import { EvoCloudPalette } from '../../palette';
import { KeyValues, MONO, Pill } from '../../ui/chrome';
import { Caption, resourceHref, resourceLabel, severityTone, SystemMark } from './shared';

export function ResourceDetail({
  C,
  entry,
  openPolicy,
}: {
  C: EvoCloudPalette;
  entry: ResourceFailures;
  /**
   * The handler that opens a policy's panel, by its report ref, or null when
   * no policy of that ref is known — its title is then plain text.
   */
  openPolicy?: (ref: string) => (() => void) | null;
}) {
  const { resource, system, policies } = entry;
  const severity = severityTone(C, entry.severity);
  const href = resourceHref(resource);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
        <Pill
          fg={severity.fg}
          bg={severity.bg}
          border={severity.border}
          title="The worst severity among the policies it fails"
        >
          {entry.severity}
        </Pill>
        {system && <SystemMark C={C} />}
        <span style={{ flex: 1 }} />
        {href && (
          <RouterLink
            to={href}
            title={`Open ${resourceLabel(resource)} in Headlamp`}
            style={{ fontSize: '12.5px', color: C.link, textDecoration: 'none' }}
          >
            Open in Headlamp ↗
          </RouterLink>
        )}
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Caption C={C}>Resource</Caption>
        <KeyValues
          C={C}
          rows={[
            { k: 'kind', v: resource.kind },
            { k: 'name', v: resource.name },
            { k: 'namespace', v: resource.namespace ?? 'cluster-scoped' },
            {
              k: 'side',
              v: system ? `system — ${SYSTEM_NAMESPACE_RULE}` : 'workload',
            },
            {
              k: 'fails',
              v: `${policies.length} ${policies.length === 1 ? 'policy' : 'policies'}`,
              color: C.danger,
            },
          ]}
        />
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Caption C={C}>Policies it fails ({policies.length})</Caption>
        {policies.map(({ ref, title, severity: s, failure }) => {
          const tone = severityTone(C, s);
          const open = openPolicy?.(ref) ?? null;
          return (
            <div
              key={ref}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                padding: '9px 11px',
                background: C.surfaceSunken,
                border: `1px solid ${C.border}`,
                borderLeft: `3px solid ${tone.fg}`,
                borderRadius: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <Pill fg={tone.fg} bg={tone.bg} border={tone.border}>
                  {s}
                </Pill>
                {open ? (
                  <button
                    type="button"
                    onClick={open}
                    title={`Open the ${title} policy`}
                    style={{
                      padding: 0,
                      background: 'transparent',
                      border: 0,
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: C.link,
                      cursor: 'pointer',
                    }}
                  >
                    {title}
                  </button>
                ) : (
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{title}</span>
                )}
              </div>
              <div style={{ fontSize: '11px', color: C.textDim }}>
                policy <span style={{ fontFamily: MONO, color: C.textMuted }}>{ref}</span>
                {failure.rules.length > 0 && (
                  <>
                    {' · '}
                    {failure.rules.length === 1 ? 'rule' : 'rules'}{' '}
                    <span style={{ fontFamily: MONO, color: C.textMuted }}>
                      {failure.rules.join(', ')}
                    </span>
                  </>
                )}
              </div>
              {failure.messages.map((message, i) => (
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
          );
        })}
      </section>
    </div>
  );
}
