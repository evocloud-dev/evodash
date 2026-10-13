/**
 * KubeVela's own resources, as its controller stores them.
 *
 * KubeVela is two halves and this file is only the first one. An Application
 * and the four Definition kinds are ordinary custom resources: the controller
 * reconciles them, the API server serves them, and Headlamp watches them over
 * the same websocket as everything else. Nothing here talks to VelaUX.
 *
 * The other half — projects, environments, delivery targets, users — is not in
 * a custom resource at all. VelaUX keeps it in its own store, in its own
 * undocumented shape, and it is deliberately absent here: reading it means
 * reading someone else's private filing system, and writing it means corrupting
 * their view of the cluster.
 *
 * Every kind below serves exactly one version on the KubeVela releases that
 * ship them, so unlike flux.ts there is no version list for Headlamp to probe.
 */
import { makeCustomResourceClass } from '@kinvolk/headlamp-plugin/lib/lib/k8s/crd';
import { conditionsOf, Readiness, ReadyState } from './conditions';

const CORE_GROUP = 'core.oam.dev';

const coreVersions = [{ group: CORE_GROUP, version: 'v1beta1' }];

/** A deployed application: components, the traits on them, and the workflow that applied them. */
export const Application = makeCustomResourceClass({
  apiInfo: coreVersions,
  kind: 'Application',
  pluralName: 'applications',
  singularName: 'application',
  isNamespaced: true,
});

/** One frozen version of an Application, written on every change to it. */
export const ApplicationRevision = makeCustomResourceClass({
  apiInfo: coreVersions,
  kind: 'ApplicationRevision',
  pluralName: 'applicationrevisions',
  singularName: 'applicationrevision',
  isNamespaced: true,
});

export const ComponentDefinition = makeCustomResourceClass({
  apiInfo: coreVersions,
  kind: 'ComponentDefinition',
  pluralName: 'componentdefinitions',
  singularName: 'componentdefinition',
  isNamespaced: true,
});

export const TraitDefinition = makeCustomResourceClass({
  apiInfo: coreVersions,
  kind: 'TraitDefinition',
  pluralName: 'traitdefinitions',
  singularName: 'traitdefinition',
  isNamespaced: true,
});

export const PolicyDefinition = makeCustomResourceClass({
  apiInfo: coreVersions,
  kind: 'PolicyDefinition',
  pluralName: 'policydefinitions',
  singularName: 'policydefinition',
  isNamespaced: true,
});

export const WorkflowStepDefinition = makeCustomResourceClass({
  apiInfo: coreVersions,
  kind: 'WorkflowStepDefinition',
  pluralName: 'workflowstepdefinitions',
  singularName: 'workflowstepdefinition',
  isNamespaced: true,
});

/* ------------------------------------------------------------------ shapes */

/**
 * The ten values `status.status` can hold.
 *
 * Spelled out rather than left as `string` because the page colours on them,
 * and a phase this list has not heard of has to read as unknown rather than as
 * a failure — see {@link appHealth}.
 */
export type ApplicationPhase =
  | 'starting'
  | 'rendering'
  | 'generatingPolicy'
  | 'runningWorkflow'
  | 'workflowSuspending'
  | 'workflowTerminated'
  | 'workflowFailed'
  | 'running'
  | 'unhealthy'
  | 'deleting';

/** What a component turned into, and whether that thing is up. */
export interface ServiceStatus {
  name: string;
  namespace?: string;
  cluster?: string;
  healthy?: boolean;
  workloadHealthy?: boolean;
  /** The controller's own words, e.g. `Ready:1/1`. */
  message?: string;
  workloadDefinition?: { apiVersion?: string; kind?: string };
  traits?: { type: string; healthy?: boolean; message?: string }[];
}

export type WorkflowStepPhase =
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'running'
  | 'pending'
  | 'suspending';

export interface WorkflowStepStatus {
  id?: string;
  name: string;
  type: string;
  phase?: WorkflowStepPhase;
  message?: string;
  reason?: string;
  firstExecuteTime?: string;
  lastExecuteTime?: string;
  /** Steps of a step-group, which nests exactly one level in KubeVela. */
  subSteps?: WorkflowStepStatus[];
}

