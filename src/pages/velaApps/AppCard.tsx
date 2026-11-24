/**
 * One KubeVela Application as a card, for the grid view.
 *
 * Built like the App Endpoints card so the two grids read as one design:
 * the whole card opens the side panel, the facts in the middle, and a sunken
 * footer with where it lives and how old it is. Owns no data; everything comes
 * from the {@link AppView} handed to it.
 */
import React from 'react';
import { readyTone } from '../../k8s/conditions';
import { EvoCloudPalette } from '../../palette';
import { age, Chip, CLIP, Dot, MONO, NUMERIC, openOnClick, Pill } from '../../ui/chrome';
import { AppView, workflowProgress } from './model';

const TYPES_SHOWN = 3;

function Row({
  C,
  label,
  children,
}: {
  C: EvoCloudPalette;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <span style={{ fontSize: '11px', fontFamily: MONO, color: C.textDim, whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
        {children}
      </div>
    </>
  );
}

export function VelaAppCard({
  C,
  app,
  onOpen,
}: {
  C: EvoCloudPalette;
  app: AppView;
  /** Given, the whole card opens the side panel. */
  onOpen?: () => void;
}) {
  const tone = readyTone(C, app.health.state);
  const progress = workflowProgress(app);
  const statusNote = app.health.message ?? app.health.label;

  return (
    <div
      className="evo-card"
      {...(onOpen ? openOnClick(onOpen, app.name) : {})}
      style={{
        display: 'flex',
        flexDirection: 'column',
        cursor: onOpen ? 'pointer' : undefined,
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
          gap: '3px',
          padding: '13px 14px 10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <Dot color={tone.fg} title={statusNote} size={7} />
          <span style={{ ...CLIP, fontSize: '14.5px', fontWeight: 600, letterSpacing: '-0.005em' }}>
            {app.name}
          </span>
          {app.addon && (
            <Chip C={C} title={`Installed by the ${app.addon.name} addon`}>
              addon
            </Chip>
          )}
        </div>
        <span
          title={app.revision ?? 'Nothing published yet'}
          style={{
            ...CLIP,
            fontSize: '12px',
            fontFamily: MONO,
            color: app.revision ? C.textMuted : C.textDimmer,
          }}
        >
          {app.revision ?? 'no revision yet'}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr)',
          gap: '7px 12px',
          alignItems: 'center',
          padding: '2px 14px 13px',
          flex: 1,
        }}
      >
        <Row C={C} label="status">
          <span
            title={statusNote}
            style={{
              flex: 'none',
              fontSize: '12px',
              fontFamily: MONO,
              fontWeight: 600,
              color: tone.fg,
            }}
          >
            {app.health.label}
          </span>
          {app.health.message && app.health.state !== 'ready' && (
            <span
              title={app.health.message}
              style={{ ...CLIP, fontSize: '11.5px', color: C.textDimmer }}
            >
              {app.health.message}
            </span>
          )}
        </Row>

        <Row C={C} label="components">
          <span
            style={{ ...NUMERIC, fontFamily: MONO, fontSize: '12px', color: C.textValue }}
            title={
              app.healthyServices === null
                ? 'No component has reported yet'
                : `${app.healthyServices} of ${app.components.length} healthy`
            }
          >
            {app.healthyServices === null
              ? app.components.length
              : `${app.healthyServices}/${app.components.length}`}
          </span>
          {app.types.slice(0, TYPES_SHOWN).map(type => (
            <Pill key={type} fg={C.accent} bg={C.accentSoft} border={C.accentBorder}>
              {type}
            </Pill>
          ))}
          {app.types.length > TYPES_SHOWN && (
            <span
              title={app.types.join(', ')}
              style={{ fontFamily: MONO, fontSize: '11px', color: C.textDimmer }}
            >
              +{app.types.length - TYPES_SHOWN}
            </span>
          )}
        </Row>

        <Row C={C} label="workflow">
          {progress ? (
            <>
              <span
                style={{ ...CLIP, fontFamily: MONO, fontSize: '12px', color: C.textValue }}
                title={`${progress.status} · ${progress.done} of ${progress.total} steps succeeded`}
              >
                {progress.status}
              </span>
              {progress.total > 0 && (
                <>
                  <div
                    aria-hidden
                    style={{
                      flex: 1,
                      minWidth: '28px',
                      maxWidth: '90px',
                      height: '5px',
                      borderRadius: '3px',
                      background: C.divider,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${(progress.done / progress.total) * 100}%`,
                        height: '100%',
                        background: progress.done === progress.total ? C.healthy : C.gold,
                      }}
                    />
                  </div>
                  <span
                    style={{ ...NUMERIC, fontFamily: MONO, fontSize: '11px', color: C.textDimmer }}
                  >
                    {progress.done}/{progress.total}
                  </span>
                </>
              )}
            </>
          ) : (
            <span style={{ fontFamily: MONO, fontSize: '12px', color: C.textDimmer }}>—</span>
          )}
        </Row>
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
        <Chip C={C} title={`Namespace ${app.ns}`}>
          {app.ns}
        </Chip>
        {app.policies.length > 0 && (
          <Chip C={C} title={app.policies.map(p => p.name || p.type).join(', ')}>
            {app.policies.length} {app.policies.length === 1 ? 'policy' : 'policies'}
          </Chip>
        )}
        <span style={{ flex: 1 }} />
        <span
          title={app.created ?? undefined}
          style={{ ...NUMERIC, fontFamily: MONO, fontSize: '11px', color: C.textDimmer }}
        >
          {age(app.created)}
        </span>
      </div>
    </div>
  );
}
