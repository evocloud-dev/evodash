/**
 * Shaping and filtering for the KubeVela Applications page.
 *
 * Kept apart from the page for the same reason appEndpoints/model.ts is: the
 * page is composition, and what counts as a match or how a setting is rendered
 * is testable on its own once it is not tangled up in JSX.
 */
import { Readiness } from '../../k8s/conditions';
import {
  addonOf,
  appHealth,
  ApplicationComponent,
  ApplicationPhase,
  ApplicationPolicy,
  AppliedResource,
  appliedResourcesOf,
  componentsOf,
  phaseOf,
  policiesOf,
  revisionOf,
  serviceHealthy,
  servicesOf,
  ServiceStatus,
  workflowOf,
  WorkflowStatus,
} from '../../k8s/kubevela';

/** One Application, with everything the page reads already pulled out of it. */
export interface AppView {
  key: string;
  name: string;
  ns: string;
  health: Readiness;
  phase: ApplicationPhase | null;
  components: ApplicationComponent[];
  policies: ApplicationPolicy[];
  services: ServiceStatus[];
  workflow: WorkflowStatus | null;
  applied: AppliedResource[];
  revision: string | null;
  /** Set when the Application is an addon KubeVela installed, not somebody's work. */
  addon: { name: string; version?: string; registry?: string } | null;
  created: string | null;
  /** Distinct component types, in first-seen order — the table shows these. */
  types: string[];
  /** How many components reported healthy; null before the controller has said. */
  healthyServices: number | null;
}

export function buildAppViews(items: any[] | null | undefined): AppView[] {
  const views = (items ?? []).map((item: any) => {
    const json = item.jsonData ?? item;
    const ns = json.metadata?.namespace ?? '';
    const name = json.metadata?.name ?? '';
    const components = componentsOf(json);
    const services = servicesOf(json);

    const types: string[] = [];
    for (const component of components) {
      if (component.type && !types.includes(component.type)) {
        types.push(component.type);
      }
    }

    return {
      key: json.metadata?.uid || `${ns}/${name}`,
      name,
      ns,
      health: appHealth(json),
      phase: phaseOf(json),
      components,
      policies: policiesOf(json),
      services,
      workflow: workflowOf(json),
      applied: appliedResourcesOf(json),
      revision: revisionOf(json),
      addon: addonOf(json),
      created: json.metadata?.creationTimestamp ?? null,
      types,
      healthyServices: services.length ? services.filter(serviceHealthy).length : null,
    };
  });

  // Namespace then name: the order the list is in must not change under the
  // reader because a phase flipped somewhere else on the page.
  return views.sort((a, b) => a.ns.localeCompare(b.ns) || a.name.localeCompare(b.name));
}

export function namespacesOf(views: AppView[]): string[] {
  return [...new Set(views.map(v => v.ns))].filter(Boolean).sort();
}

/** Whether an application is somebody's work or part of the platform itself. */
export type Origin = 'all' | 'own' | 'addon';

export interface AppFilter {
  query: string;
  ns: string;
  state: string;
  origin: Origin;
}

export function matchesApp(view: AppView, filter: AppFilter): boolean {
  const query = filter.query.trim().toLowerCase();
  if (query) {
    const haystack = [
      view.name,
      view.ns,
      view.revision ?? '',
      view.addon?.name ?? '',
      ...view.types,
      ...view.components.map(c => c.name),
    ]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(query)) {
      return false;
    }
  }
  if (filter.ns !== 'all' && view.ns !== filter.ns) {
    return false;
  }
  if (filter.state !== 'all' && view.health.state !== filter.state) {
    return false;
  }
  if (filter.origin === 'own' && view.addon) {
    return false;
  }
  if (filter.origin === 'addon' && !view.addon) {
    return false;
  }
  return true;
}

/**
 * How one setting wants to be drawn.
 *
 * A component's properties are arbitrary JSON — whatever its definition
 * declares — so the detail panel cannot lay them out ahead of time. It asks
 * each value what it is instead: something that fits on a line goes on a line,
 * and something that does not gets a block of its own rather than being
 * truncated into nonsense.
 */
export type ValueShape = 'scalar' | 'block';

export interface DescribedValue {
  shape: ValueShape;
  text: string;
}

export function describeValue(value: any): DescribedValue {
  if (value === undefined || value === null) {
    return { shape: 'scalar', text: '—' };
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return { shape: 'scalar', text: String(value) };
  }
  if (typeof value === 'string') {
    // A multi-line string is a script or a file, not a value on a line.
    return value.includes('\n')
      ? { shape: 'block', text: value }
      : { shape: 'scalar', text: value || '""' };
  }
  if (Array.isArray(value) && value.every(v => typeof v !== 'object' || v === null)) {
    return value.length
      ? { shape: 'scalar', text: value.map(v => String(v)).join(', ') }
      : { shape: 'scalar', text: '[]' };
  }
  try {
    return { shape: 'block', text: JSON.stringify(value, null, 2) };
  } catch {
    // Circular, which JSON from the API server cannot be — but a caller could
    // hand this anything, and a detail panel must not be what crashes the page.
    return { shape: 'scalar', text: String(value) };
  }
}

/** Settings of a component or trait, ordered for display. */
export function settingsOf(properties?: Record<string, any>): [string, any][] {
  if (!properties || typeof properties !== 'object') {
    return [];
  }
  return Object.entries(properties).sort(([a], [b]) => a.localeCompare(b));
}
