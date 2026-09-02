/**
* The App Endpoints list view: a header strip and one row per application.
 *
 * Header and rows share {@link COLUMNS} — a single track definition is the only
 * thing keeping them aligned, so they must not be edited apart.
 */
import React from 'react';
import { LINK_LABEL, SOURCE_LABEL } from '../../k8s/publishedApp';
import { EvoCloudPalette } from '../../palette';
import { CLIP, CopyButton, MONO, Mono, OpenButton, Pill, RemoteIcon } from '../../ui/chrome';
import { AppView, linkTone } from './model';

const COLUMNS =
  'minmax(150px, 1.3fr) minmax(130px, 1.4fr) minmax(84px, 110px) minmax(84px, 110px) 96px 96px 84px 74px';

const HEADINGS = [
  'Application',
  'URL',
  'Namespace',
  'Instance',
  'Link',
  'Source',
  'Network',
  'Actions',
];

const LockIcon = ({ open }: { open: boolean }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
    <rect x="4" y="10.5" width="16" height="10.5" rx="2" />
    <path d={open ? 'M8.5 10.5V7.5a4 4 0 0 1 7.5-1.9' : 'M8 10.5V7.5a4 4 0 0 1 8 0v3'} />
  </svg>
);

export function AppTable({
  C,
  apps,
  onOpen,
}: {
  C: EvoCloudPalette;
  apps: AppView[];
  /** Given, the application name opens the side panel. */
  onOpen?: (app: AppView) => void;
}) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: '10px', overflow: 'hidden', overflowX: 'auto', background: C.surface }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: COLUMNS,
          gap: '10px',
          alignItems: 'center',
          padding: '9px 14px',
          background: C.surfaceSunken,
          borderBottom: `1px solid ${C.divider}`,
          fontSize: '10.5px',
          fontWeight: 700,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: C.textDimmer,
        }}
      >
        {HEADINGS.map((h, i) => (
          <span key={h} style={i === HEADINGS.length - 1 ? { textAlign: 'right' } : undefined}>
            {h}
          </span>
        ))}
      </div>
      {apps.map(app => (
        <AppRow key={app.key} C={C} app={app} onOpen={onOpen && (() => onOpen(app))} />
      ))}
    </div>
  );
}

function AppRow({
  C,
  app,
  onOpen,
}: {
  C: EvoCloudPalette;
  app: AppView;
  onOpen?: () => void;
}) {
  const url = app.link.url;

  return (
    <div
      className="evo-row"
      style={{
        display: 'grid',
        gridTemplateColumns: COLUMNS,
        gap: '10px',
        alignItems: 'center',
        padding: '9px 14px',
        borderBottom: `1px solid ${C.dividerSoft}`,
        transition: 'background 120ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <RemoteIcon C={C} src={app.icon} name={app.name} size={26} />
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            title={`Open ${app.name}`}
            style={{
              ...CLIP,
              minWidth: 0,
              padding: 0,
              background: 'transparent',
              border: 0,
              textAlign: 'left',
              font: 'inherit',
              fontSize: '13.5px',
              fontWeight: 600,
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            {app.name}
          </button>
        ) : (
          <span style={{ ...CLIP, fontSize: '13.5px', fontWeight: 600, minWidth: 0 }}>
            {app.name}
          </span>
        )}
      </div>

      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ ...CLIP, fontSize: '12px', fontFamily: MONO, color: C.link }}>
          {url.replace(/^https?:\/\//, '')}
        </a>
      ) : (
        <Mono C={C} title={app.link.note} color={C.textDimmer}>
          —
        </Mono>
      )}

      <Mono C={C}>{app.ns}</Mono>
      <Mono C={C}>{app.instance ?? '—'}</Mono>

      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
        <span
          title={app.link.note}
          style={{ width: '6px', height: '6px', flex: 'none', borderRadius: '50%', background: linkTone(C, app.link.state) }}
        />
        <span style={{ ...CLIP, fontSize: '12px', color: C.textMuted }}>{LINK_LABEL[app.link.state]}</span>
      </div>

      <Mono C={C}>{SOURCE_LABEL[app.source]}</Mono>

      <Pill
        fg={app.restricted ? C.gold : C.healthy}
        bg={app.restricted ? C.goldSoft : C.healthySoft}
        border={app.restricted ? C.goldBorder : C.healthyBorder}
      >
        <LockIcon open={!app.restricted} />
        <span>{app.restricted ? 'Internal' : 'Public'}</span>
      </Pill>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>
        {url && (
          <>
            <CopyButton C={C} value={url} label={app.name} />
            <OpenButton C={C} href={url} label={app.name} />
          </>
        )}
      </div>
    </div>
  );
}
