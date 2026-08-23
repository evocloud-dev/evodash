/**
 * Forecastle's own web UI, reachable without leaving Headlamp.
 *
 * One row per Forecastle Service in the cluster, showing whether a port forward
 * is currently up and on which local port, with start / open / stop beside it.
 * That covers both halves of the problem: nobody has to type
 * `kubectl port-forward`, and what is already forwarding is visible rather than
 * guessed at.
 *
 * Renders nothing when no Forecastle Service exists, so clusters that only have
 * the CRD are not shown a control for something that is not installed.
 */
import React from 'react';
import {
  ExternalForwards,
  ForecastleService,
  useExternalForwards,
  useForecastleUi,
} from '../../k8s/forecastleUi';
import { EvoCloudPalette } from '../../palette';
import { Chip, CLIP, MONO, NUMERIC, OpenIcon } from '../../ui/chrome';

const StopIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

const PlayIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5.5v13l11-6.5z" />
  </svg>
);

export function WebUiStrip({ C }: { C: EvoCloudPalette }) {
  const { services, busy, error, start, stop } = useForecastleUi();
  const ext = useExternalForwards();

  // Hidden only when there is nothing at all to say. A cluster with just the
  // CRD and no Service still shows the strip if a forward is being tracked,
  // otherwise adding one would make it vanish.
  if (services.length === 0 && ext.entries.length === 0) {
    return null;
  }

  const action = (svc: ForecastleService): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    height: '26px',
    padding: '0 10px',
    borderRadius: '6px',
    border: `1px solid ${C.border}`,
    background: C.control,
    color: C.textMuted,
    fontFamily: 'inherit',
    fontSize: '11.5px',
    fontWeight: 500,
    cursor: busy === svc.key ? 'progress' : 'pointer',
    opacity: busy === svc.key ? 0.6 : 1,
  });

  return (
    <div
      style={{
        // Sits under the catalog, so it is bordered rather than filled — it
        // should read as a utility panel, not another card competing with the
        // application cards above it.
        border: `1px solid ${C.border}`,
        borderRadius: '10px',
        background: 'transparent',
        marginTop: '10px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '7px 14px',
          borderBottom: `1px solid ${C.dividerSoft}`,
          fontSize: '10.5px',
          fontWeight: 700,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: C.textDimmer,
        }}
      >
        <span>App Endpoints web UI</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: 'none', fontFamily: MONO }}>
          optional · the catalog above does not need it
        </span>
      </div>

      {services.map(svc => (
        <div
          key={svc.key}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 14px',
            borderBottom: `1px solid ${C.dividerSoft}`,
          }}
        >
          <span
            title={svc.url ? 'Forward is up' : 'Not forwarding'}
            style={{
              width: '7px',
              height: '7px',
              flex: 'none',
              borderRadius: '50%',
              background: svc.url ? C.healthy : C.textFaint,
            }}
          />
          <Chip C={C}>
            {svc.namespace}/{svc.name}
          </Chip>

          {svc.url ? (
            <a href={svc.url} target="_blank" rel="noopener noreferrer" style={{ ...CLIP, ...NUMERIC, fontSize: '12px', fontFamily: MONO, color: C.link }}>
              {svc.url.replace(/^https?:\/\//, '')}
            </a>
          ) : (
            <span style={{ ...CLIP, fontSize: '12px', color: C.textDimmer }}>
              not forwarding · targets port {String(svc.targetPort)}
            </span>
          )}

          <span style={{ flex: 1 }} />

          {svc.url ? (
            <>
              <a
                href={svc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="evo-openlink"
                style={{ ...action(svc), color: C.gold, cursor: 'pointer' }}
              >
                <OpenIcon />
                <span>Open</span>
              </a>
              <button type="button" onClick={() => stop(svc)} disabled={busy === svc.key} style={action(svc)}>
                <StopIcon />
                <span>Stop</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={async () => {
                const url = await start(svc);
                if (url) {
                  window.open(url, '_blank', 'noopener,noreferrer');
                }
              }}
              disabled={busy === svc.key}
              style={{ ...action(svc), color: C.brand, borderColor: C.brandBorder, background: C.brandSoft }}
            >
              <PlayIcon />
              <span>{busy === svc.key ? 'Starting…' : 'Start and open'}</span>
            </button>
          )}
        </div>
      ))}

      <ExternalForwardRows C={C} ext={ext} />

      {error && (
        <div style={{ padding: '8px 14px', fontSize: '11.5px', color: C.danger, background: C.surfaceSunken }}>
          {error}
        </div>
      )}
    </div>
  );
}

