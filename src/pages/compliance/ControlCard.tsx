/**
 * One Kubescape control as a card, for the Frameworks page's grid view.
 *
 * The same build as the KubeVela and App Endpoints cards: the facts on top,
 * a sunken footer. Given `onOpen`, the whole card opens the control in the
 * side panel; without it (a window too narrow for the panel) the failing
 * resources fold out of the card instead.
 */
import React from 'react';
import { ControlScore } from '../../k8s/kubescape';
import { EvoCloudPalette } from '../../palette';
import { ChevronIcon, Chip, CLIP, MONO, NUMERIC, openOnClick, Pill } from '../../ui/chrome';
import { resourceLabel } from './controlFields';
import { severityTone } from './shared';
import { scoreColor } from './useScanResults';

export function ControlCard({
  C,
  control,
  expanded,
  onToggle,
  onOpen,
}: {
  C: EvoCloudPalette;
  control: ControlScore;
  expanded: boolean;
  onToggle: () => void;
  /** Given, the card opens the control in the side panel instead of expanding. */
  onOpen?: () => void;
}) {
  const tone = severityTone(C, control.severity);
  const evaluated = control.evaluated > 0;
  const color = evaluated ? scoreColor(C, control.score) : C.textDimmer;
  // Folding out only when there is no panel to open: the panel lists them.
  const expandable = control.failed > 0 && !onOpen;

  return (
    <div
      className="evo-card"
      {...(onOpen ? openOnClick(onOpen, `${control.controlID} ${control.name}`) : {})}
      style={{
        cursor: onOpen ? 'pointer' : undefined,
        display: 'flex',
        flexDirection: 'column',
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: '10px',
        overflow: 'hidden',
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
            {control.controlID}
          </span>
          <span style={{ flex: 1 }} />
          <Pill fg={tone.fg} bg={tone.bg} border={tone.border}>
            {control.severity}
          </Pill>
        </div>
        <span
          title={control.name}
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
          {control.name}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 'auto' }}>
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
          <span style={{ ...NUMERIC, width: '36px', textAlign: 'right', fontSize: '12px', color }}>
            {evaluated ? `${Math.round(control.score)}%` : '—'}
          </span>
        </div>
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
        <Chip C={C} title={control.category ?? 'No category'}>
          {control.category ?? 'Uncategorised'}
        </Chip>
        <span style={{ flex: 1 }} />
        <span
          style={{ ...NUMERIC, ...CLIP, fontFamily: MONO, fontSize: '11px', color: C.textMuted }}
          title={
            evaluated
              ? `Failed on ${control.failed} of the ${control.evaluated} resources it checked`
              : 'Nothing on this cluster for this control to check'
          }
        >
          {evaluated ? `${control.failed} / ${control.evaluated} failing` : 'not evaluated'}
        </span>
        {expandable && (
          <button
            type="button"
            className="evo-iconbtn"
            onClick={onToggle}
            title="Show the failing resources"
            aria-expanded={expanded}
            aria-label={`Show the ${control.failed} failing resources`}
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
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            padding: '10px 12px 12px',
            borderTop: `1px solid ${C.divider}`,
            background: C.surfaceDeep,
          }}
        >
          {control.failing.map(({ resource: r, excepted }) => {
            const label = resourceLabel(r);
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
