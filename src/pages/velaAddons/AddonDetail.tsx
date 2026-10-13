/**
 * One addon in full, for the side panel.
 *
 * The card says what an addon is and whether the cluster has it. This adds what
 * you would want before installing one: the whole description, every published
 * version, what it needs of KubeVela, and where it came from.
 *
 * It ends with the command rather than a button, and that is deliberate. An
 * addon is installed by rendering its CUE against the parameters you chose,
 * which needs a CUE evaluator — a thing that does not exist inside a browser
 * tab. Handing over the exact command is the honest version of the feature; a
 * button that could not finish the job would not be.
 */
import React from 'react';
import { EvoCloudPalette } from '../../palette';
import { age, Chip, CLIP, CopyButton, MONO, Mono, Pill, RemoteIcon } from '../../ui/chrome';
import { AddonView } from './model';

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
      <span
        style={{ fontSize: '12.5px', color: C.textValue, minWidth: 0, overflowWrap: 'anywhere' }}
      >
        {children}
      </span>
    </>
  );
}

const GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: '6px 14px',
  alignItems: 'baseline',
};

export function AddonDetail({ C, addon }: { C: EvoCloudPalette; addon: AddonView }) {
  const installed = addon.installed;
  const command = `vela addon enable ${addon.name}`;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '13px' }}>
        <RemoteIcon C={C} src={addon.icon} name={addon.name} size={44} />
        <div style={{ minWidth: 0, flex: 1, display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
          {installed ? (
            <Pill fg={C.healthy} bg={C.healthySoft} border={C.healthyBorder}>
              installed{installed.version ? ` ${installed.version}` : ''}
            </Pill>
          ) : (
            <Pill fg={C.textDimmer} bg={C.chip} border={C.border}>
              not installed
            </Pill>
          )}
          {addon.updateAvailable && (
            <Pill fg={C.gold} bg={C.goldSoft} border={C.goldBorder}>
              {addon.latest} available
            </Pill>
          )}
          {addon.registry && <Chip C={C}>{addon.registry}</Chip>}
        </div>
      </div>

      {addon.description && (
        <p style={{ margin: '14px 0 0', fontSize: '13px', lineHeight: 1.5, color: C.textMuted }}>
          {addon.description}
        </p>
      )}

      {addon.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
          {addon.tags.map(tag => (
            <Chip C={C} key={tag}>
              {tag}
            </Chip>
          ))}
        </div>
      )}

      <Heading C={C}>Addon</Heading>
      <div style={GRID}>
        <Row C={C} label="latest">
          {addon.latest ?? 'no registry carries this addon'}
        </Row>
        {addon.requires && (
          <Row C={C} label="needs">
            KubeVela {addon.requires}
          </Row>
        )}
        {addon.versionCount > 0 && (
          <Row C={C} label="versions">
            {addon.versionCount} published
          </Row>
        )}
        {addon.home && (
          <Row C={C} label="home">
            <a
              href={addon.home}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: C.link, overflowWrap: 'anywhere' }}
            >
              {addon.home}
            </a>
          </Row>
        )}
      </div>

      {installed && (
        <>
          <Heading C={C}>On this cluster</Heading>
          <div style={GRID}>
            <Row C={C} label="version">
              {installed.version ?? 'unrecorded'}
            </Row>
            <Row C={C} label="application">
              {installed.application}
            </Row>
            <Row C={C} label="namespace">
              {installed.namespace}
            </Row>
            {installed.registry && (
              <Row C={C} label="from">
                {installed.registry}
              </Row>
            )}
          </div>
        </>
      )}

      {addon.catalog && addon.catalog.versions.length > 0 && (
        <>
          <Heading C={C}>Published versions</Heading>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {addon.catalog.versions.map(version => {
              const here = installed?.version
                ? version.version.replace(/^v/i, '') === installed.version.replace(/^v/i, '')
                : false;
              return (
                <div
                  key={version.version}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                    padding: '7px 0',
                    borderTop: `1px solid ${C.dividerSoft}`,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      ...CLIP,
                      fontSize: '12.5px',
                      fontFamily: MONO,
                      fontWeight: here ? 700 : 400,
                      color: here ? C.healthy : C.textValue,
                      minWidth: 0,
                    }}
                  >
                    {version.version}
                  </span>
                  {here && (
                    <Pill fg={C.healthy} bg={C.healthySoft} border={C.healthyBorder}>
                      installed
                    </Pill>
                  )}
                  <span style={{ flex: 1 }} />
                  {version.requires && (
                    <Mono C={C} color={C.textDimmer} title={`Needs KubeVela ${version.requires}`}>
                      vela {version.requires}
                    </Mono>
                  )}
                  <Mono C={C} color={C.textDimmer} title={version.created ?? undefined}>
                    {age(version.created)}
                  </Mono>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Heading C={C}>{installed ? 'Reinstall or change settings' : 'Install'}</Heading>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '9px 10px',
          background: C.surfaceSunken,
          border: `1px solid ${C.border}`,
          borderRadius: '8px',
        }}
      >
        <code style={{ ...CLIP, flex: 1, fontFamily: MONO, fontSize: '12px', color: C.textValue }}>
          {command}
        </code>
        <CopyButton C={C} value={command} label={addon.name} what="command" />
      </div>
      <p style={{ margin: '8px 0 0', fontSize: '11.5px', lineHeight: 1.5, color: C.textDimmer }}>
        Add <code style={{ fontFamily: MONO }}>--help</code> to that command to see the settings
        this addon accepts. Installing runs the addon&apos;s own templates, which needs the CLI —
        this page reads the catalog, it does not install from it.
      </p>
    </div>
  );
}