/**
 * Forwards started outside Headlamp.
 *
 * Headlamp only knows about forwards it started itself, so a terminal
 * `kubectl port-forward` never appears above. These are remembered locally and
 * re-probed, which is the most the browser can do — see `probeForecastle`.
 */
function ExternalForwardRows({ C, ext }: { C: EvoCloudPalette; ext: ExternalForwards }) {
  const { entries, scanning, add, remove, scan } = ext;
  const [draft, setDraft] = React.useState('');
  const [scanNote, setScanNote] = React.useState<string | null>(null);

  const submit = async () => {
    const port = parseInt(draft.trim(), 10);
    if (Number.isInteger(port)) {
      await add(port);
      setDraft('');
    }
  };

  const small: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    height: '24px',
    padding: '0 9px',
    borderRadius: '6px',
    border: `1px solid ${C.border}`,
    background: C.control,
    color: C.textMuted,
    fontFamily: 'inherit',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
  };

  return (
    <>
      {entries.map(entry => (
        <div
          key={entry.port}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 14px',
            borderBottom: `1px solid ${C.dividerSoft}`,
          }}
        >
          <span
            title={entry.alive ? 'Responding' : 'Not responding — the forward may have stopped'}
            style={{
              width: '7px',
              height: '7px',
              flex: 'none',
              borderRadius: '50%',
              background: entry.alive ? C.healthy : C.textFaint,
            }}
          />
          <Chip C={C} title="Started outside Headlamp, so it cannot be stopped from here">
            external
          </Chip>
          {entry.alive ? (
            <a href={entry.url} target="_blank" rel="noopener noreferrer" style={{ ...CLIP, ...NUMERIC, fontSize: '12px', fontFamily: MONO, color: C.link }}>
              {entry.url.replace(/^https?:\/\//, '')}
            </a>
          ) : (
            <span style={{ ...CLIP, ...NUMERIC, fontSize: '12px', fontFamily: MONO, color: C.textDimmer }}>
              localhost:{entry.port} · not responding
            </span>
          )}
          <span style={{ flex: 1 }} />
          {entry.alive && (
            <a href={entry.url} target="_blank" rel="noopener noreferrer" className="evo-openlink" style={{ ...small, color: C.gold }}>
              <OpenIcon />
              <span>Open</span>
            </a>
          )}
          <button type="button" onClick={() => remove(entry.port)} title="Stop tracking this port" style={small}>
            Forget
          </button>
        </div>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', color: C.textDimmer }}>Forward started elsewhere?</span>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              submit();
            }
          }}
          placeholder="port"
          aria-label="Add a port forwarded outside Headlamp"
          style={{
            ...NUMERIC,
            width: '72px',
            height: '24px',
            padding: '0 8px',
            borderRadius: '6px',
            border: `1px solid ${C.border}`,
            background: C.control,
            color: C.text,
            fontFamily: MONO,
            fontSize: '11.5px',
            outline: 0,
          }}
        />
        <button type="button" onClick={submit} disabled={!draft} style={{ ...small, opacity: draft ? 1 : 0.5 }}>
          Track
        </button>
        <button
          type="button"
          onClick={async () => {
            const found = await scan();
            setScanNote(found === 0 ? 'Nothing found on the usual ports' : `Found ${found}`);
            setTimeout(() => setScanNote(null), 4000);
          }}
          disabled={scanning}
          style={{ ...small, cursor: scanning ? 'progress' : 'pointer' }}
        >
          {scanning ? 'Scanning…' : 'Scan common ports'}
        </button>
        {scanNote && <span style={{ fontSize: '11px', color: C.textMuted }}>{scanNote}</span>}
      </div>
    </>
  );
}