export interface WorkflowStatus {
  appRevision?: string;
  /** `DAG-DAG`, `StepByStep-DAG` — how the steps and their sub-steps were run. */
  mode?: string;
  status?: string;
  suspend?: boolean;
  terminated?: boolean;
  finished?: boolean;
  startTime?: string;
  endTime?: string;
  steps?: WorkflowStepStatus[];
}

/** One object the workflow actually put into a cluster. */
export interface AppliedResource {
  apiVersion?: string;
  kind?: string;
  name?: string;
  namespace?: string;
  /** Set only on a multi-cluster deploy; the local cluster is left unwritten. */
  cluster?: string;
  creator?: string;
}

export interface ApplicationTrait {
  type: string;
  /** The trait's settings — the shape is whatever its TraitDefinition declares. */
  properties?: Record<string, any>;
}

export interface ApplicationComponent {
  name: string;
  type: string;
  /** The component's settings. See {@link parseParameterDocs} for putting names to them. */
  properties?: Record<string, any>;
  traits?: ApplicationTrait[];
  dependsOn?: string[];
}

export interface ApplicationPolicy {
  name?: string;
  type: string;
  properties?: Record<string, any>;
}

/* ----------------------------------------------------------------- readers */

export function componentsOf(json: any): ApplicationComponent[] {
  const components = json?.spec?.components;
  return Array.isArray(components) ? components : [];
}

export function policiesOf(json: any): ApplicationPolicy[] {
  const policies = json?.spec?.policies;
  return Array.isArray(policies) ? policies : [];
}

export function servicesOf(json: any): ServiceStatus[] {
  const services = json?.status?.services;
  return Array.isArray(services) ? services : [];
}

export function appliedResourcesOf(json: any): AppliedResource[] {
  const applied = json?.status?.appliedResources;
  return Array.isArray(applied) ? applied : [];
}

export function workflowOf(json: any): WorkflowStatus | null {
  const workflow = json?.status?.workflow;
  return workflow && typeof workflow === 'object' ? workflow : null;
}

export function phaseOf(json: any): ApplicationPhase | null {
  const phase = json?.status?.status;
  return typeof phase === 'string' && phase ? (phase as ApplicationPhase) : null;
}

/** Name of the revision last published, e.g. `my-app-v3`. */
export function revisionOf(json: any): string | null {
  return json?.status?.latestRevision?.name ?? null;
}

/**
 * The addon an Application belongs to, or null for one somebody wrote.
 *
 * Every addon KubeVela installs leaves behind an Application carrying these
 * labels. It is both how the catalog page will know what is already installed,
 * and how this page separates the cluster's own plumbing from the work being
 * delivered on it — on a fresh cluster the plumbing is all there is, and
 * showing it unlabelled makes an empty platform look like a busy one.
 */
export function addonOf(json: any): { name: string; version?: string; registry?: string } | null {
  const labels = json?.metadata?.labels ?? {};
  const name = labels['addons.oam.dev/name'];
  if (!name) {
    return null;
  }
  return {
    name,
    version: labels['addons.oam.dev/version'],
    registry: labels['addons.oam.dev/registry'],
  };
}

/* ------------------------------------------------------------------ health */

/**
 * Collapse an Application's phase into the vocabulary the other pages use.
 *
 * KubeVela does not follow the `Ready` condition convention conditions.ts was
 * written for: it writes one condition per stage of its own pipeline (Parsed,
 * Revision, Policy, Render, Workflow) and puts the real answer in
 * `status.status`. So the phase decides the state here, and the conditions are
 * read only for something to say about it.
 *
 * A phase this function has not heard of is reported as unknown rather than as
 * a failure. New phases arrive with KubeVela releases, and a plugin built
 * against an older one must not paint an upgrade red.
 */
