/**
 * The shared furniture of a list page: one hook for how the list is arranged,
 * and one toolbar to change it.
 *
 * The standard for every page that lists things:
 *
 * - The page header holds what to show: search and filters.
 * - The toolbar above the list holds how to show it: how many match (and a way
 *   to clear the filters), group by, sort by, export, and cards or table.
 *
 * View, sort and grouping are remembered per page in this browser, so a page
 * opens the way it was left. Filters and search are not: a list that opens
 * already filtered looks like a list with things missing from it.
 */
import React from 'react';
import { EvoCloudPalette } from '../palette';
import { FilterSelect, GhostButton, NUMERIC, ViewToggle } from './chrome';
import {
  ExportField,
  exportFileName,
  GroupField,
  groupRows,
  nextSort,
  NO_GROUP,
  RowGroup,
  SortField,
  sortRows,
  SortState,
  toCsv,
  toJson,
} from './listModel';

export type ViewMode = 'grid' | 'list';

const STORAGE_PREFIX = 'evocloud.list.';

interface Remembered {
  view?: ViewMode;
  sort?: SortState;
  group?: string;
}

function readRemembered(id: string): Remembered {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + id);
    return raw ? (JSON.parse(raw) as Remembered) : {};
  } catch {
    // Storage blocked or the entry is not ours: start from the defaults.
    return {};
  }
}

function writeRemembered(id: string, value: Remembered) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(value));
  } catch {
    // Not remembering is fine; the list still works.
  }
}

export interface ListView<R> {
  view: ViewMode;
  setView: (v: ViewMode) => void;
  sort: SortState;
  setSort: (s: SortState) => void;
  /** For a sortable table header: the same column flips, another starts fresh. */
  sortBy: (key: string) => void;
  group: string;
  setGroup: (g: string) => void;
  /** The rows, sorted. */
  sorted: R[];
  /** The sorted rows in groups; one unnamed group when grouping is off. */
  groups: RowGroup<R>[];
  grouped: boolean;
}

export function useListView<R>({
  id,
  rows,
  sortFields,
  groupFields = [],
  defaultSort,
  defaultView = 'grid',
  defaultGroup = NO_GROUP,
}: {
  /** Names the page in storage. */
  id: string;
  rows: R[];
  sortFields: SortField<R>[];
  groupFields?: GroupField<R>[];
  defaultSort: SortState;
  defaultView?: ViewMode;
  /** A group field's key, for a page that has always been grouped. */
  defaultGroup?: string;
}): ListView<R> {
  const [state, setState] = React.useState<Required<Remembered>>(() => {
    const saved = readRemembered(id);
    const sortOk = saved.sort && sortFields.some(f => f.key === saved.sort?.key);
    const groupOk = saved.group === NO_GROUP || groupFields.some(f => f.key === saved.group);
    return {
      view: saved.view === 'grid' || saved.view === 'list' ? saved.view : defaultView,
      sort: sortOk && saved.sort ? saved.sort : defaultSort,
      group: groupOk && saved.group ? saved.group : defaultGroup,
    };
  });

  const update = (patch: Remembered) =>
    setState(s => {
      const next = { ...s, ...patch };
      writeRemembered(id, next);
      return next;
    });

  const sortField = sortFields.find(f => f.key === state.sort.key);
  const groupField = groupFields.find(f => f.key === state.group);
  const sorted = React.useMemo(
    () => sortRows(rows, sortField, state.sort.dir),
    [rows, sortField, state.sort.dir]
  );
  const groups = React.useMemo(() => groupRows(sorted, groupField), [sorted, groupField]);

  return {
    view: state.view,
    setView: view => update({ view }),
    sort: state.sort,
    setSort: sort => update({ sort }),
    sortBy: key => {
      const field = sortFields.find(f => f.key === key);
      if (field) {
        update({ sort: nextSort(state.sort, field) });
      }
    },
    group: state.group,
    setGroup: group => update({ group }),
    sorted,
    groups,
    grouped: !!groupField,
  };
}

/* ----------------------------------------------------------------- export */

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // After the click has handed the file to the browser.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function DownloadIcon({ stroke }: { stroke: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 4v11" />
      <polyline points="7 10.5 12 15.5 17 10.5" />
      <path d="M4.5 19.5h15" />
    </svg>
  );
}

