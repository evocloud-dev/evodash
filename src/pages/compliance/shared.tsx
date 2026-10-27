/**
 * Pieces both Compliance pages use — Frameworks for Kubescape, Policies for
 * Kyverno — so the two are built from the same parts.
 */

import { Router } from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { isSystemNamespace, SYSTEM_NAMESPACE_RULE } from '../../k8s/namespaces';
import { EvoCloudPalette } from '../../palette';
import { CLIP, CopyButton, MONO, Pill } from '../../ui/chrome';

// Via the namespace, not `lib/lib/router` — see the note in ui/chrome.tsx.
const { createRouteURL } = Router;

/** A resource as a policy result or scan names it. */
export interface ResourceRef {
  kind: string;
  name: string;
  namespace: string | null;
}

/**
 * Headlamp's own page for a resource, or '' when it has none.
 *
 * Headlamp names each details route after the kind — "Pod", "DaemonSet" — so
 * the kind a report gives is all it takes. A kind Headlamp has no page for
 * (most custom resources) has no route of that name and gets no link.
 */
export function resourceHref(r: ResourceRef): string {
  try {
    return createRouteURL(r.kind, { namespace: r.namespace ?? undefined, name: r.name });
  } catch {
    return '';
  }
}

export function resourceLabel(r: ResourceRef): string {
  return `${r.kind} ${r.namespace ? `${r.namespace}/` : ''}${r.name}`;
}

/** A small uppercase label over a group inside an expanded row. */
export function Caption({ C, children }: { C: EvoCloudPalette; children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.11em',
        textTransform: 'uppercase',
        color: C.textFaint,
      }}
    >
      {children}
    </div>
  );
}

/** The muted mark beside a namespace that belongs to the platform. */
export function SystemMark({ C }: { C: EvoCloudPalette }) {
  return (
    <Pill fg={C.textDimmer} bg={C.chip} border={C.border} title={SYSTEM_NAMESPACE_RULE}>
      system
    </Pill>
  );
}

/**
 * A resource as a chip that opens its Headlamp page.
 *
 * Clicks stop here so a chip inside an expandable row opens the resource
 * rather than also folding the row away behind it.
 */
export function ResourceChip({
  C,
  resource,
  title,
}: {
  C: EvoCloudPalette;
  resource: ResourceRef;
  title?: string;
}) {
  const label = resourceLabel(resource);
  const href = resourceHref(resource);
  const system = isSystemNamespace(resource.namespace);
  const style: React.CSSProperties = {
    ...CLIP,
    fontSize: '10.5px',
    fontFamily: MONO,
    color: href ? C.link : C.textMuted,
    background: C.chip,
    border: `1px solid ${C.border}`,
    borderRadius: '4px',
    padding: '2px 6px',
    maxWidth: '100%',
    textDecoration: 'none',
    opacity: system ? 0.8 : 1,
  };
  const tooltip = [title ?? label, system ? SYSTEM_NAMESPACE_RULE : '']
    .filter(Boolean)
    .join('\n\n');

  if (!href) {
    return (
      <span style={style} title={tooltip}>
        {label}
      </span>
    );
  }
  return (
    <RouterLink to={href} style={style} title={tooltip} onClick={e => e.stopPropagation()}>
      {label}
    </RouterLink>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/** Two or three labelled views of the same data, the selected one lit. */
export function Segmented<T extends string>({
  C,
  value,
  options,
  onChange,
  label,
}: {
  C: EvoCloudPalette;
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  /** What is being switched, for screen readers. */
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '34px',
        background: C.control,
        border: `1px solid ${C.border}`,
        borderRadius: '8px',
        padding: '3px',
        gap: '2px',
      }}
    >
      {options.map(option => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            style={{
              height: '26px',
              padding: '0 10px',
              border: 0,
              borderRadius: '6px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '12.5px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              background: active ? C.segActive : 'transparent',
              color: active ? C.gold : C.textDim,
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export interface InstallStep {
  label: string;
  command: string;
}

/** Numbered commands, each ready to copy — the way out of a "not installed" notice. */
export function InstallSteps({ C, steps }: { C: EvoCloudPalette; steps: InstallStep[] }) {
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

export function severityTone(
  C: EvoCloudPalette,
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Unknown'
) {
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
