/**
 * One schema version as a card in the grid view.
 *
 * Header, action footer, and a properties panel that opens on demand — the same
 * three parts as appEndpoints/AppCard.tsx, because it is the same gesture over
 * different data.
 *
 * The card is no longer one big link. It cannot be: the disclosure control is a
 * button, and a button inside an anchor is invalid markup that navigates when
 * you click it. So the kind is the link and the footer carries the actions,
 * which is how the application card already worked.
 */
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { EvoCloudPalette } from '../../palette';
import { ChevronIcon, Chip, CLIP, MONO, NUMERIC, Pill } from '../../ui/chrome';
import { metaTone, SchemaView, scopeNote } from './model';

/** "Go to this page", as opposed to chrome's OpenIcon, which leaves Headlamp. */
const ArrowIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h13" />
    <path d="M12.5 6.5 19 12l-6.5 5.5" />
  </svg>
);

export function SchemaCard({
  C,
  schema,
  href,
  expanded,
  onToggle,
}: {
  C: EvoCloudPalette;
  schema: SchemaView;
  href: string;
  expanded: boolean;
  onToggle: () => void;
}) {
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '7px',
          padding: '13px 14px 12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <RouterLink
            to={href}
            className="evo-navcard-title"
            style={{ ...CLIP, fontSize: '14px', fontWeight: 700, minWidth: 0, color: C.text }}
          >
            {schema.kind}
          </RouterLink>
          <span style={{ flex: 1 }} />
          {/*
            One tone for both scopes. The word in the pill already says which
            it is, so colouring them apart was spending the loudest signal on
            the page to repeat a label — and "Cluster" in gold read as a
            warning about something that is only a different scope.
          */}
          <Pill
            fg={C.accent}
            bg={C.accentSoft}
            border={C.accentBorder}
            title={
              schema.namespaced
                ? 'Lives in a namespace'
                : 'Cluster-scoped — no namespace on the manifest'
            }
          >
            {schema.namespaced ? 'Namespaced' : 'Cluster'}
          </Pill>
        </div>

        <span style={{ ...CLIP, fontSize: '11.5px', fontFamily: MONO, color: C.textMuted }}>
          {schema.group}/{schema.version}
        </span>
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
        {/*
          Only the marks that change which version you should be writing
          against stay on the face. The short names and categories moved into
          the panel below — they were the reason this footer wrapped to two
          lines on a CRD with three of them.
        */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <span style={{ ...NUMERIC, fontSize: '11.5px', fontFamily: MONO, color: C.textDimmer }}>
            {schema.fieldCount} fields
          </span>
          {schema.storage && (
            <Chip C={C} title="The version objects are persisted as">
              storage
            </Chip>
          )}
          {!schema.served && (
            <Chip C={C} title="Not served by the API server — kept only for stored objects">
              not served
            </Chip>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 'none' }}>
          <button
            type="button"
            className="evo-iconbtn"
            onClick={onToggle}
            title="Show details"
            aria-expanded={expanded}
            aria-label={`Show details for ${schema.kind} ${schema.version}`}
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
            <span style={{ ...NUMERIC, minWidth: '13px', textAlign: 'right' }}>
              {schema.meta.length}
            </span>
            <ChevronIcon open={expanded} />
          </button>
          <RouterLink
            to={href}
            className="evo-openlink"
            title="Open schema"
            aria-label={`Open the ${schema.kind} ${schema.version} schema`}
            style={{
              width: '26px',
              height: '26px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              color: C.textDim,
            }}
          >
            <ArrowIcon />
          </RouterLink>
        </div>
      </div>

      {expanded && (
        <div
          style={{
            borderTop: `1px solid ${C.divider}`,
            background: C.surfaceDeep,
            padding: '11px 12px 12px',
          }}
        >
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
            Definition
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '5px 14px',
              alignItems: 'baseline',
            }}
          >
            {schema.meta.map(row => {
              const tone = metaTone(C, row, schema);
              return (
                <React.Fragment key={row.k}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontFamily: MONO,
                      color: C.textDim,
                      whiteSpace: 'nowrap',
                    }}
                  >
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
          <div
            style={{
              marginTop: '9px',
              paddingTop: '9px',
              borderTop: `1px dashed ${C.divider}`,
              fontSize: '11px',
              color: C.textDimmer,
            }}
          >
            {scopeNote(schema)}
          </div>
        </div>
      )}
    </div>
  );
}
