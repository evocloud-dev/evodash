/**
 * One application in full, for the side panel.
 *
 * The card can only afford a name, a URL and a count; this is the same app with
 * nothing elided — every property it declares, how its link was arrived at, and
 * which of the three discovery mechanisms put it in the catalog.
 *
 * Owns no data and fetches nothing: it renders the {@link AppView} the list
 * already built, which is why opening the panel costs no request.
 */
import React from 'react';
import { LINK_LABEL, SOURCE_LABEL } from '../../k8s/publishedApp';
import { EvoCloudPalette } from '../../palette';
import { Chip, CopyButton, MONO, OpenButton, RemoteIcon } from '../../ui/chrome';
import { accessNote, AppView, linkTone, metaTone } from './model';

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
      <span style={{ fontSize: '12.5px', color: C.textValue, minWidth: 0, overflowWrap: 'anywhere' }}>
        {children}
      </span>
    </>
  );
}

function Heading({ C, children }: { C: EvoCloudPalette; children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '9.5px',
        fontWeight: 700,
        letterSpacing: '0.11em',
        textTransform: 'uppercase',
        color: C.textFaint,
        margin: '18px 0 8px',
      }}
    >
      {children}
    </div>
  );
}

export function AppDetail({ C, app }: { C: EvoCloudPalette; app: AppView }) {
  const url = app.link.url;
  // Properties the app declared, as opposed to the rows the catalog derives.
  const declared = app.meta.filter(r => r.kind === 'plain');
  const derived = app.meta.filter(r => r.kind !== 'plain');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '13px' }}>
        <RemoteIcon C={C} src={app.icon} name={app.name} size={44} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
            <Chip C={C}>{app.ns}</Chip>
            <Chip C={C} title={`Discovered from ${SOURCE_LABEL[app.source]}`}>
              {SOURCE_LABEL[app.source]}
            </Chip>
            <Chip C={C}>{app.group}</Chip>
          </div>
        </div>
      </div>

      {url ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '14px',
            padding: '9px 10px',
            border: `1px solid ${C.border}`,
            borderRadius: '8px',
            background: C.surfaceSunken,
          }}
        >
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: '12.5px',
              fontFamily: MONO,
              color: C.link,
              overflowWrap: 'anywhere',
            }}
          >
            {url}
          </a>
          <CopyButton C={C} value={url} label={app.name} />
          <OpenButton C={C} href={url} label={app.name} />
        </div>
      ) : (
        <div
          style={{
            marginTop: '14px',
            fontSize: '12px',
            fontFamily: MONO,
            color: linkTone(C, app.link.state),
          }}
        >
          {LINK_LABEL[app.link.state]}
        </div>
      )}

      <div style={{ marginTop: '10px', fontSize: '12px', color: C.textDimmer }}>
        {accessNote(app)}
      </div>

      {declared.length > 0 && (
        <>
          <Heading C={C}>Properties</Heading>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '6px 16px',
              alignItems: 'baseline',
            }}
          >
            {declared.map(row => (
              <Row key={row.k} C={C} label={row.k}>
                {row.v}
              </Row>
            ))}
          </div>
        </>
      )}

      <Heading C={C}>Catalog</Heading>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '6px 16px',
          alignItems: 'baseline',
        }}
      >
        {derived.map(row => {
          const tone = metaTone(C, row, app);
          return (
            <Row key={row.k} C={C} label={row.k}>
              <span style={{ color: tone ?? C.textValue, fontFamily: tone ? MONO : undefined }}>
                {row.v}
              </span>
            </Row>
          );
        })}
        {app.link.note && (
          <Row C={C} label="note">
            {app.link.note}
          </Row>
        )}
      </div>
    </div>
  );
}
