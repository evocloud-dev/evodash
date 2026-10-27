/**
 * One line on whether Kyverno is up: its version, each controller's replicas,
 * and the webhooks that put it in the path of a request.
 *
 * A strip rather than tiles because it is a precondition, not a result. When
 * it is green it should take no attention; when it is not, everything below it
 * is stale, and the strip is the first thing on the page to say so.
 */

import React from 'react';
import { EvoCloudPalette } from '../../palette';
import { Dot, Mono } from '../../ui/chrome';
import { KyvernoEngine } from './useKyvernoEngine';

export function EngineStrip({ C, engine }: { C: EvoCloudPalette; engine: KyvernoEngine }) {
  if (engine.loading) {
    return null;
  }

  const { controllers, version, webhookConfigs, webhooks } = engine;
  const isUp = (c: { ready: number; desired: number }) => c.desired > 0 && c.ready >= c.desired;
  const down = controllers.filter(c => !isUp(c));

  let state: { color: string; text: string };
  if (controllers.length === 0) {
    // Not proof Kyverno is down: the account may not list Deployments, or an
    // install may label its controllers differently.
    state = { color: C.textDimmer, text: 'Controller status unavailable' };
  } else if (down.length) {
    state = {
      color: C.danger,
      text: `${down.length} controller${
        down.length === 1 ? '' : 's'
      } not ready — results may be stale`,
    };
  } else {
    state = { color: C.healthy, text: 'Kyverno is running' };
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px 18px',
        padding: '10px 14px',
        marginBottom: '12px',
        background: C.surface,
        border: `1px solid ${down.length ? `${C.danger}55` : C.border}`,
        borderRadius: '10px',
        fontSize: '12.5px',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        <Dot color={state.color} size={8} />
        <span style={{ fontWeight: 600 }}>{state.text}</span>
        {version && <Mono C={C}>{version}</Mono>}
      </span>

      {controllers.map(c => (
        <span
          key={c.key}
          title={`${c.namespace}/${c.name} — ${c.ready} of ${c.desired} replicas ready`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: C.textMuted }}
        >
          <Dot color={isUp(c) ? C.healthy : C.danger} />
          {c.label}
          <Mono C={C} color={isUp(c) ? C.textDimmer : C.danger}>
            {c.ready}/{c.desired}
          </Mono>
        </span>
      ))}

      <span style={{ flex: 1 }} />
      <Mono
        C={C}
        title="The admission webhook configurations Kyverno has registered — how it sees each request"
      >
        {webhookConfigs} webhook configs · {webhooks} webhooks
      </Mono>
    </div>
  );
}
