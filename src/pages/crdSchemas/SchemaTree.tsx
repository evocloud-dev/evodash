/**
 * The field tree of one schema version.
 *
 * Rendered as a flat list of indented rows rather than nested containers: a
 * schema is deep — Gateway API reaches eight levels — and nesting a bordered box
 * per level would spend most of the width on frames instead of on field names.
 * Indentation carries the depth and the rows stay full width.
 *
 * Children are only rendered while their parent is open. A CRD like FluxInstance
 * or HTTPRoute is thousands of fields; mounting all of them so that a chevron
 * can hide them again is the difference between a page that opens instantly and
 * one that stalls.
 */
import React from 'react';
import { SchemaField } from '../../k8s/crdSchema';
import { EvoCloudPalette } from '../../palette';
import { ChevronIcon, Chip, CLIP, MONO, Pill } from '../../ui/chrome';

/** Beyond this the indent eats the row, so deeper levels stop stepping right. */
const MAX_INDENT_DEPTH = 8;
const INDENT = 17;

/** Enum values past this are counted rather than listed. */
const ENUM_SHOWN = 6;

export interface SchemaTreeProps {
  C: EvoCloudPalette;
  fields: SchemaField[];
  /** True when the node at this path should show its children. */
  isOpen: (path: string) => boolean;
  onToggle: (path: string) => void;
}

export function SchemaTree({ C, fields, isOpen, onToggle }: SchemaTreeProps) {
  const rows: React.ReactNode[] = [];

  const walk = (list: SchemaField[], depth: number) => {
    for (const field of list) {
      const open = field.children.length > 0 && isOpen(field.path);
      rows.push(
        <FieldRow
          key={field.path}
          C={C}
          field={field}
          depth={depth}
          open={open}
          onToggle={() => onToggle(field.path)}
        />
      );
      if (open) {
        walk(field.children, depth + 1);
      }
    }
  };
  walk(fields, 0);

  return <div>{rows}</div>;
}

function FieldRow({
  C,
  field,
  depth,
  open,
  onToggle,
}: {
  C: EvoCloudPalette;
  field: SchemaField;
  depth: number;
  open: boolean;
  onToggle: () => void;
}) {
  const hasChildren = field.children.length > 0;
  const indent = Math.min(depth, MAX_INDENT_DEPTH) * INDENT;

  return (
    <div
      className="evo-row"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '9px',
        padding: '7px 14px 7px 0',
        paddingLeft: `${14 + indent}px`,
        borderBottom: `1px solid ${C.dividerSoft}`,
        transition: 'background 120ms ease',
      }}
    >
      {hasChildren ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${field.path}`}
          title={field.path}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '16px',
            height: '18px',
            flex: 'none',
            padding: 0,
            border: 0,
            background: 'transparent',
            color: C.textDim,
            cursor: 'pointer',
          }}
        >
          <ChevronIcon open={open} />
        </button>
      ) : (
        // Keeps leaf names on the same left edge as their siblings' names.
        <span style={{ width: '16px', flex: 'none' }} />
      )}

      <span
        title={field.path}
        style={{
          ...CLIP,
          flex: 'none',
          maxWidth: '30ch',
          fontFamily: MONO,
          fontSize: '12.5px',
          fontWeight: 600,
          color: C.text,
          lineHeight: '18px',
        }}
      >
        {field.name}
      </span>

      <span style={{ flex: 'none' }}>
        <Pill fg={C.accent} bg={C.accentSoft} border={C.accentBorder} title={`Type: ${field.type}`}>
          <span style={{ fontFamily: MONO }}>{field.type}</span>
        </Pill>
      </span>

      {field.required && (
        <span style={{ flex: 'none' }}>
          <Pill
            fg={C.accent}
            bg={C.accentSoft}
            border={C.accentBorder}
            title="Listed in the parent's required fields"
          >
            required
          </Pill>
        </span>
      )}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {field.description && (
          <div style={{ fontSize: '12px', lineHeight: 1.55, color: C.textMuted }}>
            {field.description}
          </div>
        )}
        <Constraints C={C} field={field} />
      </div>
    </div>
  );
}

/**
 * The parts of a schema that change what you are allowed to write.
 *
 * Only these three: they are the ones that turn a valid-looking manifest into a
 * rejected one, or that tell you what the API server will fill in if you leave
 * the field out. The rest of OpenAPI's vocabulary belongs in the raw view.
 */
function Constraints({ C, field }: { C: EvoCloudPalette; field: SchemaField }) {
  const shown = field.enumValues.slice(0, ENUM_SHOWN);
  const rest = field.enumValues.length - shown.length;

  if (shown.length === 0 && field.defaultValue === undefined && !field.format) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
      {field.format && <Chip C={C}>format: {field.format}</Chip>}
      {field.defaultValue !== undefined && <Chip C={C}>default: {field.defaultValue}</Chip>}
      {shown.length > 0 && (
        <>
          <span style={{ fontSize: '10.5px', color: C.textFaint }}>one of</span>
          {shown.map(value => (
            <Chip C={C} key={value}>
              {value}
            </Chip>
          ))}
          {rest > 0 && (
            <span
              style={{ fontSize: '10.5px', color: C.textFaint }}
              title={field.enumValues.join(', ')}
            >
              +{rest} more
            </span>
          )}
        </>
      )}
    </div>
  );
}
