/**
 * One application as a card, for the App Endpoints grid view.
 *
 * Header, action footer, and a properties panel that opens on demand. Owns no
 * data: everything comes from the {@link AppView} handed to it.
 */
import React from 'react';
import { LINK_LABEL } from '../../k8s/forecastleApp';
import { EvoCloudPalette } from '../../palette';
import {
  ChevronIcon,
  Chip,
  CLIP,
  CopyButton,
  MONO,
  NUMERIC,
  OpenButton,
  RemoteIcon,
} from '../../ui/chrome';
import { accessNote, AppView, linkTone, metaTone } from './model';

const LockIcon = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round">
    <rect x="4" y="10.5" width="16" height="10.5" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </svg>
);

export function AppCard({
  C,
  app,
  dense,
  expanded,
  onToggle,
}: {
  C: EvoCloudPalette;
  app: AppView;
  dense: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const url = app.link.url;

  return (
    <div
      className="evo-card"
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: '10px',
        overflow: 'hidden',
        transition: 'border-color 140ms ease, background 140ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: dense ? '10px 12px' : '14px 14px 13px' }}>
        <RemoteIcon C={C} src={app.icon} name={app.name} size={38} />
        <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <span style={{ ...CLIP, fontSize: '14.5px', fontWeight: 600, letterSpacing: '-0.005em' }}>
              {app.name}
            </span>
            <span
              title={app.link.note || LINK_LABEL[app.link.state]}
              style={{
                width: '6px',
                height: '6px',
                flex: 'none',
                borderRadius: '50%',
                background: linkTone(C, app.link.state),
              }}
            />
            {app.restricted && (
              <span
                title="Network restricted — reachable from inside the cluster network only"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 'none',
                  width: '18px',
                  height: '18px',
                  borderRadius: '4px',
                  background: C.goldSoft,
                  border: `1px solid ${C.goldBorder}`,
                  color: C.gold,
                }}
              >
                <LockIcon />
              </span>
            )}
          </div>
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer" style={{ ...CLIP, fontSize: '12px', fontFamily: MONO, color: C.link }}>
              {url.replace(/^https?:\/\//, '')}
            </a>
          ) : (
            <span title={app.link.note} style={{ ...CLIP, fontSize: '12px', fontFamily: MONO, color: C.textDimmer }}>
              {LINK_LABEL[app.link.state]}
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '7px 10px 7px 12px',
          borderTop: `1px solid ${C.divider}`,
          background: C.surfaceSunken,
        }}
      >
        <Chip C={C}>{app.ns}</Chip>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 'none' }}>
          <button
            type="button"
            className="evo-iconbtn"
            onClick={onToggle}
            title="Show metadata"
            aria-expanded={expanded}
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
            {/* Right-aligned floor so the caret does not shift as counts grow. */}
            <span style={{ ...NUMERIC, minWidth: '13px', textAlign: 'right' }}>{app.meta.length}</span>
            <ChevronIcon open={expanded} />
          </button>
          {url && (
            <>
              <CopyButton C={C} value={url} label={app.name} />
              <OpenButton C={C} href={url} label={app.name} />
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${C.divider}`, background: C.surfaceDeep, padding: '11px 12px 12px' }}>
          <div
            style={{
              fontSize: '9.5px',
              fontWeight: 700,
              letterSpacing: '0.11em',
              textTransform: 'uppercase',
              color: C.textFaint,
              marginBottom: '8px',
            }}
          >
            Properties
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 14px', alignItems: 'baseline' }}>
            {app.meta.map(row => {
              const tone = metaTone(C, row, app);
              return (
                <React.Fragment key={row.k}>
                  <span style={{ fontSize: '11px', fontFamily: MONO, color: C.textDim, whiteSpace: 'nowrap' }}>
                    {row.k}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      color: tone ?? C.textValue,
                      fontFamily: tone ? MONO : undefined,
                      fontWeight: tone ? 500 : undefined,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {row.v}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
          <div style={{ marginTop: '9px', paddingTop: '9px', borderTop: `1px dashed ${C.divider}`, fontSize: '11px', color: C.textDimmer }}>
            {accessNote(app)}
          </div>
        </div>
      )}
    </div>
  );
}
