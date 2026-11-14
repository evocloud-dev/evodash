/**
 * Every namespace Kyverno has reported on, with how much of it passes.
 *
 * The point is the split it makes visible. On most clusters the failures sit
 * almost entirely in kube-system and the platform's own namespaces, where they
 * are by design, while the workload namespaces are clean — and a cluster-wide
 * total cannot tell those two pictures apart.
 *
 * A namespace with failures opens the by-resource view filtered to it.
 */

import React from 'react';
import { NamespaceTally } from '../../k8s/kyverno';
import { EvoCloudPalette } from '../../palette';
import { CLIP, MONO, NUMERIC } from '../../ui/chrome';
import { SystemMark } from './shared';
import { scoreColor } from './useScanResults';

function tone(C: EvoCloudPalette, n: NamespaceTally): string {
  if (n.failing === 0) {
    return C.healthy;
  }
  // Gold, not red: a system namespace failing Pod Security is expected, and
  // painting it the same as a failing workload would raise the wrong alarm.
  return n.system ? C.gold : scoreColor(C, ((n.resources - n.failing) / n.resources) * 100);
}

export function NamespacePanel({
  C,
  namespaces,
  onSelect,
}: {
  C: EvoCloudPalette;
  namespaces: NamespaceTally[];
  onSelect: (namespace: string | null) => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
        gap: '8px',
        marginBottom: '26px',
      }}
    >
      {namespaces.map(n => {
        const color = tone(C, n);
        const passing = n.resources ? ((n.resources - n.failing) / n.resources) * 100 : 100;
        const name = n.namespace ?? 'cluster-scoped';
        const actionable = n.failing > 0;
        const cell = (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
              <span style={{ ...CLIP, fontSize: '12.5px', fontWeight: 600 }} title={name}>
                {name}
              </span>
              {n.system && <SystemMark C={C} />}
            </span>
            <div
              style={{
                height: '6px',
                borderRadius: '3px',
                background: C.surfaceSunken,
                overflow: 'hidden',
              }}
            >
              <div style={{ width: `${passing}%`, height: '100%', background: color }} />
            </div>
            <span
              style={{
                ...NUMERIC,
                fontSize: '11.5px',
                fontFamily: MONO,
                textAlign: 'right',
                color: n.failing ? color : C.textDimmer,
              }}
            >
              {n.failing} / {n.resources}
            </span>
          </>
        );

        const style: React.CSSProperties = {
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 90px 56px',
          alignItems: 'center',
          gap: '10px',
          padding: '9px 12px',
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: '8px',
          textAlign: 'left',
          color: C.text,
          font: 'inherit',
        };

        return actionable ? (
          <button
            key={name}
            type="button"
            className="evo-card"
            onClick={() => onSelect(n.namespace)}
            title={`${n.failing} of ${n.resources} resources fail a policy — show them`}
            style={{ ...style, cursor: 'pointer' }}
          >
            {cell}
          </button>
        ) : (
          <div key={name} style={style} title={`All ${n.resources} resources pass`}>
            {cell}
          </div>
        );
      })}
    </div>
  );
}
