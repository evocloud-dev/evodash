/**
 * The schema list view.
 *
 * Built on the generic {@link DataTable} rather than a hand-rolled grid: the
 * catalog's table predates that helper and carries its own tracks, but there is
 * no reason for a second one to. Nothing here decides layout — only which
 * columns exist and what goes in them.
 *
 * No group column: the section heading above the table already names the API
 * group, and repeating it down every row would spend the widest column on the
 * one value that cannot vary.
 */
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { EvoCloudPalette } from '../../palette';
import { age, Chip, CLIP, Column, DataTable, Mono, NUMERIC, Pill } from '../../ui/chrome';
import { SchemaView } from './model';

export function SchemaTable({
  C,
  schemas,
  href,
}: {
  C: EvoCloudPalette;
  schemas: SchemaView[];
  href: (schema: SchemaView) => string;
}) {
  const columns: Column<SchemaView>[] = [
    {
      key: 'kind',
      label: 'Kind',
      width: 'minmax(150px, 1.4fr)',
      render: s => (
        <RouterLink to={href(s)} style={{ ...CLIP, fontSize: '13px', fontWeight: 600 }}>
          {s.kind}
        </RouterLink>
      ),
    },
    {
      key: 'version',
      label: 'Version',
      width: 'minmax(84px, 120px)',
      render: s => (
        <>
          <Mono C={C}>{s.version}</Mono>
          {s.storage && (
            <Chip C={C} title="The version objects are persisted as">
              storage
            </Chip>
          )}
        </>
      ),
    },
    {
      key: 'scope',
      label: 'Scope',
      width: '108px',
      // One tone for both scopes — see the note in SchemaCard.tsx.
      render: s => (
        <Pill fg={C.accent} bg={C.accentSoft} border={C.accentBorder}>
          {s.namespaced ? 'Namespaced' : 'Cluster'}
        </Pill>
      ),
    },
    {
      key: 'shortNames',
      label: 'Short names',
      width: 'minmax(110px, 1fr)',
      render: s =>
        s.shortNames.length > 0 ? (
          <>
            {s.shortNames.map(short => (
              <Chip C={C} key={short} title={`kubectl get ${short}`}>
                {short}
              </Chip>
            ))}
          </>
        ) : (
          <Mono C={C} color={C.textDimmer}>
            —
          </Mono>
        ),
    },
    {
      key: 'fields',
      label: 'Fields',
      width: '76px',
      align: 'right',
      render: s => (
        <span style={{ ...NUMERIC, fontSize: '12px', color: C.textMuted }}>{s.fieldCount}</span>
      ),
    },
    {
      key: 'age',
      label: 'Installed',
      width: '84px',
      align: 'right',
      render: s => (
        <Mono C={C} title={s.created ?? undefined}>
          {age(s.created)}
        </Mono>
      ),
    },
  ];

  return <DataTable C={C} columns={columns} rows={schemas} rowKey={s => s.key} />;
}
