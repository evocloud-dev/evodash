/**
 * The schema list view.
 *
 * Built on the generic {@link DataTable} rather than a hand-rolled grid: the
 * catalog's table predates that helper and carries its own tracks, but there is
 * no reason for a second one to. Nothing here decides layout — only which
 * columns exist and what goes in them.
 *
 * The API group column appears only when the list is not grouped by API group:
 * under a group heading that already names it, repeating it down every row
 * would spend the widest column on the one value that cannot vary.
 */
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { EvoCloudPalette } from '../../palette';
import {
  age,
  Chip,
  CLIP,
  Column,
  DataTable,
  Mono,
  NUMERIC,
  openInPanel,
  Pill,
} from '../../ui/chrome';
import { SchemaView } from './model';

export function SchemaTable({
  C,
  schemas,
  href,
  onOpen,
  showGroup = false,
  sort,
  onSort,
  sortable,
}: {
  C: EvoCloudPalette;
  schemas: SchemaView[];
  href: (schema: SchemaView) => string;
  /**
   * Given, a plain click anywhere on a row (the kind link included) opens the
   * side panel. The kind stays a real link, so ctrl/cmd-click still opens the
   * full page in a new tab.
   */
  onOpen?: (schema: SchemaView) => void;
  /** Adds an API group column, for a list not grouped under API group headings. */
  showGroup?: boolean;
  sort?: { key: string; dir: 'asc' | 'desc' };
  onSort?: (key: string) => void;
  sortable?: string[];
}) {
  const groupColumn: Column<SchemaView> = {
    key: 'group',
    label: 'API group',
    width: 'minmax(140px, 1.1fr)',
    render: s => (
      <Mono C={C} color={C.textMuted} title={s.group}>
        {s.group}
      </Mono>
    ),
  };

  const columns: Column<SchemaView>[] = [
    {
      key: 'kind',
      label: 'Kind',
      width: 'minmax(150px, 1.4fr)',
      render: s => (
        <RouterLink
          to={href(s)}
          onClick={openInPanel(onOpen && (() => onOpen(s)))}
          style={{ ...CLIP, fontSize: '13px', fontWeight: 600 }}
        >
          {s.kind}
        </RouterLink>
      ),
    },
    ...(showGroup ? [groupColumn] : []),
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

  return (
    <DataTable
      C={C}
      columns={columns}
      rows={schemas}
      rowKey={s => s.key}
      sort={sort}
      onSort={onSort}
      sortable={sortable}
      onRowClick={onOpen}
      rowLabel={s => `${s.kind} ${s.version}`}
    />
  );
}
