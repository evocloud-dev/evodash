/**
 * One Cluster Health check as a card, for the page's grid view.
 *
 * The same build as the control cards on Security Benchmark: the facts on
 * top, a sunken footer. Given `onOpen`, the whole card opens the check in the
 * side panel; without it (a window too narrow for the panel) the findings fold
 * out of the card instead.
 */
import React from 'react';
import { CheckResult } from '../../k8s/clusterHealth/engine';
import { EvoCloudPalette } from '../../palette';
import { ChevronIcon, Chip, CLIP, MONO, NUMERIC, openOnClick, Pill } from '../../ui/chrome';
import { HealthFindings, healthTone, StatusPill } from './HealthCheckDetail';
import { affectedResources, checkSeverity } from './healthFields';

export function HealthCheckCard({
  C,
  check,
  expanded,
  onToggle,
  onOpen,
}: {
  C: EvoCloudPalette;
  check: CheckResult;
  expanded: boolean;
  onToggle: () => void;
  onOpen?: () => void;
}) {
  const severity = checkSeverity(check);
  const tone = healthTone(C, severity);
  const expandable = check.findings.length > 0 && !onOpen;
  const resources = affectedResources(check);

  let line: React.ReactNode;
  if (check.status === 'failed') {
    line = (
      <span style={{ color: C.danger }}>
        {resources} resource{resources === 1 ? '' : 's'} affected
      </span>
    );
  } else if (check.status === 'passed') {
    line = <span style={{ color: C.healthy }}>Nothing fails this check</span>;
  } else {
    line = <span style={{ color: C.textDimmer }}>{check.skippedReason ?? 'Not run'}</span>;
  }

  return (
    <div
      className="evo-card"
      {...(onOpen ? openOnClick(onOpen, `${check.id} ${check.name}`) : {})}
      style={{
        cursor: onOpen ? 'pointer' : undefined,
        display: 'flex',
        flexDirection: 'column',
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: '10px',
        overflow: 'hidden',
        gridColumn: expanded && expandable ? '1 / -1' : undefined,
        transition: 'border-color 140ms ease, background 140ms ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '13px 14px 12px',
          flex: 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: MONO, fontSize: '11.5px', color: C.textMuted }}>
            {check.id}
          </span>
          <span style={{ flex: 1 }} />
          <Pill fg={tone.fg} bg={tone.bg} border={tone.border}>
            {severity}
          </Pill>
        </div>
        <span
          title={check.name}
          style={{
            fontSize: '13.5px',
            fontWeight: 600,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {check.name}
        </span>
        <span style={{ ...NUMERIC, ...CLIP, fontSize: '12px', marginTop: 'auto' }}>{line}</span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '7px 10px 7px 12px',
          borderTop: `1px solid ${C.divider}`,
          background: C.surfaceSunken,
        }}
      >
        <Chip C={C}>{check.section}</Chip>
        <span style={{ flex: 1 }} />
        <StatusPill C={C} check={check} />
        {expandable && (
          <button
            type="button"
            className="evo-iconbtn"
            onClick={onToggle}
            title="Show the findings"
            aria-expanded={expanded}
            aria-label={`Show the ${check.findings.length} findings`}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: '24px',
              padding: '0 5px',
              background: 'transparent',
              border: 0,
              borderRadius: '6px',
              color: C.textDim,
              cursor: 'pointer',
            }}
          >
            <ChevronIcon open={expanded} />
          </button>
        )}
      </div>

      {expanded && expandable && (
        <div
          style={{
            padding: '10px 12px 12px',
            borderTop: `1px solid ${C.divider}`,
            background: C.surface,
          }}
        >
          <HealthFindings C={C} check={check} />
        </div>
      )}
    </div>
  );
}