export function appHealth(json: any): Readiness {
  const phase = phaseOf(json);
  const conditions = conditionsOf(json);
  const failing = conditions.find(c => c.status === 'False');
  const since = conditions
    .map(c => c.lastTransitionTime)
    .filter(Boolean)
    .sort()
    .pop();

  // A stage that has gone False explains a stuck or broken application better
  // than the phase word can on its own, so it wins the tooltip when there is one.
  const detail = failing?.message || failing?.reason;

  const of = (state: ReadyState, label: string, fallback?: string): Readiness => ({
    state,
    label,
    message: detail ?? fallback,
    reason: failing?.reason,
    since,
  });

  switch (phase) {
    case 'running':
      return of('ready', 'Running', 'Every component is healthy.');
    case 'unhealthy':
      return of('failed', 'Unhealthy', 'The workflow finished, but a component is not healthy.');
    case 'workflowFailed':
      return of('failed', 'Failed', 'A workflow step failed.');
    case 'workflowTerminated':
      return of('failed', 'Terminated', 'The workflow stopped before it finished.');
    case 'workflowSuspending':
      return of('suspended', 'Suspended', 'The workflow is waiting to be resumed.');
    case 'runningWorkflow':
      return of('reconciling', 'Deploying', 'The workflow is running.');
    case 'starting':
      return of('reconciling', 'Starting');
    case 'rendering':
      return of('reconciling', 'Rendering');
    case 'generatingPolicy':
      return of('reconciling', 'Policy');
    case 'deleting':
      return of('reconciling', 'Deleting', 'The application is being removed.');
    case null:
      return {
        state: 'unknown',
        label: 'Unknown',
        message: 'The controller has not reported a phase yet.',
        since,
      };
    default:
      return of(
        'unknown',
        phase,
        `KubeVela reports the phase "${phase}", which this page does not know.`
      );
  }
}

/** Colour a workflow step the same way the application above it is coloured. */
export function stepState(phase?: WorkflowStepPhase | string): ReadyState {
  switch (phase) {
    case 'succeeded':
      return 'ready';
    case 'failed':
      return 'failed';
    case 'running':
    case 'pending':
      return 'reconciling';
    case 'suspending':
      return 'suspended';
    default:
      // `skipped`, and anything a newer KubeVela invents.
      return 'unknown';
  }
}

/** Whether a component's workload and every trait on it reported healthy. */
export function serviceHealthy(service: ServiceStatus): boolean {
  if (service.healthy === false) {
    return false;
  }
  return (service.traits ?? []).every(t => t.healthy !== false);
}

/* --------------------------------------------------------------- parameters */

/**
 * Where KubeVela leaves the parameter schemas, and what they are called.
 *
 * Every definition gets a ConfigMap holding the JSON Schema of its parameters,
 * generated from the CUE the definition is written in. This is what VelaUX
 * draws its configuration forms from, and it lets a page put a title and a
 * description against an application's settings without going anywhere near a
 * CUE evaluator — which is the one thing a plugin running in a browser cannot
 * do for itself.
 *
 * The name is the only usable index. There is a `definition.oam.dev/name`
 * label, but it does not say which of the four kinds the definition is, and all
 * four share this namespace.
 */
export const DEFINITION_NAMESPACE = 'vela-system';

/** The single key inside one of those ConfigMaps. */
export const SCHEMA_DATA_KEY = 'openapi-v3-json-schema';

export type DefinitionScope = 'component' | 'trait' | 'policy' | 'workflowstep';

export function schemaConfigMapName(scope: DefinitionScope, type: string): string {
  return `${scope}-schema-${type}`;
}

/** One settable field of a definition, as its schema describes it. */
export interface ParameterDoc {
  name: string;
  title?: string;
  description?: string;
  /** `string`, `number`, `object`, ... straight from the schema. */
  type?: string;
  required: boolean;
  /** What the definition uses when the field is left out. */
  default?: any;
}

/**
 * Read a schema ConfigMap's payload into per-field documentation.
 *
 * Returns null rather than throwing for anything unreadable — a missing
 * ConfigMap, an older KubeVela that never wrote one, a namespace the user
 * cannot read, or a payload that is not the object this expects. Every caller
 * falls back to showing the settings unannotated, which is worth less than the
 * documented version and a great deal more than an error.
 */
export function parseParameterDocs(raw?: string | null): Record<string, ParameterDoc> | null {
  if (!raw) {
    return null;
  }

  let schema: any;
  try {
    schema = JSON.parse(raw);
  } catch {
    return null;
  }

  const properties = schema?.properties;
  if (!properties || typeof properties !== 'object') {
    return null;
  }

  const required: string[] = Array.isArray(schema.required) ? schema.required : [];

  const docs: Record<string, ParameterDoc> = {};
  for (const [name, value] of Object.entries<any>(properties)) {
    docs[name] = {
      name,
      title: typeof value?.title === 'string' ? value.title : undefined,
      description: typeof value?.description === 'string' ? value.description : undefined,
      type: typeof value?.type === 'string' ? value.type : undefined,
      required: required.includes(name),
      default: value?.default,
    };
  }
  return docs;
}
