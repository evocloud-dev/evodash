/**
 * The addon catalog as a table, for the list view.
 *
 * Built on the shared {@link DataTable}, like the KubeVela Applications table:
 * this file only decides which columns exist and what goes in them. Headers
 * sort the list through the page's list view.
 */
import React from 'react';
import { EvoCloudPalette } from '../../palette';
import { CLIP, Column, DataTable, Mono, Pill, RemoteIcon } from '../../ui/chrome';
import { SortState } from '../../ui/listModel';
import { AddonView, SORT_FIELDS, statusOf } from './model';

const SORTABLE = SORT_FIELDS.map(f => f.key);
const TAGS_SHOWN = 2;

export function AddonTable({
  C,
  addons,
  onOpen,
  sort,
  onSort,
}: {
  C: EvoCloudPalette;
  addons: AddonView[];
  /** Given, clicking anywhere on a row opens the side panel. */
  onOpen?: (addon: AddonView) => void;
  sort: SortState;
  onSort: (key: string) => void;
}) {
  const columns: Column<AddonView>[] = [
    {
      key: 'name',
      label: 'Addon',
      width: 'minmax(170px, 1.4fr)',
      render: addon => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
          <RemoteIcon C={C} src={addon.icon} name={addon.name} size={22} />
          {/* The whole row opens the panel, so the name is plain text. */}
          <span style={{ ...CLIP, fontSize: '13.5px', fontWeight: 600, minWidth: 0 }}>
            {addon.name}
          </span>
        </div>
      ),
    },
    {
      key: 'state',
      label: 'State',
      width: 'minmax(120px, 140px)',
      render: addon => {
        const status = statusOf(addon);
        if (status === 'Update available') {
          return (
            <Pill fg={C.gold} bg={C.goldSoft} border={C.goldBorder}>
              update available
            </Pill>
          );
        }
        if (status === 'Installed') {
          return (
            <Pill
              fg={C.healthy}
              bg={C.healthySoft}
              border={C.healthyBorder}
              title={
                addon.installed
                  ? `Installed as the application ${addon.installed.application} in ${addon.installed.namespace}`
                  : undefined
              }
            >
              installed
            </Pill>
          );
        }
        return (
          <Mono C={C} color={C.textDimmer}>
            not installed
          </Mono>
        );
      },
    },
    {
      key: 'installed',
      label: 'Installed',
      width: 'minmax(80px, 100px)',
      render: addon => (
        <Mono
          C={C}
          color={addon.installed?.version ? C.textValue : C.textDimmer}
          title={addon.installed?.version}
        >
          {addon.installed?.version ?? '—'}
        </Mono>
      ),
    },
    {
      key: 'latest',
      label: 'Latest',
      width: 'minmax(80px, 100px)',
      render: addon => (
        <Mono
          C={C}
          color={addon.updateAvailable ? C.gold : addon.latest ? C.textValue : C.textDimmer}
          title={
            addon.latest
              ? `${addon.versionCount} ${
                  addon.versionCount === 1 ? 'version' : 'versions'
                } published`
              : 'Not in any configured registry'
          }
        >
          {addon.latest ?? '—'}
        </Mono>
      ),
    },
    {
      key: 'registry',
      label: 'Registry',
      width: 'minmax(100px, 0.8fr)',
      render: addon => (
        <Mono
          C={C}
          color={addon.registry ? C.textMuted : C.textDimmer}
          title={addon.registry ?? 'Installed, but no configured registry lists it'}
        >
          {addon.registry ?? 'not in a catalog'}
        </Mono>
      ),
    },
    {
      key: 'tags',
      label: 'Tags',
      width: 'minmax(140px, 1.2fr)',
      render: addon =>
        addon.tags.length === 0 ? (
          <Mono C={C} color={C.textDimmer}>
            —
          </Mono>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
            {addon.tags.slice(0, TAGS_SHOWN).map(tag => (
              <Pill key={tag} fg={C.accent} bg={C.accentSoft} border={C.accentBorder}>
                {tag}
              </Pill>
            ))}
            {addon.tags.length > TAGS_SHOWN && (
              <Mono C={C} color={C.textDimmer} title={addon.tags.join(', ')}>
                +{addon.tags.length - TAGS_SHOWN}
              </Mono>
            )}
          </div>
        ),
    },
    {
      key: 'requires',
      label: 'Requires',
      width: 'minmax(90px, 0.7fr)',
      render: addon => (
        <Mono
          C={C}
          color={addon.requires ? C.textMuted : C.textDimmer}
          title={addon.requires ? `KubeVela ${addon.requires}` : 'No KubeVela version requirement'}
        >
          {addon.requires ?? '—'}
        </Mono>
      ),
    },
  ];

  return (
    <DataTable
      C={C}
      columns={columns}
      rows={addons}
      rowKey={addon => addon.key}
      sort={sort}
      onSort={onSort}
      sortable={SORTABLE}
      onRowClick={onOpen}
      rowLabel={addon => addon.name}
    />
  );
}