/** Downloads what the list shows, after filters and sorting, as CSV or JSON. */
export function ExportMenu<R>({
  C,
  name,
  rows,
  fields,
}: {
  C: EvoCloudPalette;
  /** What the list is called; names the file. */
  name: string;
  rows: R[];
  fields: ExportField<R>[];
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const save = (ext: 'csv' | 'json') => {
    const file = exportFileName(name, ext);
    if (ext === 'csv') {
      download(file, toCsv(rows, fields), 'text/csv;charset=utf-8');
    } else {
      download(file, toJson(rows, fields), 'application/json');
    }
    setOpen(false);
  };

  const item: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '7px 12px',
    background: 'transparent',
    border: 0,
    textAlign: 'left',
    color: C.text,
    fontFamily: 'inherit',
    fontSize: '12.5px',
    cursor: 'pointer',
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <GhostButton
        C={C}
        onClick={() => setOpen(o => !o)}
        title={`Download the ${rows.length} shown as a file`}
        active={open}
      >
        <DownloadIcon stroke={open ? C.gold : C.textDim} />
        Export
      </GhostButton>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 4px)',
            zIndex: 20,
            minWidth: '150px',
            padding: '4px 0',
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: '8px',
            boxShadow: '0 6px 18px rgba(0,0,0,0.28)',
          }}
        >
          <button
            type="button"
            role="menuitem"
            className="evo-row"
            style={item}
            onClick={() => save('csv')}
          >
            CSV (spreadsheet)
          </button>
          <button
            type="button"
            role="menuitem"
            className="evo-row"
            style={item}
            onClick={() => save('json')}
          >
            JSON
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- toolbar */

function SortDirButton({
  C,
  dir,
  onClick,
}: {
  C: EvoCloudPalette;
  dir: 'asc' | 'desc';
  onClick: () => void;
}) {
  const label = dir === 'asc' ? 'Ascending' : 'Descending';
  return (
    <GhostButton
      C={C}
      onClick={onClick}
      title={`${label}. Click to reverse`}
      ariaLabel={`Sort direction: ${label.toLowerCase()}`}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke={C.textDim}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transform: dir === 'desc' ? 'scaleY(-1)' : undefined }}
        aria-hidden
      >
        <path d="M12 19V5" />
        <polyline points="6 11 12 5 18 11" />
      </svg>
    </GhostButton>
  );
}

/**
 * The row above a list: how many match, then group, sort, export and view.
 *
 * Leave out `groupFields` or `exportFields` for a list that has none; the
 * controls for them are not drawn.
 */
export function ListToolbar<R>({
  C,
  list,
  shown,
  total,
  noun,
  onClearFilters,
  sortFields,
  groupFields = [],
  exportFields,
  exportName,
  filters,
}: {
  C: EvoCloudPalette;
  list: ListView<R>;
  shown: number;
  total: number;
  /** Plural, lower case: "applications". */
  noun: string;
  /** Given when filters or search are active. */
  onClearFilters?: () => void;
  sortFields: SortField<R>[];
  groupFields?: GroupField<R>[];
  exportFields?: ExportField<R>[];
  /** Names the export file, e.g. "KubeVela applications". */
  exportName?: string;
  /**
   * Search and filters, for a list that is one section of a page rather than
   * the whole page. A page-wide list keeps them in the page header instead.
   */
  filters?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
      }}
    >
      <span style={{ ...NUMERIC, fontSize: '12.5px', color: C.textMuted, marginRight: '4px' }}>
        {shown === total ? `${total} ${noun}` : `Showing ${shown} of ${total} ${noun}`}
      </span>
      {onClearFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          style={{
            padding: 0,
            background: 'transparent',
            border: 0,
            color: C.link,
            fontFamily: 'inherit',
            fontSize: '12.5px',
            cursor: 'pointer',
          }}
        >
          Clear filters
        </button>
      )}
      <span style={{ flex: 1 }} />
      {filters}
      {groupFields.length > 0 && (
        <FilterSelect
          C={C}
          value={list.group}
          onChange={list.setGroup}
          label="Group by"
          options={[
            { value: NO_GROUP, label: 'No grouping' },
            ...groupFields.map(f => ({ value: f.key, label: `Group: ${f.label}` })),
          ]}
        />
      )}
      <FilterSelect
        C={C}
        value={list.sort.key}
        onChange={key => {
          const field = sortFields.find(f => f.key === key);
          list.setSort({ key, dir: field?.firstDir ?? 'asc' });
        }}
        label="Sort by"
        options={sortFields.map(f => ({ value: f.key, label: `Sort: ${f.label}` }))}
      />
      <SortDirButton
        C={C}
        dir={list.sort.dir}
        onClick={() =>
          list.setSort({ key: list.sort.key, dir: list.sort.dir === 'asc' ? 'desc' : 'asc' })
        }
      />
      {exportFields && exportName && (
        <ExportMenu C={C} name={exportName} rows={list.sorted} fields={exportFields} />
      )}
      <ViewToggle C={C} value={list.view} onChange={list.setView} />
    </div>
  );
}
