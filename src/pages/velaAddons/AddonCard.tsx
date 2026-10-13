/**
 * One addon as a card, for the catalog grid.
 *
 * Owns no data: everything comes from the {@link AddonView} handed to it. The
 * card answers three things at a glance — what the addon is, whether this
 * cluster has it, and whether what it has is current — and leaves the rest to
 * the detail panel.
 */
import React from 'react';
import { EvoCloudPalette } from '../../palette';
import { Chip, CLIP, MONO, Pill, RemoteIcon } from '../../ui/chrome';
import { AddonView } from './model';

/** Two lines of description, then an ellipsis — cards must stay the same height. */
const CLAMP: React.CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

export function AddonCard({
  C,
  addon,
  onOpen,
}: {
  C: EvoCloudPalette;
  addon: AddonView;
  onOpen?: () => void;
}) {
  const installed = addon.installed;

  return (
    <div
      className="evo-card"
      {...(onOpen
        ? {
            role: 'button' as const,
            tabIndex: 0,
            onClick: onOpen,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen();
              }
            },
            title: `Open ${addon.name}`,
          }
        : {})}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '14px',
        background: C.surface,
        border: `1px solid ${addon.updateAvailable ? C.goldBorder : C.border}`,
        borderRadius: '10px',
        cursor: onOpen ? 'pointer' : undefined,
        transition: 'border-color 140ms ease, background 140ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
        <RemoteIcon C={C} src={addon.icon} name={addon.name} size={38} />
        <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <span style={{ ...CLIP, fontSize: '14.5px', fontWeight: 600, letterSpacing: '-0.005em' }}>
            {addon.name}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            {installed ? (
              <Pill
                fg={C.healthy}
                bg={C.healthySoft}
                border={C.healthyBorder}
                title={`Installed as the application ${installed.application} in ${installed.namespace}`}
              >
                installed{installed.version ? ` ${installed.version}` : ''}
              </Pill>
            ) : (
              <span style={{ fontSize: '11px', fontFamily: MONO, color: C.textDimmer }}>
                {addon.latest ?? 'not published'}
              </span>
            )}
            {addon.updateAvailable && (
              <Pill
                fg={C.gold}
                bg={C.goldSoft}
                border={C.goldBorder}
                title={`The registry publishes ${addon.latest}`}
              >
                {addon.latest} available
              </Pill>
            )}
          </div>
        </div>
      </div>

      <p
        style={{
          ...CLAMP,
          margin: 0,
          minHeight: '32px',
          fontSize: '12.5px',
          lineHeight: 1.35,
          color: addon.description ? C.textMuted : C.textDimmer,
        }}
        title={addon.description}
      >
        {addon.description ??
          (addon.catalog
            ? 'No description published.'
            : 'Installed on this cluster, and not listed by any configured registry.')}
      </p>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexWrap: 'wrap',
          paddingTop: '10px',
          borderTop: `1px solid ${C.dividerSoft}`,
          minWidth: 0,
        }}
      >
        {addon.tags.slice(0, 3).map(tag => (
          <Chip C={C} key={tag}>
            {tag}
          </Chip>
        ))}
        {addon.tags.length > 3 && (
          <span
            style={{ fontSize: '11px', fontFamily: MONO, color: C.textDimmer }}
            title={addon.tags.join(', ')}
          >
            +{addon.tags.length - 3}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {addon.registry && (
          <span
            style={{ fontSize: '10.5px', fontFamily: MONO, color: C.textFaint }}
            title={`Published by the ${addon.registry} registry`}
          >
            {addon.registry}
          </span>
        )}
      </div>
    </div>
  );
}
