/**
 * One KubeVela application in full, for the side panel.
 *
 * The row can only afford a name, a status and a count. This is the same
 * application with the parts that matter opened up: what it is made of, what
 * each part was configured with, the workflow that put it there, and the
 * objects that came out the other end.
 *
 * The settings are the reason this page exists. They are arbitrary JSON —
 * whatever each definition declares — so they are drawn from the value's own
 * shape and annotated, where KubeVela has published a schema, with the name and
 * description the definition gave each field. That fetch is the only one the
 * panel makes; everything else is already on the {@link AppView} the list built.
 */
import React from 'react';
import { readyTone } from '../../k8s/conditions';
import {
  ApplicationComponent,
  ApplicationPolicy,
  ApplicationTrait,
  DefinitionScope,
  serviceHealthy,
  ServiceStatus,
  stepState,
  WorkflowStatus,
  WorkflowStepStatus,
} from '../../k8s/kubevela';
import { EvoCloudPalette } from '../../palette';
import { age, Chip, CLIP, Dot, MONO, Mono, Pill } from '../../ui/chrome';
import { AppView, describeValue, settingsOf } from './model';
import { useParameterDocs } from './useParameterDocs';

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
  title,
  children,
}: {
  C: EvoCloudPalette;
  label: React.ReactNode;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <span
        title={title}
        style={{ fontSize: '11px', fontFamily: MONO, color: C.textDim, whiteSpace: 'nowrap' }}
      >
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

/** A value too big for a line: a nested object, a list of them, a script. */
function Block({ C, text }: { C: EvoCloudPalette; text: string }) {
  return (
    <pre
      style={{
        margin: '3px 0 0',
        padding: '8px 10px',
        maxHeight: '220px',
        overflow: 'auto',
        background: C.surfaceSunken,
        border: `1px solid ${C.border}`,
        borderRadius: '7px',
        fontFamily: MONO,
        fontSize: '11px',
        lineHeight: 1.5,
        color: C.textMuted,
        whiteSpace: 'pre',
      }}
    >
      {text}
    </pre>
  );
}

/**
 * The settings of one component, trait or policy.
 *
 * Fetches its own definition schema, so each of these on screen is one request
 * for one ConfigMap — see useParameterDocs.ts for why it is arranged that way.
 */
function Settings({
  C,
  scope,
  type,
  properties,
}: {
  C: EvoCloudPalette;
  scope: DefinitionScope;
  type: string;
  properties?: Record<string, any>;
}) {
  const docs = useParameterDocs(scope, type);
  const settings = settingsOf(properties);

  if (settings.length === 0) {
    return (
      <span style={{ fontSize: '12px', color: C.textDimmer }}>
        No settings — the definition runs on its defaults.
      </span>
    );
  }

  const inline = settings.filter(([, v]) => describeValue(v).shape === 'scalar');
  const blocks = settings.filter(([, v]) => describeValue(v).shape === 'block');

  return (
    <>
      {inline.length > 0 && (
        <div style={GRID}>
          {inline.map(([key, value]) => {
            const doc = docs?.[key];
            return (
              <Row key={key} C={C} label={key} title={doc?.description ?? doc?.title ?? undefined}>
                {describeValue(value).text}
              </Row>
            );
          })}
        </div>
      )}
      {blocks.map(([key, value]) => {
        const doc = docs?.[key];
        return (
          <div key={key} style={{ marginTop: inline.length ? '10px' : 0 }}>
            <span
              title={doc?.description ?? doc?.title ?? undefined}
              style={{ fontSize: '11px', fontFamily: MONO, color: C.textDim }}
            >
              {key}
            </span>
            <Block C={C} text={describeValue(value).text} />
          </div>
        );
      })}
    </>
  );
}

function Card({ C, children }: { C: EvoCloudPalette; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '11px 12px 12px',
        marginBottom: '10px',
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: '9px',
      }}
    >
      {children}
    </div>
  );
}

function TraitCard({
  C,
  trait,
  healthy,
}: {
  C: EvoCloudPalette;
  trait: ApplicationTrait;
  healthy?: boolean;
}) {
  return (
    <div
      style={{
        marginTop: '10px',
        paddingTop: '10px',
        borderTop: `1px solid ${C.dividerSoft}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px' }}>
        {healthy !== undefined && (
          <Dot color={healthy ? C.healthy : C.danger} title={healthy ? 'healthy' : 'not healthy'} />
        )}
        <span style={{ fontSize: '11px', fontFamily: MONO, color: C.textDim }}>trait</span>
        <Pill fg={C.accent} bg={C.accentSoft} border={C.accentBorder}>
          {trait.type}
        </Pill>
      </div>
      <Settings C={C} scope="trait" type={trait.type} properties={trait.properties} />
    </div>
  );
}

function ComponentCard({
  C,
  component,
  service,
}: {
  C: EvoCloudPalette;
  component: ApplicationComponent;
  service?: ServiceStatus;
}) {
  const healthy = service ? serviceHealthy(service) : undefined;
  const workload = service?.workloadDefinition?.kind;

  return (
    <Card C={C}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '9px',
        }}
      >
        {healthy !== undefined && (
          <Dot
            color={healthy ? C.healthy : C.danger}
            title={service?.message ?? (healthy ? 'healthy' : 'not healthy')}
          />
        )}
        <span style={{ ...CLIP, fontSize: '13px', fontWeight: 600, minWidth: 0 }}>
          {component.name}
        </span>
        <Pill fg={C.accent} bg={C.accentSoft} border={C.accentBorder}>
          {component.type}
        </Pill>
        {workload && (
          <Chip C={C} title="The Kubernetes kind this component became">
            {workload}
          </Chip>
        )}
        <span style={{ flex: 1 }} />
        {service?.message && (
          <Mono C={C} color={healthy ? C.textMuted : C.danger} title={service.message}>
            {service.message}
          </Mono>
        )}
      </div>

      <Settings C={C} scope="component" type={component.type} properties={component.properties} />

      {(component.traits ?? []).map((trait, i) => (
        <TraitCard
          key={`${trait.type}/${i}`}
          C={C}
          trait={trait}
          healthy={service?.traits?.find(t => t.type === trait.type)?.healthy}
        />
      ))}
    </Card>
  );
}

function PolicyCard({
  C,
  policy,
  index,
}: {
  C: EvoCloudPalette;
  policy: ApplicationPolicy;
  index: number;
}) {
  return (
    <Card C={C}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '9px',
        }}
      >
        <span style={{ ...CLIP, fontSize: '13px', fontWeight: 600, minWidth: 0 }}>
          {policy.name || `policy ${index + 1}`}
        </span>
        <Pill fg={C.accent} bg={C.accentSoft} border={C.accentBorder}>
          {policy.type}
        </Pill>
      </div>
      <Settings C={C} scope="policy" type={policy.type} properties={policy.properties} />
    </Card>
  );
}

/** "1.4s", "2m" — how long a step took, when both ends were recorded. */
function duration(from?: string, to?: string): string | null {
  if (!from || !to) {
    return null;
  }
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (!Number.isFinite(ms) || ms < 0) {
    return null;
  }
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.round(ms / 60_000)}m`;
}

function Step({
  C,
  step,
  nested = false,
}: {
  C: EvoCloudPalette;
  step: WorkflowStepStatus;
  nested?: boolean;
}) {
  const tone = readyTone(C, stepState(step.phase));
  const took = duration(step.firstExecuteTime, step.lastExecuteTime);

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          padding: '7px 0',
          paddingLeft: nested ? '18px' : 0,
          borderTop: `1px solid ${C.dividerSoft}`,
          minWidth: 0,
        }}
      >
        <Dot color={tone.fg} title={step.phase ?? 'no phase reported'} />
        <span style={{ ...CLIP, fontSize: '12.5px', minWidth: 0 }} title={step.name}>
          {step.name}
        </span>
        <Pill fg={C.accent} bg={C.accentSoft} border={C.accentBorder} title="Workflow step type">
          {step.type}
        </Pill>
        <span style={{ flex: 1 }} />
        {took && (
          <Mono C={C} color={C.textDimmer} title="How long the step ran">
            {took}
          </Mono>
        )}
        <Mono C={C} color={tone.fg} title={step.message ?? step.reason ?? undefined}>
          {step.phase ?? '—'}
        </Mono>
      </div>
      {step.message && stepState(step.phase) === 'failed' && (
        <div
          style={{
            paddingLeft: nested ? '45px' : '27px',
            paddingBottom: '7px',
            fontSize: '11.5px',
            color: C.danger,
            overflowWrap: 'anywhere',
          }}
        >
          {step.message}
        </div>
      )}
      {(step.subSteps ?? []).map(sub => (
        <Step key={sub.id || sub.name} C={C} step={sub} nested />
      ))}
    </>
  );
}

function Workflow({ C, workflow }: { C: EvoCloudPalette; workflow: WorkflowStatus }) {
  const steps = workflow.steps ?? [];

  return (
    <>
      <div style={GRID}>
        <Row C={C} label="status">
          {workflow.status ?? '—'}
        </Row>
        <Row C={C} label="mode" title="How the steps and their sub-steps were run">
          {workflow.mode ?? '—'}
        </Row>
        {workflow.appRevision && (
          <Row C={C} label="revision">
            {workflow.appRevision}
          </Row>
        )}
        <Row C={C} label="finished">
          {workflow.finished ? age(workflow.endTime) + ' ago' : 'still running'}
        </Row>
      </div>
      {steps.length > 0 && (
        <div style={{ marginTop: '10px' }}>
          {steps.map(step => (
            <Step key={step.id || step.name} C={C} step={step} />
          ))}
        </div>
      )}
    </>
  );
}

export function AppDetail({ C, app }: { C: EvoCloudPalette; app: AppView }) {
  const tone = readyTone(C, app.health.state);

  // Matched by name: `status.services` is one entry per component, written by
  // the controller, and a component with no entry yet simply has no health to
  // show rather than a wrong one.
  const serviceFor = (name: string) => app.services.find(s => s.name === name);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <Chip C={C}>{app.ns}</Chip>
        {app.addon && (
          <Chip C={C} title={`Installed by the ${app.addon.name} addon`}>
            addon · {app.addon.name}
            {app.addon.version ? ` ${app.addon.version}` : ''}
          </Chip>
        )}
        <Pill fg={tone.fg} bg={tone.bg} border={tone.border} title={app.health.message}>
          <Dot color={tone.fg} />
          {app.health.label}
        </Pill>
      </div>

      {app.health.message && (
        <div
          style={{
            marginTop: '12px',
            padding: '9px 11px',
            background: C.surfaceSunken,
            border: `1px solid ${app.health.state === 'failed' ? tone.border : C.border}`,
            borderRadius: '8px',
            fontSize: '12px',
            color: app.health.state === 'failed' ? C.danger : C.textMuted,
            overflowWrap: 'anywhere',
          }}
        >
          {app.health.message}
        </div>
      )}

      <Heading C={C}>Application</Heading>
      <div style={GRID}>
        <Row C={C} label="phase" title="KubeVela's own word for where this application is">
          {app.phase ?? '—'}
        </Row>
        <Row C={C} label="revision">
          {app.revision ?? 'none published yet'}
        </Row>
        <Row C={C} label="components">
          {app.components.length}
          {app.healthyServices !== null && ` · ${app.healthyServices} healthy`}
        </Row>
        <Row C={C} label="resources" title="Objects the workflow applied to a cluster">
          {app.applied.length}
        </Row>
        <Row C={C} label="created">
          {age(app.created)} ago
        </Row>
      </div>

      <Heading C={C}>Components</Heading>
      {app.components.length === 0 ? (
        <span style={{ fontSize: '12px', color: C.textDimmer }}>
          This application declares no components.
        </span>
      ) : (
        app.components.map(component => (
          <ComponentCard
            key={component.name}
            C={C}
            component={component}
            service={serviceFor(component.name)}
          />
        ))
      )}

      {app.policies.length > 0 && (
        <>
          <Heading C={C}>Policies</Heading>
          {app.policies.map((policy, i) => (
            <PolicyCard
              key={policy.name || `${policy.type}/${i}`}
              C={C}
              policy={policy}
              index={i}
            />
          ))}
        </>
      )}

      <Heading C={C}>Workflow</Heading>
      {app.workflow ? (
        <Workflow C={C} workflow={app.workflow} />
      ) : (
        <span style={{ fontSize: '12px', color: C.textDimmer }}>
          No workflow has run for this application yet.
        </span>
      )}

      {app.applied.length > 0 && (
        <>
          <Heading C={C}>Applied resources</Heading>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {app.applied.map((resource, i) => (
              <div
                key={`${resource.kind}/${resource.namespace ?? ''}/${resource.name}/${i}`}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}
              >
                <Pill
                  fg={C.accent}
                  bg={C.accentSoft}
                  border={C.accentBorder}
                  title={resource.apiVersion}
                >
                  {resource.kind ?? '?'}
                </Pill>
                <span style={{ ...CLIP, fontSize: '12.5px', minWidth: 0 }} title={resource.name}>
                  {resource.name}
                </span>
                <span style={{ flex: 1 }} />
                {resource.namespace && <Chip C={C}>{resource.namespace}</Chip>}
                {resource.cluster && (
                  <Chip C={C} title="Applied to a managed cluster">
                    {resource.cluster}
                  </Chip>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
