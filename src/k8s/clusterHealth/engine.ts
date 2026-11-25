/*
 * Ported from the KubeBuddy Headlamp plugin
 * (https://github.com/KubeDeckio/KubeBuddy, headlamp-plugin, checks from v0.0.38).
 *
 * MIT License. Copyright (c) 2025 Richard Hooper.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * The KubeBuddy check engine: every check in the catalog evaluated against the
 * resource lists Headlamp already holds, with no React and nothing installed in
 * the cluster. Kept close to upstream so later catalog releases can be merged;
 * the page around it is ours.
 */
/* eslint-disable */
import { dump as dumpYaml } from 'js-yaml';
import {
  GeneratedCheck,
  GeneratedExpression,
  GeneratedPredicate,
  KUBERNETES_CHECKS,
} from './checkCatalog';
import {
  isBuiltInNamespace,
  isSystemIsolationTaint,
  podContainers,
  rootUserIssue,
} from './hygiene';

export { KUBERNETES_CHECKS };
export type { GeneratedCheck };

export type Severity = 'high' | 'warning' | 'medium' | 'low';
export type CheckStatus = 'passed' | 'failed' | 'skipped';

export type Finding = {
  resource: string;
  namespace?: string;
  kind?: string;
  apiVersion?: string;
  uid?: string;
  commandName?: string;
  commandNamespace?: string;
  details: string;
  message?: string;
  link?: string;
  yamlPath?: string;
  yamlSnippet?: string;
  sourceAnnotations?: Record<string, unknown>;
};

type FindingOptions = {
  yamlPath?: string;
  yamlValue?: unknown;
};

export type CheckResult = {
  id: string;
  name: string;
  category: string;
  section: string;
  severity: Severity;
  weight: number;
  description: string;
  failMessage: string;
  recommendation: string;
  recommendationHtml?: string;
  docs?: string;
  nativeHandler?: string;
  sourceFile: string;
  resourceKind: string;
  status: CheckStatus;
  skippedReason?: string;
  findings: Finding[];
  suppressedFindings?: SuppressedFinding[];
};

export type SuppressedFinding = Finding & {
  suppressionReason?: string;
  suppressionUntil?: string;
};

export type ResourceState<T = any> = {
  data: T[];
  error?: unknown;
  loading: boolean;
};

export type Score = {
  value: number;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  failedWeight: number;
  totalWeight: number;
};

export type ResourceStates = Record<string, ResourceState>;

export type KubeBuddyConfig = {
  useSystemNamespaceExclusions: boolean;
  additionalExcludedNamespaces: string[];
  excludedNamespaces: string[];
  excludedChecks: string[];
  trustedRegistries: string[];
  rawYaml?: string;
  thresholds: {
    restartsWarning: number;
    restartsCritical: number;
    podAgeWarning: number;
    stuckJobHours: number;
    podsPerNodeCritical: number;
  };
};
type NativeHandler = (resources: ResourceStates, config: KubeBuddyConfig) => Finding[];

const EMPTY_RESOURCE_STATE: ResourceState = { data: [], loading: false };
const EMPTY_CHECKS: CheckResult[] = [];

export const DEFAULT_EXCLUDED_NAMESPACES = [
  'kube-system',
  'kube-public',
  'kube-node-lease',
  'local-path-storage',
  'kube-flannel',
  'tigera-operator',
  'calico-system',
  'coredns',
  'aks-istio-system',
  'aks-command',
  'gatekeeper-system',
];
const DEFAULT_TRUSTED_REGISTRIES = ['mcr.microsoft.com/'];
const DEFAULT_THRESHOLDS: KubeBuddyConfig['thresholds'] = {
  restartsWarning: 3,
  restartsCritical: 5,
  podAgeWarning: 15,
  stuckJobHours: 2,
  podsPerNodeCritical: 90,
};

const IGNORE_CHECKS_ANNOTATION = 'kubebuddy.io/ignore-checks';
const IGNORE_REASON_ANNOTATION = 'kubebuddy.io/ignore-reason';
const IGNORE_UNTIL_ANNOTATION = 'kubebuddy.io/ignore-until';

export function normalizeNamespaceList(namespaces: string[]): string[] {
  return Array.from(
    new Set(namespaces.map(namespace => namespace.trim().toLowerCase()).filter(Boolean))
  ).sort();
}

function canonicalContainerImageReference(image: string): string {
  const trimmed = image.trim();
  const withoutDigest = trimmed.split('@')[0];
  const firstSegment = withoutDigest.split('/')[0];
  const hasPath = withoutDigest.includes('/');

  if (!trimmed || !firstSegment) {
    return '';
  }

  if (
    hasPath &&
    (firstSegment.includes('.') || firstSegment.includes(':') || firstSegment === 'localhost')
  ) {
    return trimmed;
  }

  if (trimmed.includes('/')) {
    return `docker.io/${trimmed}`;
  }

  return `docker.io/library/${trimmed}`;
}

function imageRegistryPrefix(image: string): string {
  const canonicalImage = canonicalContainerImageReference(image);
  const segments = canonicalImage.split('/');

  if (!segments[0]) {
    return '';
  }

  if (segments[0] === 'docker.io' && segments[1]) {
    return `docker.io/${segments[1]}/`;
  }

  return `${segments[0]}/`;
}

function normalizeRegistryPrefix(registry: string): string {
  const trimmed = registry.trim();
  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
  const lastSegment = withoutTrailingSlash.split('/').pop() || '';

  if (!withoutTrailingSlash) {
    return '';
  }

  if (
    (withoutTrailingSlash.includes('/') &&
      !withoutTrailingSlash.split('/')[0].includes('.') &&
      !withoutTrailingSlash.split('/')[0].includes(':')) ||
    withoutTrailingSlash.includes('@') ||
    lastSegment.includes(':')
  ) {
    return imageRegistryPrefix(withoutTrailingSlash);
  }

  return `${withoutTrailingSlash}/`;
}

function normalizeRegistries(registries: string[]): string[] {
  return Array.from(new Set(registries.map(normalizeRegistryPrefix).filter(Boolean))).sort();
}

export function defaultKubeBuddyConfig(): KubeBuddyConfig {
  return {
    useSystemNamespaceExclusions: true,
    additionalExcludedNamespaces: [],
    excludedNamespaces: DEFAULT_EXCLUDED_NAMESPACES,
    excludedChecks: [],
    trustedRegistries: DEFAULT_TRUSTED_REGISTRIES,
    thresholds: { ...DEFAULT_THRESHOLDS },
  };
}

function effectiveExcludedNamespaces(
  config: Pick<KubeBuddyConfig, 'useSystemNamespaceExclusions' | 'additionalExcludedNamespaces'>
): string[] {
  return normalizeNamespaceList([
    ...(config.useSystemNamespaceExclusions ? DEFAULT_EXCLUDED_NAMESPACES : []),
    ...config.additionalExcludedNamespaces,
  ]);
}

function normalizeKubeBuddyConfig(config: Partial<KubeBuddyConfig>): KubeBuddyConfig {
  const defaults = defaultKubeBuddyConfig();
  const trustedRegistries = Array.isArray(config.trustedRegistries)
    ? normalizeRegistries(config.trustedRegistries)
    : defaults.trustedRegistries;
  const legacyExcluded = Array.isArray(config.excludedNamespaces)
    ? normalizeNamespaceList(config.excludedNamespaces)
    : defaults.excludedNamespaces;
  const useSystemNamespaceExclusions =
    typeof config.useSystemNamespaceExclusions === 'boolean'
      ? config.useSystemNamespaceExclusions
      : DEFAULT_EXCLUDED_NAMESPACES.every(namespace => legacyExcluded.includes(namespace));
  const additionalExcludedNamespaces = Array.isArray(config.additionalExcludedNamespaces)
    ? normalizeNamespaceList(config.additionalExcludedNamespaces)
    : normalizeNamespaceList(
        legacyExcluded.filter(namespace => !DEFAULT_EXCLUDED_NAMESPACES.includes(namespace))
      );
  const normalized: KubeBuddyConfig = {
    useSystemNamespaceExclusions,
    additionalExcludedNamespaces,
    excludedNamespaces: effectiveExcludedNamespaces({
      useSystemNamespaceExclusions,
      additionalExcludedNamespaces,
    }),
    excludedChecks: Array.isArray(config.excludedChecks)
      ? Array.from(
          new Set(config.excludedChecks.map(id => id.trim().toUpperCase()).filter(Boolean))
        ).sort()
      : defaults.excludedChecks,
    trustedRegistries:
      trustedRegistries.length > 0 ? trustedRegistries : defaults.trustedRegistries,
    rawYaml: typeof config.rawYaml === 'string' ? config.rawYaml : undefined,
    thresholds: {
      ...defaults.thresholds,
      ...(config.thresholds || {}),
    },
  };

  return normalized;
}

function errorField(error: unknown, field: string): unknown {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  return (error as Record<string, unknown>)[field];
}

export function formatResourceError(label: string, error: unknown): string {
  if (error instanceof Error) {
    const status =
      errorField(error, 'status') || errorField(error, 'statusCode') || errorField(error, 'code');
    const body =
      errorField(error, 'body') || errorField(error, 'response') || errorField(error, 'data');
    const detail = typeof body === 'string' ? body : body ? JSON.stringify(body) : '';

    return `${label}: ${error.name}: ${error.message}${status ? ` (${status})` : ''}${
      detail ? ` - ${detail}` : ''
    }`;
  }

  if (typeof error === 'string') {
    return `${label}: ${error}`;
  }

  if (error && typeof error === 'object') {
    const message =
      errorField(error, 'message') ||
      errorField(error, 'statusText') ||
      errorField(error, 'reason');
    const status =
      errorField(error, 'status') || errorField(error, 'statusCode') || errorField(error, 'code');

    return `${label}: ${message || 'Unable to load resource list'}${
      status ? ` (${status})` : ''
    } - ${JSON.stringify(error)}`;
  }

  return `${label}: Unknown resource loading error`;
}

function errorStatus(error: unknown): string {
  const status =
    errorField(error, 'status') || errorField(error, 'statusCode') || errorField(error, 'code');

  return String(status || '');
}

export function isOptionalMissingApi(label: string, error: unknown): boolean {
  return (
    [
      'Gateways',
      'HTTPRoutes',
      'ValidatingAdmissionPolicies',
      'ValidatingAdmissionPolicyBindings',
    ].includes(label) && errorStatus(error) === '404'
  );
}

function json(resource: any): any {
  return resource?.jsonData || resource;
}

function name(resource: any): string {
  return (
    resource?.getName?.() ||
    resource?.metadata?.name ||
    resource?.jsonData?.metadata?.name ||
    'Unknown'
  );
}

function namespace(resource: any): string | undefined {
  return (
    resource?.getNamespace?.() ||
    resource?.metadata?.namespace ||
    resource?.jsonData?.metadata?.namespace
  );
}

export function namespaceOrName(resource: any): string | undefined {
  const resourceNamespace = namespace(resource);
  if (resourceNamespace) {
    return resourceNamespace;
  }

  if (kind(resource) === 'Namespace') {
    return name(resource);
  }

  return undefined;
}

function kind(resource: any): string | undefined {
  return (
    resource?.kind ||
    resource?.jsonData?.kind ||
    resource?.metadata?.kind ||
    resource?.jsonData?.metadata?.kind
  );
}

function apiVersion(resource: any): string | undefined {
  return resource?.apiVersion || resource?.jsonData?.apiVersion;
}

function uid(resource: any): string | undefined {
  return resource?.metadata?.uid || resource?.jsonData?.metadata?.uid;
}

function link(resource: any): string | undefined {
  return resource?.getDetailsLink?.();
}

function pathSegments(path: string): string[] {
  return path.split('.').filter(Boolean);
}

function valueAtPath(value: any, path: string | undefined): unknown {
  if (!path) {
    return value;
  }

  return pathSegments(path).reduce((current, segment) => {
    if (current === null || current === undefined) {
      return undefined;
    }

    const key = segment.replace(/\[[^\]]+\]$/, '');
    return current?.[key];
  }, value);
}

function yamlSnippetFromPath(path: string, value: unknown): string {
  const snippet = pathSegments(path).reduceRight<unknown>((current, segment) => {
    const match = segment.match(/^([^\[]+)\[([^=\]]+)=([^\]]+)\]$/);
    if (match) {
      const [, listName, selectorKeyName, selectorValue] = match;
      return {
        [listName]: [{ [selectorKeyName]: selectorValue, ...(current as Record<string, unknown>) }],
      };
    }

    return { [segment]: current };
  }, value);

  return dumpYaml(snippet, { lineWidth: -1 }).trim();
}

function expressionYamlPath(expression: GeneratedExpression | undefined): string | undefined {
  if (!expression) {
    return undefined;
  }

  if (expression.path) {
    return expression.path;
  }

  if (expression.exists) {
    return expression.exists;
  }

  if (expression.len) {
    return expressionYamlPath(expression.len);
  }

  if (expression.count_where?.path) {
    return expression.count_where.path;
  }

  if (expression.coalesce?.length) {
    return expression.coalesce.map(expressionYamlPath).find(Boolean);
  }

  return undefined;
}

export function namespaceSet(namespaces: string[]): Set<string> {
  return new Set(normalizeNamespaceList(namespaces));
}

function filterResourceState<T>(
  state: ResourceState<T>,
  excludedNamespaces: Set<string>
): ResourceState<T> {
  if (!excludedNamespaces.size) {
    return state;
  }

  return {
    ...state,
    data: state.data.filter(item => {
      const itemNamespace = namespaceOrName(item);
      return !itemNamespace || !excludedNamespaces.has(itemNamespace.toLowerCase());
    }),
  };
}

function finding(
  resource: any,
  details: string,
  message?: string,
  options: FindingOptions = {}
): Finding {
  const yamlPath = options.yamlPath;
  const yamlValue = yamlPath
    ? options.yamlValue ?? valueAtPath(json(resource), yamlPath)
    : undefined;
  const yamlSnippetValue = yamlValue === undefined ? '<missing>' : yamlValue;

  return {
    resource: name(resource),
    namespace: namespace(resource),
    kind: kind(resource),
    apiVersion: apiVersion(resource),
    uid: uid(resource),
    commandName: name(resource),
    commandNamespace: namespace(resource),
    details,
    message,
    link: link(resource),
    yamlPath,
    yamlSnippet: yamlPath ? yamlSnippetFromPath(yamlPath, yamlSnippetValue) : undefined,
    sourceAnnotations: objectAnnotations(resource),
  };
}

function pvcUnusedCondition(pvc: any): { status: string; lastTransitionTime?: string } | undefined {
  return (json(pvc)?.status?.conditions || []).find(
    (condition: any) => String(condition?.type).toLowerCase() === 'unused'
  );
}

function nonTerminalPodUsesPVC(pod: any, pvc: any): boolean {
  const phase = String(json(pod)?.status?.phase || '');
  if (phase === 'Succeeded' || phase === 'Failed') {
    return false;
  }

  return (
    namespace(pod) === namespace(pvc) &&
    (json(pod)?.spec?.volumes || []).some(
      (volume: any) => volume.persistentVolumeClaim?.claimName === name(pvc)
    )
  );
}

function pvcUnusedFinding(pvc: any): Finding {
  const condition = pvcUnusedCondition(pvc);
  const unusedSince = condition?.lastTransitionTime
    ? `; unused since ${condition.lastTransitionTime}`
    : '';

  return finding(
    pvc,
    `PVC not used by any non-terminal pod${unusedSince}`,
    `PVC not used by any non-terminal pod${unusedSince}`,
    condition?.lastTransitionTime ? { yamlPath: 'status.conditions' } : {}
  );
}

function restartCount(pod: any): number {
  return (json(pod)?.status?.containerStatuses || []).reduce(
    (total: number, status: any) => total + (status.restartCount || 0),
    0
  );
}

function podImages(pod: any): string[] {
  const spec = workloadTemplate(pod)?.spec || json(pod)?.spec || {};
  return [...(spec.initContainers || []), ...(spec.containers || [])]
    .map((container: any) => container.image)
    .filter(Boolean);
}

function containers(pod: any, includeInit = true): any[] {
  const spec = workloadTemplate(pod)?.spec || json(pod)?.spec || {};
  return includeInit
    ? [...(spec.initContainers || []), ...(spec.containers || [])]
    : spec.containers || [];
}

function allPodContainers(pod: any): any[] {
  return podContainers(json(pod)?.spec || {});
}

function containerYamlOptions(
  pod: any,
  container: any,
  fieldPath: string,
  yamlValue = valueAtPath(container, fieldPath)
): FindingOptions {
  const spec = json(pod)?.spec || {};
  const listName = (spec.ephemeralContainers || []).some((item: any) => item === container)
    ? 'ephemeralContainers'
    : (spec.initContainers || []).some((item: any) => item === container)
    ? 'initContainers'
    : 'containers';
  const yamlPath = `spec.${listName}[name=${container.name || 'unknown'}].${fieldPath}`;

  return {
    yamlPath,
    yamlValue,
  };
}

function selectorKey(selector: unknown): string {
  if (!selector || typeof selector !== 'object') {
    return '';
  }
  return Object.entries(selector as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join(',');
}

function selectorMatches(selector: unknown, labels: unknown): boolean {
  if (!selector || !labels || typeof selector !== 'object' || typeof labels !== 'object') {
    return false;
  }
  return Object.entries(selector as Record<string, unknown>).every(
    ([key, value]) => (labels as Record<string, unknown>)[key] === value
  );
}

function workloadTemplate(workload: any): any {
  return json(workload)?.spec?.template || {};
}

function endpointSliceHasReadyEndpoint(endpointSlice: any): boolean {
  return (json(endpointSlice)?.endpoints || []).some(
    (endpoint: any) => endpoint?.conditions?.ready !== false
  );
}

function workloadSelector(workload: any): unknown {
  return json(workload)?.spec?.selector?.matchLabels;
}

function workloadLabels(workload: any): unknown {
  return workloadTemplate(workload)?.metadata?.labels;
}

function allWorkloads(resources: ResourceStates): any[] {
  return [...resources.deployment.data, ...resources.daemonset.data, ...resources.statefulset.data];
}

function workloadContainers(workload: any): any[] {
  return workloadTemplate(workload)?.spec?.containers || [];
}

function workloadAllContainers(workload: any): any[] {
  const spec = workloadTemplate(workload)?.spec || {};
  return [...(spec.containers || []), ...(spec.initContainers || [])];
}

function hasProbe(container: any): boolean {
  return !!container.readinessProbe && !!container.livenessProbe;
}

function objectLabels(resource: any): Record<string, unknown> {
  return json(resource)?.metadata?.labels || {};
}

function objectAnnotations(resource: any): Record<string, unknown> {
  return json(resource)?.metadata?.annotations || {};
}

function serviceSelector(service: any): unknown {
  return json(service)?.spec?.selector;
}

function hasResource(
  container: any,
  mode: 'requests' | 'limits',
  resource: 'cpu' | 'memory'
): boolean {
  return !!container?.resources?.[mode]?.[resource];
}

function isInternalIP(value: string): boolean {
  const parts = value
    .trim()
    .split('.')
    .map(part => Number(part));
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127) ||
    first === 0
  );
}

function serviceTargetPortMatchesPods(targetPort: string, pods: any[]): boolean {
  return pods.some(pod =>
    containers(pod, false).some(container =>
      (container.ports || []).some(
        (port: any) =>
          String(port.name || '') === targetPort || String(port.containerPort || '') === targetPort
      )
    )
  );
}

function deprecatedApiReason(apiVersion: string): string {
  switch (apiVersion) {
    case 'extensions/v1beta1':
      return 'extensions/v1beta1 is removed in Kubernetes 1.22; migrate to the stable API for this resource';
    case 'apps/v1beta1':
    case 'apps/v1beta2':
      return `${apiVersion} is removed in Kubernetes 1.16; migrate workloads to apps/v1`;
    case 'networking.k8s.io/v1beta1':
      return 'networking.k8s.io/v1beta1 is removed in Kubernetes 1.22; migrate networking resources to networking.k8s.io/v1';
    case 'batch/v1beta1':
      return 'batch/v1beta1 CronJob is removed in Kubernetes 1.25; migrate to batch/v1';
    case 'policy/v1beta1':
      return 'policy/v1beta1 is removed for PodDisruptionBudget in Kubernetes 1.25 and PodSecurityPolicy in Kubernetes 1.25';
    case 'autoscaling/v2beta1':
    case 'autoscaling/v2beta2':
      return `${apiVersion} is removed in Kubernetes 1.26; migrate HPAs to autoscaling/v2`;
    case 'rbac.authorization.k8s.io/v1beta1':
      return 'rbac.authorization.k8s.io/v1beta1 is removed in Kubernetes 1.22; migrate RBAC resources to v1';
    case 'apiextensions.k8s.io/v1beta1':
      return 'apiextensions.k8s.io/v1beta1 is removed in Kubernetes 1.22; migrate CRDs to v1';
    case 'admissionregistration.k8s.io/v1beta1':
      return 'admissionregistration.k8s.io/v1beta1 is removed in Kubernetes 1.22; migrate webhooks to v1';
    case 'apiregistration.k8s.io/v1beta1':
      return 'apiregistration.k8s.io/v1beta1 is removed in Kubernetes 1.22; migrate APIService resources to v1';
    case 'storage.k8s.io/v1beta1':
      return 'storage.k8s.io/v1beta1 is removed for several storage APIs; migrate to storage.k8s.io/v1';
    case 'certificates.k8s.io/v1beta1':
      return 'certificates.k8s.io/v1beta1 is removed in Kubernetes 1.22; migrate CSRs to certificates.k8s.io/v1';
    case 'events.k8s.io/v1beta1':
      return 'events.k8s.io/v1beta1 is deprecated; migrate event integrations to events.k8s.io/v1';
    case 'discovery.k8s.io/v1beta1':
      return 'discovery.k8s.io/v1beta1 EndpointSlice is removed in Kubernetes 1.25; migrate to discovery.k8s.io/v1';
    case 'flowcontrol.apiserver.k8s.io/v1beta1':
    case 'flowcontrol.apiserver.k8s.io/v1beta2':
      return `${apiVersion} flow control resources are deprecated or removed in newer Kubernetes releases`;
    default:
      return '';
  }
}

function cpuMillicoresValue(value: unknown): number {
  const raw = String(value || '').trim();
  if (!raw) {
    return 0;
  }
  if (raw.endsWith('m')) {
    return Number(raw.slice(0, -1)) || 0;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed * 1000 : 0;
}

function memoryMiValue(value: unknown): number {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  const parsed = Number(raw.replace(/[a-z]+$/, ''));
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  if (raw.endsWith('ki')) return parsed / 1024;
  if (raw.endsWith('mi')) return parsed;
  if (raw.endsWith('gi')) return parsed * 1024;
  if (raw.endsWith('ti')) return parsed * 1024 * 1024;
  if (raw.endsWith('k')) return parsed / 1000 / 1000;
  if (raw.endsWith('m')) return parsed;
  if (raw.endsWith('g')) return parsed * 1000;
  return parsed / 1024 / 1024;
}

function selectorEmpty(selector: unknown): boolean {
  if (!selector || typeof selector !== 'object') {
    return true;
  }
  const s = selector as Record<string, any>;
  const labels =
    s.matchLabels && typeof s.matchLabels === 'object' ? Object.keys(s.matchLabels) : [];
  const expressions = Array.isArray(s.matchExpressions) ? s.matchExpressions : [];
  const direct = Object.keys(s).filter(key => key !== 'matchLabels' && key !== 'matchExpressions');
  return labels.length === 0 && expressions.length === 0 && direct.length === 0;
}

function labelSelectorMatches(selector: unknown, labels: unknown): boolean {
  if (selectorEmpty(selector)) {
    return true;
  }
  if (!selector || !labels || typeof selector !== 'object' || typeof labels !== 'object') {
    return false;
  }
  const s = selector as Record<string, any>;
  const l = labels as Record<string, unknown>;
  const matchLabels = s.matchLabels && typeof s.matchLabels === 'object' ? s.matchLabels : s;
  for (const [key, expected] of Object.entries(matchLabels)) {
    if (key === 'matchLabels' || key === 'matchExpressions') {
      continue;
    }
    if (String(l[key]) !== String(expected)) {
      return false;
    }
  }
  for (const expression of Array.isArray(s.matchExpressions) ? s.matchExpressions : []) {
    const key = String(expression.key || '');
    const operator = String(expression.operator || '');
    const values = new Set((expression.values || []).map((value: unknown) => String(value)));
    const exists = Object.prototype.hasOwnProperty.call(l, key);
    const value = String(l[key]);
    if (operator === 'In' && (!exists || !values.has(value))) return false;
    if (operator === 'NotIn' && exists && values.has(value)) return false;
    if (operator === 'Exists' && !exists) return false;
    if (operator === 'DoesNotExist' && exists) return false;
  }
  return true;
}

function taintTolerated(taint: any, tolerations: any[]): boolean {
  const key = String(taint?.key || '');
  const value = String(taint?.value || '');
  const effect = String(taint?.effect || '');
  return tolerations.some(toleration => {
    const operator = String(toleration?.operator || 'Equal');
    const tolerationEffect = String(toleration?.effect || '');
    if (tolerationEffect && effect && tolerationEffect !== effect) {
      return false;
    }
    if (operator === 'Exists') {
      return !toleration?.key || String(toleration.key) === key;
    }
    return String(toleration?.key || '') === key && String(toleration?.value || '') === value;
  });
}

function runAsUserValue(value: unknown): { set: boolean; value: number } {
  if (value === undefined || value === null || value === '') {
    return { set: false, value: 0 };
  }

  const numericValue = Number(value);
  return { set: Number.isFinite(numericValue), value: numericValue };
}

function replicatedWorkloadMissingSpread(workload: any): boolean {
  const replicas = Number(json(workload)?.spec?.replicas || 1);
  if (replicas <= 1) {
    return false;
  }

  const podSpec = json(workload)?.spec?.template?.spec;
  if (!podSpec) {
    return false;
  }

  return !(
    (podSpec.affinity?.podAntiAffinity?.requiredDuringSchedulingIgnoredDuringExecution || [])
      .length ||
    (podSpec.affinity?.podAntiAffinity?.preferredDuringSchedulingIgnoredDuringExecution || [])
      .length ||
    (podSpec.topologySpreadConstraints || []).length
  );
}

function serviceAccountName(pod: any): string {
  return json(pod)?.spec?.serviceAccountName || 'default';
}

function daysSince(timestamp?: string): number | null {
  if (!timestamp) {
    return null;
  }

  const time = new Date(timestamp).getTime();
  if (Number.isNaN(time)) {
    return null;
  }

  return Math.floor((Date.now() - time) / 86400000);
}

function nodeReady(node: any): boolean {
  return (json(node)?.status?.conditions || []).some(
    (condition: any) => condition.type === 'Ready' && condition.status === 'True'
  );
}

function nodePressureFindings(resources: ResourceStates): Finding[] {
  return resources.node.data.flatMap(node =>
    (json(node)?.status?.conditions || [])
      .filter(
        (condition: any) =>
          ['MemoryPressure', 'DiskPressure', 'PIDPressure'].includes(condition?.type) &&
          condition?.status === 'True'
      )
      .map((condition: any) =>
        finding(
          node,
          `${condition.type}: ${condition.reason || condition.message || 'condition is True'}`
        )
      )
  );
}

function clusterStoragePressureFindings(resources: ResourceStates): Finding[] {
  const pressured = resources.node.data.filter(node =>
    (json(node)?.status?.conditions || []).some(
      (condition: any) => condition?.type === 'DiskPressure' && condition?.status === 'True'
    )
  );
  return pressured.length > 0
    ? [
        {
          resource: 'cluster/storage',
          kind: 'Node',
          details: `DiskPressure reported by nodes: ${pressured.map(name).join(', ')}`,
        },
      ]
    : [];
}

function validatingAdmissionPolicyBindingFindings(resources: ResourceStates): Finding[] {
  const boundPolicies = new Set(
    resources.validatingadmissionpolicybinding.data.map(binding =>
      String(json(binding)?.spec?.policyName || '')
    )
  );
  return resources.validatingadmissionpolicy.data
    .filter(policy => !boundPolicies.has(name(policy)))
    .map(policy =>
      finding(
        policy,
        `ValidatingAdmissionPolicy ${name(policy)} has no ValidatingAdmissionPolicyBinding`
      )
    );
}
export function normalizeSeverity(severity: string): Severity {
  const normalized = severity.toLowerCase();
  if (normalized === 'critical' || normalized === 'high' || normalized === 'error') {
    return 'high';
  }
  if (normalized === 'warning') {
    return 'warning';
  }
  if (normalized === 'medium') {
    return 'medium';
  }
  return 'low';
}

type ScoreCompatOverride = {
  weight?: number;
  findingCount?: number;
};

const SCORE_COMPAT_OVERRIDES: Record<string, ScoreCompatOverride> = {
  NET004: { weight: 3 },
  NET005: { weight: 5 },
  NET007: { weight: 4 },
  NET012: { weight: 4 },
  NODE002: { weight: 6, findingCount: 0 },
  NODE003: { weight: 2 },
  NS004: { weight: 1 },
  POD008: { weight: 3 },
  SC002: { weight: 2, findingCount: 1 },
  SEC007: { weight: 1 },
  SEC008: { weight: 4 },
  SEC014: { weight: 3 },
  SEC015: { weight: 3 },
  SEC016: { weight: 3 },
  SEC017: { weight: 3 },
  SEC018: { weight: 3 },
  WRK010: { weight: 3 },
  WRK015: { weight: 3 },
};

function scoreWeight(check: CheckResult): number {
  return SCORE_COMPAT_OVERRIDES[check.id]?.weight ?? check.weight;
}

function scoreFindingCount(check: CheckResult): number {
  return SCORE_COMPAT_OVERRIDES[check.id]?.findingCount ?? check.findings.length;
}

export function scoreChecks(checks: CheckResult[]): Score {
  const scoreableChecks = checks.filter(check => check.status !== 'skipped');
  const failedChecks = scoreableChecks.filter(check => check.status === 'failed');
  const totalWeight = scoreableChecks.reduce((total, check) => total + scoreWeight(check), 0);
  const earnedWeight = scoreableChecks.reduce((total, check) => {
    const weight = scoreWeight(check);
    if (weight <= 0) {
      return total;
    }
    return total + weight / (scoreFindingCount(check) + 1);
  }, 0);
  const failedWeight = Math.max(0, totalWeight - earnedWeight);
  const value = totalWeight === 0 ? 100 : Math.round((earnedWeight / totalWeight) * 100);

  return {
    value,
    passed: scoreableChecks.length - failedChecks.length,
    failed: failedChecks.length,
    skipped: checks.length - scoreableChecks.length,
    total: scoreableChecks.length,
    failedWeight,
    totalWeight,
  };
}

function normalizeResourceKind(kind: string): string {
  return kind.toLowerCase().replace(/\s+/g, '');
}

function getResourcesForCheck(check: GeneratedCheck, resources: ResourceStates): any[] | null {
  return resources[normalizeResourceKind(check.resourceKind)]?.data || null;
}

function resolveExpression(item: any, expression?: GeneratedExpression): unknown {
  if (!expression) {
    return undefined;
  }
  if (expression.path) {
    return resolvePath(item, expression.path);
  }
  if ('value' in expression) {
    return expression.value;
  }
  if (expression.count_where) {
    const items = toArray(resolvePath(item, expression.count_where.path));
    return items.filter(candidate => evaluatePredicate(candidate, expression.count_where!.where))
      .length;
  }
  if (expression.coalesce?.length) {
    for (const candidate of expression.coalesce) {
      const value = resolveExpression(item, candidate);
      if (value !== undefined && value !== null) {
        return value;
      }
    }
    return undefined;
  }
  if (expression.any?.length) {
    return expression.any.some(predicate => evaluatePredicate(item, predicate));
  }
  if (expression.all?.length) {
    return expression.all.every(predicate => evaluatePredicate(item, predicate));
  }
  return undefined;
}

function evaluatePredicate(item: any, predicate: GeneratedPredicate): boolean {
  if (predicate.any?.length) {
    return predicate.any.some(child => evaluatePredicate(item, child));
  }
  if (predicate.all?.length) {
    return predicate.all.every(child => evaluatePredicate(item, child));
  }

  const actual = resolvePath(item, predicate.path || '');
  return !evaluateOperator(predicate.operator || 'exists', actual, predicate.expected);
}

function resolvePath(item: any, path: string): unknown {
  let current = item;

  for (const part of path.split('.').filter(Boolean)) {
    const flatten = part.endsWith('[]');
    const field = part.replace(/\[\]$/, '');

    current = lookupField(current, field);
    if (current === undefined || current === null) {
      return current;
    }
    if (flatten) {
      current = toArray(current);
    }
  }

  return current;
}

function lookupField(item: any, field: string): unknown {
  if (Array.isArray(item)) {
    const values = item.flatMap(candidate => {
      const value = lookupField(candidate, field);
      return Array.isArray(value) ? value : value === undefined ? [] : [value];
    });
    return values.length > 0 ? values : undefined;
  }

  if (item && typeof item === 'object') {
    const key = Object.keys(item).find(
      candidate => candidate.toLowerCase() === field.toLowerCase()
    );
    return key ? item[key] : undefined;
  }

  return undefined;
}

function evaluateOperator(operator: string, actual: unknown, expected: unknown): boolean {
  const expectedValues = normalizeExpected(expected);

  switch (operator) {
    case 'equals':
      return !matchesAny(actual, expectedValues);
    case 'not_equals':
      return matchesAny(actual, expectedValues);
    case 'contains':
      return !containsAny(actual, expectedValues);
    case 'not_contains':
      return containsAny(actual, expectedValues);
    case 'exists':
      return actual === undefined || actual === null;
    case 'missing':
      return actual !== undefined && actual !== null;
    case 'greater_than':
      return !compareNumber(actual, expectedValues[0], (a, b) => a > b);
    case 'greater_than_or_equal':
      return !compareNumber(actual, expectedValues[0], (a, b) => a >= b);
    case 'less_than':
      return !compareNumber(actual, expectedValues[0], (a, b) => a < b);
    case 'less_than_or_equal':
      return !compareNumber(actual, expectedValues[0], (a, b) => a <= b);
    default:
      return false;
  }
}

function normalizeExpected(expected: unknown): unknown[] {
  if (typeof expected === 'string' && expected.includes(',')) {
    return expected.split(',').map(value => (value === 'null' ? null : value));
  }
  return Array.isArray(expected) ? expected : [expected];
}

function matchesAny(actual: unknown, expectedValues: unknown[]): boolean {
  const actualValues = toArray(actual);
  return actualValues.some(actualValue =>
    expectedValues.some(expectedValue => String(actualValue) === String(expectedValue))
  );
}

function containsAny(actual: unknown, expectedValues: unknown[]): boolean {
  return toArray(actual).some(actualValue =>
    expectedValues.some(expectedValue => String(actualValue).includes(String(expectedValue)))
  );
}

function compareNumber(
  actual: unknown,
  expected: unknown,
  compare: (actual: number, expected: number) => boolean
) {
  const actualNumber = Number(toArray(actual)[0]);
  const expectedNumber = Number(expected);
  return (
    Number.isFinite(actualNumber) &&
    Number.isFinite(expectedNumber) &&
    compare(actualNumber, expectedNumber)
  );
}

function toArray(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function valueDetails(check: GeneratedCheck, value: unknown) {
  const path = check.value?.path || check.operator || 'value';
  const display = Array.isArray(value) ? value.join(', ') : String(value ?? 'missing');
  return `${path}: ${display}`;
}

function suppressionIncludesCheck(raw: string, checkId: string): boolean {
  const normalizedCheckId = checkId.trim().toUpperCase();
  return raw
    .split(/[,\s;]+/)
    .map(token => token.trim().toUpperCase())
    .filter(Boolean)
    .some(token => token === '*' || token === normalizedCheckId);
}

function suppressionExpired(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) && Date.now() > parsed;
}

function suppressesFinding(
  checkId: string,
  finding: Finding
): { reason?: string; until?: string } | null {
  const annotations = finding.sourceAnnotations || {};
  const ignoredChecks = String(annotations[IGNORE_CHECKS_ANNOTATION] || '').trim();
  if (!ignoredChecks || !suppressionIncludesCheck(ignoredChecks, checkId)) {
    return null;
  }

  const until = String(annotations[IGNORE_UNTIL_ANNOTATION] || '').trim();
  if (until && suppressionExpired(until)) {
    return null;
  }

  return {
    reason: String(annotations[IGNORE_REASON_ANNOTATION] || '').trim(),
    until,
  };
}

function applyFindingSuppressions(
  checkId: string,
  findings: Finding[]
): {
  findings: Finding[];
  suppressedFindings: SuppressedFinding[];
} {
  const active: Finding[] = [];
  const suppressedFindings: SuppressedFinding[] = [];
  const publicFinding = (finding: Finding): Finding => {
    const copy = { ...finding };
    delete copy.sourceAnnotations;
    return copy;
  };

  findings.forEach(finding => {
    const suppression = suppressesFinding(checkId, finding);
    if (!suppression) {
      active.push(publicFinding(finding));
      return;
    }

    suppressedFindings.push({
      ...publicFinding(finding),
      suppressionReason: suppression.reason,
      suppressionUntil: suppression.until,
    });
  });

  return { findings: active, suppressedFindings };
}

export function resultFromCheck(
  check: GeneratedCheck,
  findings: Finding[],
  status?: CheckStatus,
  skippedReason?: string
): CheckResult {
  const suppression = applyFindingSuppressions(check.id, findings);
  const finalStatus = status || (suppression.findings.length > 0 ? 'failed' : 'passed');
  return {
    id: check.id,
    name: check.name,
    category: check.category,
    section: check.section,
    severity: normalizeSeverity(check.severity),
    weight: check.weight,
    description: check.description,
    failMessage: check.failMessage,
    recommendation: check.recommendation,
    recommendationHtml: check.recommendationHtml,
    docs: check.url,
    nativeHandler: check.nativeHandler,
    sourceFile: check.sourceFile,
    resourceKind: check.resourceKind,
    status: finalStatus,
    skippedReason,
    findings: suppression.findings,
    suppressedFindings: suppression.suppressedFindings,
  };
}

function isSensitiveHostPath(path: string): boolean {
  const normalized = path.trim().toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '');
  if (!normalized) {
    return false;
  }
  const exact = new Set([
    '/',
    '/etc',
    '/proc',
    '/sys',
    '/var/run/docker.sock',
    '/run/docker.sock',
    '/run/containerd/containerd.sock',
    '/var/run/containerd/containerd.sock',
  ]);
  return (
    exact.has(normalized) ||
    [
      '/etc/',
      '/proc/',
      '/sys/',
      '/var/lib/kubelet',
      '/var/lib/containerd',
      '/var/run/secrets',
    ].some(prefix => normalized.startsWith(prefix))
  );
}

function podSecurityHandlers(resources: ResourceStates): Record<string, Finding[]> {
  const pods = resources.pod.data;
  return {
    SEC002: pods
      .filter(pod => json(pod)?.spec?.hostPID || json(pod)?.spec?.hostNetwork)
      .map(pod => {
        const yamlPath = json(pod)?.spec?.hostPID ? 'spec.hostPID' : 'spec.hostNetwork';
        return finding(pod, 'hostPID or hostNetwork enabled', 'hostPID or hostNetwork enabled', {
          yamlPath,
        });
      }),
    SEC003: pods.flatMap(pod => {
      const podUser = runAsUserValue(json(pod)?.spec?.securityContext?.runAsUser);
      return allPodContainers(pod).flatMap(container => {
        const containerUser = runAsUserValue(container?.securityContext?.runAsUser);
        const issue = rootUserIssue(container.securityContext, json(pod)?.spec?.securityContext);

        if (!issue) {
          return [];
        }

        const options = containerUser.set
          ? containerYamlOptions(pod, container, 'securityContext.runAsUser')
          : podUser.set
          ? { yamlPath: 'spec.securityContext.runAsUser', yamlValue: podUser.value }
          : containerYamlOptions(
              pod,
              container,
              'securityContext',
              container.securityContext || {}
            );
        return [
          finding(
            pod,
            `Container ${container.name} ${issue}`,
            `Container ${container.name} ${issue}`,
            options
          ),
        ];
      });
    }),
    SEC004: pods.flatMap(pod =>
      containers(pod)
        .filter(container => container?.securityContext?.privileged)
        .map(container =>
          finding(
            pod,
            `Container ${container.name} is privileged`,
            `Container ${container.name} is privileged`,
            containerYamlOptions(pod, container, 'securityContext.privileged')
          )
        )
    ),
    SEC005: pods
      .filter(pod => json(pod)?.spec?.hostIPC)
      .map(pod => finding(pod, 'hostIPC enabled', 'hostIPC enabled', { yamlPath: 'spec.hostIPC' })),
    SEC006: pods.flatMap(pod =>
      containers(pod, false)
        .filter(container => {
          const context = container?.securityContext;
          return (
            !context ||
            context.runAsNonRoot !== true ||
            context.readOnlyRootFilesystem !== true ||
            context.allowPrivilegeEscalation !== false
          );
        })
        .map(container =>
          finding(
            pod,
            `Container ${container.name} missing hardened securityContext`,
            `Container ${container.name} missing hardened securityContext`,
            containerYamlOptions(pod, container, 'securityContext', container.securityContext || {})
          )
        )
    ),
    SEC008: pods.flatMap(pod =>
      containers(pod).flatMap(container =>
        (container.env || [])
          .filter((env: any) => env?.valueFrom?.secretKeyRef?.name)
          .map((env: any) =>
            finding(
              pod,
              `Secret exposed through env ${env.name} in ${container.name}`,
              `Secret exposed through env ${env.name} in ${container.name}`,
              containerYamlOptions(
                pod,
                container,
                `env[name=${env.name || 'unknown'}].valueFrom.secretKeyRef`,
                env.valueFrom.secretKeyRef
              )
            )
          )
      )
    ),
    SEC009: pods.flatMap(pod =>
      containers(pod, false)
        .filter(
          container =>
            !(container?.securityContext?.capabilities?.drop || []).some(
              (value: any) => String(value).toLowerCase() === 'all'
            )
        )
        .map(container =>
          finding(
            pod,
            `Container ${container.name} does not drop ALL capabilities`,
            `Container ${container.name} does not drop ALL capabilities`,
            containerYamlOptions(
              pod,
              container,
              'securityContext.capabilities.drop',
              container?.securityContext?.capabilities?.drop || []
            )
          )
        )
    ),
    SEC010: pods.flatMap(pod =>
      (json(pod)?.spec?.volumes || [])
        .filter((volume: any) => volume.hostPath?.path)
        .map((volume: any) =>
          finding(
            pod,
            `hostPath volume ${volume.name}: ${volume.hostPath.path}`,
            `hostPath volume ${volume.name}: ${volume.hostPath.path}`,
            {
              yamlPath: `spec.volumes[name=${volume.name || 'unknown'}].hostPath`,
              yamlValue: volume.hostPath,
            }
          )
        )
    ),
    SEC011: pods.flatMap(pod =>
      containers(pod, false)
        .filter(container => Number(container?.securityContext?.runAsUser || 0) === 0)
        .map(container =>
          finding(
            pod,
            `Container ${container.name} runs as UID 0`,
            `Container ${container.name} runs as UID 0`,
            containerYamlOptions(
              pod,
              container,
              'securityContext.runAsUser',
              container?.securityContext?.runAsUser || 0
            )
          )
        )
    ),
    SEC012: pods.flatMap(pod =>
      containers(pod, false)
        .filter(container => (container?.securityContext?.capabilities?.add || []).length > 0)
        .map(container =>
          finding(
            pod,
            `Container ${container.name} adds capabilities`,
            `Container ${container.name} adds capabilities`,
            containerYamlOptions(pod, container, 'securityContext.capabilities.add')
          )
        )
    ),
    SEC013: pods.flatMap(pod =>
      (json(pod)?.spec?.volumes || [])
        .filter((volume: any) => volume.emptyDir)
        .map((volume: any) =>
          finding(pod, `emptyDir volume ${volume.name}`, `emptyDir volume ${volume.name}`, {
            yamlPath: `spec.volumes[name=${volume.name || 'unknown'}].emptyDir`,
            yamlValue: volume.emptyDir,
          })
        )
    ),
    SEC016: pods.flatMap(pod =>
      containers(pod)
        .filter(container => container?.securityContext?.windowsOptions?.hostProcess)
        .map(container =>
          finding(
            pod,
            `Windows HostProcess container ${container.name}`,
            `Windows HostProcess container ${container.name}`,
            containerYamlOptions(pod, container, 'securityContext.windowsOptions.hostProcess')
          )
        )
    ),
    SEC017: pods.flatMap(pod =>
      containers(pod)
        .filter(container => container?.securityContext?.procMount === 'Unmasked')
        .map(container =>
          finding(
            pod,
            `Container ${container.name} uses Unmasked procMount`,
            `Container ${container.name} uses Unmasked procMount`,
            containerYamlOptions(pod, container, 'securityContext.procMount')
          )
        )
    ),
    SEC019: pods.flatMap(pod => [
      ...Object.entries(objectAnnotations(pod))
        .filter(
          ([key, value]) =>
            key.startsWith('container.apparmor.security.beta.kubernetes.io/') &&
            !['runtime/default'].includes(String(value)) &&
            !String(value).startsWith('localhost/')
        )
        .map(([key, value]) =>
          finding(pod, `Unsupported AppArmor annotation value on ${key}: ${value}`)
        ),
      ...[...containers(pod), ...(json(pod)?.spec?.ephemeralContainers || [])]
        .filter(container => {
          const profileType = stringValue(container?.securityContext?.appArmorProfile?.type);
          return (
            profileType !== '' && profileType !== 'RuntimeDefault' && profileType !== 'Localhost'
          );
        })
        .map(container =>
          finding(
            pod,
            `Container ${container.name} uses unsupported AppArmor profile type ${container.securityContext.appArmorProfile.type}`
          )
        ),
    ]),
    SEC020: pods.flatMap(pod =>
      containers(pod)
        .filter(
          container =>
            !container?.securityContext?.seccompProfile?.type &&
            !json(pod)?.spec?.securityContext?.seccompProfile?.type
        )
        .map(container =>
          finding(
            pod,
            `Container ${container.name} has no seccomp profile`,
            `Container ${container.name} has no seccomp profile`,
            containerYamlOptions(
              pod,
              container,
              'securityContext.seccompProfile',
              container?.securityContext?.seccompProfile || {}
            )
          )
        )
    ),
    SEC021: pods.flatMap(pod =>
      containers(pod).flatMap(container =>
        (container.ports || [])
          .filter((port: any) => Number(port.hostPort) > 0)
          .map((port: any) =>
            finding(
              pod,
              `Container ${container.name} uses hostPort ${port.hostPort}`,
              `Container ${container.name} uses hostPort ${port.hostPort}`,
              containerYamlOptions(pod, container, 'ports', container.ports)
            )
          )
      )
    ),
    SEC015: pods
      .filter(pod => serviceAccountName(pod) === 'default')
      .map(pod =>
        finding(pod, 'Uses default ServiceAccount', 'Uses default ServiceAccount', {
          yamlPath: 'spec.serviceAccountName',
          yamlValue: serviceAccountName(pod),
        })
      ),
    SEC023: pods.flatMap(pod =>
      (json(pod)?.spec?.securityContext?.sysctls || [])
        .filter(
          (sysctl: any) =>
            ![
              'kernel.shm_rmid_forced',
              'net.ipv4.ip_local_port_range',
              'net.ipv4.ip_unprivileged_port_start',
              'net.ipv4.tcp_syncookies',
              'net.ipv4.ping_group_range',
            ].includes(String(sysctl?.name || ''))
        )
        .map((sysctl: any) =>
          finding(pod, `Disallowed sysctl ${sysctl.name}`, `Disallowed sysctl ${sysctl.name}`, {
            yamlPath: 'spec.securityContext.sysctls',
            yamlValue: json(pod)?.spec?.securityContext?.sysctls,
          })
        )
    ),
    SEC027: pods.flatMap(pod =>
      (json(pod)?.spec?.volumes || [])
        .filter((volume: any) => volume.gitRepo)
        .map((volume: any) =>
          finding(
            pod,
            `gitRepo volume ${volume.name}: ${volume.gitRepo.repository || 'repository not set'}`,
            `gitRepo volume ${volume.name}`,
            {
              yamlPath: `spec.volumes[name=${volume.name || 'unknown'}].gitRepo`,
              yamlValue: volume.gitRepo,
            }
          )
        )
    ),
    SEC029: pods.flatMap(pod =>
      (json(pod)?.spec?.volumes || [])
        .filter(
          (volume: any) =>
            volume.hostPath?.path && isSensitiveHostPath(String(volume.hostPath.path))
        )
        .map((volume: any) =>
          finding(
            pod,
            `hostPath volume ${volume.name}: ${volume.hostPath.path}`,
            `hostPath volume ${volume.name}: ${volume.hostPath.path}`,
            {
              yamlPath: `spec.volumes[name=${volume.name || 'unknown'}].hostPath.path`,
              yamlValue: volume.hostPath.path,
            }
          )
        )
    ),
  };
}

function workloadResourceFindings(
  resources: ResourceStates,
  mode: 'requests' | 'limits',
  memoryOnly = false
): Finding[] {
  const required: ('cpu' | 'memory')[] = memoryOnly ? ['memory'] : ['cpu', 'memory'];
  return allWorkloads(resources).flatMap(workload =>
    workloadAllContainers(workload).flatMap(container => {
      const missing = required.filter(resource => !hasResource(container, mode, resource));
      if (missing.length === 0) {
        return [];
      }

      const noun = mode === 'requests' ? 'request' : 'limit';
      return [
        finding(
          workload,
          `Container ${container.name} missing ${missing
            .map(resource => `${resource.toUpperCase()} ${noun}`)
            .join(', ')}`
        ),
      ];
    })
  );
}

function workloadProbeFindings(resources: ResourceStates): Finding[] {
  return allWorkloads(resources).flatMap(workload =>
    workloadContainers(workload)
      .filter(container => !hasProbe(container))
      .map(container =>
        finding(workload, `Container ${container.name} missing readiness or liveness probe`)
      )
  );
}

function namespaceHasAny(
  resources: ResourceStates,
  namespaceName: string,
  kinds: string[]
): boolean {
  return kinds.some(kind => resources[kind].data.some(item => namespace(item) === namespaceName));
}

function namespaceHygieneFindings(resources: ResourceStates): Finding[] {
  const trackedKinds = [
    'secret',
    'persistentvolumeclaim',
    'service',
    'configmap',
    'deployment',
    'statefulset',
    'daemonset',
  ];

  return resources.namespace.data
    .filter(ns => !isBuiltInNamespace(name(ns)))
    .filter(ns => !namespaceHasAny(resources, name(ns), ['pod']))
    .map(ns =>
      finding(
        ns,
        namespaceHasAny(resources, name(ns), trackedKinds)
          ? 'No pods, but other resources exist'
          : 'Namespace has no workloads or tracked resources'
      )
    );
}

function usedConfigMapKeys(resources: ResourceStates): Set<string> {
  const used = new Set<string>();
  resources.pod.data.forEach(pod => {
    const ns = namespace(pod) || 'default';
    (json(pod)?.spec?.volumes || []).forEach(
      (volume: any) => volume.configMap?.name && used.add(`${ns}/${volume.configMap.name}`)
    );
    containers(pod).forEach(container => {
      (container.env || []).forEach(
        (env: any) =>
          env?.valueFrom?.configMapKeyRef?.name &&
          used.add(`${ns}/${env.valueFrom.configMapKeyRef.name}`)
      );
      (container.envFrom || []).forEach(
        (env: any) => env?.configMapRef?.name && used.add(`${ns}/${env.configMapRef.name}`)
      );
    });
  });
  return used;
}

function usedSecretKeys(resources: ResourceStates): Set<string> {
  const used = new Set<string>();
  const addSecret = (ns: string, secretName: string) => {
    if (!secretName) {
      return;
    }
    used.add(`${ns}/${secretName}`);
    used.add(`*/${secretName}`);
  };
  const addPodSpecSecretRefs = (podSpec: any, ns: string) => {
    (podSpec?.imagePullSecrets || []).forEach((secret: any) => addSecret(ns, secret.name));
    (podSpec?.volumes || []).forEach((volume: any) => addSecret(ns, volume.secret?.secretName));
    [
      ...(podSpec?.containers || []),
      ...(podSpec?.initContainers || []),
      ...(podSpec?.ephemeralContainers || []),
    ].forEach((container: any) => {
      (container.env || []).forEach((env: any) =>
        addSecret(ns, env?.valueFrom?.secretKeyRef?.name)
      );
      (container.envFrom || []).forEach((env: any) => addSecret(ns, env?.secretRef?.name));
    });
  };

  resources.pod.data.forEach(pod => {
    addPodSpecSecretRefs(json(pod)?.spec, namespace(pod) || 'default');
  });
  allWorkloads(resources).forEach(workload => {
    addPodSpecSecretRefs(workloadTemplate(workload)?.spec, namespace(workload) || 'default');
  });
  resources.ingress.data.forEach(ingress => {
    const ns = namespace(ingress) || 'default';
    (json(ingress)?.spec?.tls || []).forEach((tls: any) => addSecret(ns, tls.secretName));
  });
  resources.serviceaccount.data.forEach(sa => {
    const ns = namespace(sa) || 'default';
    (json(sa)?.secrets || []).forEach((secret: any) => addSecret(ns, secret.name));
  });
  return used;
}

function missingSecretReferenceFindings(resources: ResourceStates): Finding[] {
  const existing = new Set(
    resources.secret.data.map(secret => `${namespace(secret) || 'default'}/${name(secret)}`)
  );
  const findings: Finding[] = [];

  resources.pod.data.forEach(pod => {
    const ns = namespace(pod) || 'default';
    const podName = name(pod);
    const missing = (secretName: string, detail: string) => {
      if (secretName && !existing.has(`${ns}/${secretName}`)) {
        findings.push(
          finding(
            pod,
            `${detail} references missing Secret ${secretName}`,
            `Pod ${podName} references missing Secret ${secretName}`
          )
        );
      }
    };

    (json(pod)?.spec?.volumes || []).forEach((volume: any) => {
      if (volume.secret?.optional !== true) {
        missing(volume.secret?.secretName || '', `Volume ${volume.name || 'unknown'}`);
      }
    });
    containers(pod).forEach(container => {
      (container.env || []).forEach((env: any) => {
        if (env?.valueFrom?.secretKeyRef?.optional !== true) {
          missing(
            env?.valueFrom?.secretKeyRef?.name || '',
            `Container ${container.name} env ${env.name || 'unknown'}`
          );
        }
      });
      (container.envFrom || []).forEach((envFrom: any) => {
        if (envFrom?.secretRef?.optional !== true) {
          missing(envFrom?.secretRef?.name || '', `Container ${container.name} envFrom`);
        }
      });
    });
  });

  return findings;
}

function rbacResourceKey(resource: any): string {
  return `${namespace(resource) || ''}/${name(resource)}`;
}

function ruleContains(rule: any, field: string, expected: string): boolean {
  return (rule?.[field] || []).includes(expected);
}

function roleIsWildcard(role: any): boolean {
  return (json(role)?.rules || []).some(
    (rule: any) =>
      ruleContains(rule, 'verbs', '*') &&
      ruleContains(rule, 'resources', '*') &&
      ruleContains(rule, 'apiGroups', '*')
  );
}

function roleIsSensitive(role: any): boolean {
  const sensitive = new Set([
    'secrets',
    'pods/exec',
    'roles',
    'clusterroles',
    'bindings',
    'clusterrolebindings',
  ]);
  const dangerous = new Set(['*', 'create', 'update', 'delete']);

  return (json(role)?.rules || []).some((rule: any) => {
    const resources = rule?.resources || [];
    const verbs = rule?.verbs || [];

    return (
      resources.some((resource: string) => sensitive.has(resource)) &&
      verbs.some((verb: string) => dangerous.has(verb))
    );
  });
}

function isBuiltInClusterRole(role: any): boolean {
  const roleName = name(role);
  const labels = objectLabels(role);
  const aksManagedClusterRoles = new Set([
    'aks-secretproviderclasses-admin-role',
    'aks-secretproviderclasses-viewer-role',
    'aks-service',
    'aks:trustedaccessrole:defender-cloudposture:microsoft-defender-operator',
  ]);

  if (['cluster-admin', 'admin', 'edit', 'view', 'system:public-info-viewer'].includes(roleName)) {
    return true;
  }

  return (
    roleName.startsWith('system:') ||
    roleName.startsWith('system:kube-') ||
    roleName.startsWith('system:node') ||
    aksManagedClusterRoles.has(roleName) ||
    labels['kubernetes.io/bootstrapping'] === 'rbac-defaults'
  );
}

function isDefaultKubernetesRBACBinding(binding: any): boolean {
  const bindingName = name(binding);
  const aksManagedBindings = new Set([
    'aks-cluster-admin-binding',
    'aks-cluster-admin-binding-aad',
    'aks-secretprovidersyncing-rolebinding',
    'aks-service-rolebinding',
  ]);

  return (
    bindingName.startsWith('system:') ||
    aksManagedBindings.has(bindingName) ||
    objectLabels(binding)['kubernetes.io/bootstrapping'] === 'rbac-defaults'
  );
}

function namespaceFromServiceAccountUsername(subjectName: string): string {
  const prefix = 'system:serviceaccount:';
  if (!subjectName.startsWith(prefix)) {
    return '';
  }

  return subjectName.slice(prefix.length).split(':')[0] || '';
}

function isKubernetesSystemSubjectName(subjectName: string): boolean {
  return (
    subjectName === 'system:masters' ||
    subjectName === 'system:nodes' ||
    subjectName.startsWith('system:node:') ||
    subjectName.startsWith('system:kube-') ||
    subjectName.startsWith('system:serviceaccount:kube-system:')
  );
}

function isExcludedRBACNamespace(namespaceName: string, config: KubeBuddyConfig): boolean {
  return namespaceSet(config.excludedNamespaces).has(namespaceName.trim().toLowerCase());
}

function isReportableRBACSubject(
  subject: any,
  defaultNamespace: string,
  config: KubeBuddyConfig
): boolean {
  const subjectKind = String(subject?.kind || '').trim();
  const subjectName = String(subject?.name || '').trim();

  if (subjectKind === 'ServiceAccount') {
    const subjectNamespace = String(subject?.namespace || defaultNamespace || '').trim();
    return !isExcludedRBACNamespace(subjectNamespace, config);
  }

  if (subjectKind === 'User') {
    const serviceAccountNamespace = namespaceFromServiceAccountUsername(subjectName);
    if (serviceAccountNamespace && isExcludedRBACNamespace(serviceAccountNamespace, config)) {
      return false;
    }

    return !isKubernetesSystemSubjectName(subjectName);
  }

  if (subjectKind === 'Group') {
    return !isKubernetesSystemSubjectName(subjectName);
  }

  return true;
}

function bindingHasReportableRBACSubject(
  binding: any,
  defaultNamespace: string,
  config: KubeBuddyConfig
): boolean {
  const subjects = json(binding)?.subjects || [];

  return (
    subjects.length === 0 ||
    subjects.some((subject: any) => isReportableRBACSubject(subject, defaultNamespace, config))
  );
}

function overexposureMessage(roleName: string, wildcard: boolean, sensitive: boolean): string {
  if (roleName === 'cluster-admin') {
    return 'cluster-admin binding';
  }

  if (wildcard) {
    return 'Wildcard permission role';
  }

  if (sensitive) {
    return 'Access to sensitive resources';
  }

  return 'RBAC overexposure';
}

function rbacMisconfigFindings(resources: ResourceStates, config: KubeBuddyConfig): Finding[] {
  const namespaces = new Set(resources.namespace.data.map(ns => name(ns)));
  const roles = new Set(resources.role.data.map(role => rbacResourceKey(role)));
  const clusterRoles = new Set(resources.clusterrole.data.map(role => name(role)));
  const serviceAccounts = new Set(resources.serviceaccount.data.map(sa => rbacResourceKey(sa)));
  const findings: Finding[] = [];

  resources.rolebinding.data.forEach(binding => {
    const bindingNamespace = namespace(binding) || 'default';
    const roleRef = json(binding)?.roleRef;
    const roleName = roleRef?.name || '';

    if (!roleRef) {
      findings.push(finding(binding, 'Missing roleRef in RoleBinding'));
      return;
    }

    if (roleRef.kind === 'Role' && !roles.has(`${bindingNamespace}/${roleName}`)) {
      findings.push(finding(binding, `Missing Role: ${roleName}`));
    }

    if (roleRef.kind === 'ClusterRole' && !clusterRoles.has(roleName)) {
      findings.push(finding(binding, `Missing ClusterRole: ${roleName}`));
    }

    (json(binding)?.subjects || []).forEach((subject: any) => {
      if (subject?.kind !== 'ServiceAccount') {
        return;
      }

      const subjectNamespace = subject.namespace || bindingNamespace;
      if (isExcludedRBACNamespace(subjectNamespace, config)) {
        return;
      }

      if (!namespaces.has(subjectNamespace)) {
        findings.push(
          finding(binding, `ServiceAccount namespace does not exist: ${subjectNamespace}`)
        );
      } else if (!serviceAccounts.has(`${subjectNamespace}/${subject.name}`)) {
        findings.push(
          finding(binding, `ServiceAccount not found: ${subjectNamespace}/${subject.name}`)
        );
      }
    });
  });

  resources.clusterrolebinding.data.forEach(binding => {
    const roleRef = json(binding)?.roleRef;
    const roleName = roleRef?.name || '';

    if (!roleRef) {
      findings.push(finding(binding, 'Missing roleRef in ClusterRoleBinding'));
      return;
    }

    if (roleName && !clusterRoles.has(roleName)) {
      findings.push(finding(binding, `Missing ClusterRole: ${roleName}`));
    }

    (json(binding)?.subjects || []).forEach((subject: any) => {
      if (subject?.kind !== 'ServiceAccount') {
        return;
      }

      if (!subject.namespace) {
        findings.push(
          finding(binding, `Missing namespace for ServiceAccount subject: ${subject.name}`)
        );
        return;
      }

      if (isExcludedRBACNamespace(subject.namespace, config)) {
        return;
      }

      if (!namespaces.has(subject.namespace)) {
        findings.push(
          finding(binding, `ServiceAccount namespace does not exist: ${subject.namespace}`)
        );
      } else if (!serviceAccounts.has(`${subject.namespace}/${subject.name}`)) {
        findings.push(
          finding(binding, `ServiceAccount not found: ${subject.namespace}/${subject.name}`)
        );
      }
    });
  });

  return findings;
}

function rbacOverexposureFindings(resources: ResourceStates, config: KubeBuddyConfig): Finding[] {
  const wildcardClusterRoles = new Set<string>();
  const sensitiveClusterRoles = new Set<string>();
  const wildcardRoles = new Set<string>();
  const sensitiveRoles = new Set<string>();

  resources.clusterrole.data.forEach(role => {
    if (roleIsWildcard(role)) {
      wildcardClusterRoles.add(name(role));
    }
    if (roleIsSensitive(role)) {
      sensitiveClusterRoles.add(name(role));
    }
  });

  resources.role.data.forEach(role => {
    const key = rbacResourceKey(role);
    if (roleIsWildcard(role)) {
      wildcardRoles.add(key);
    }
    if (roleIsSensitive(role)) {
      sensitiveRoles.add(key);
    }
  });

  return [
    ...resources.clusterrolebinding.data.flatMap(binding => {
      if (isDefaultKubernetesRBACBinding(binding)) {
        return [];
      }

      const roleName = json(binding)?.roleRef?.name || '';
      const isRisky =
        roleName === 'cluster-admin' ||
        wildcardClusterRoles.has(roleName) ||
        sensitiveClusterRoles.has(roleName);

      if (!isRisky) {
        return [];
      }

      return (json(binding)?.subjects || [])
        .filter((subject: any) => isReportableRBACSubject(subject, '', config))
        .map((subject: any) =>
          finding(
            binding,
            `${overexposureMessage(
              roleName,
              wildcardClusterRoles.has(roleName),
              sensitiveClusterRoles.has(roleName)
            )}: ${subject.kind}/${subject.name}`
          )
        );
    }),
    ...resources.rolebinding.data.flatMap(binding => {
      const bindingNamespace = namespace(binding) || 'default';
      const roleName = json(binding)?.roleRef?.name || '';
      const roleKey = `${bindingNamespace}/${roleName}`;
      const clusterRoleRisk =
        json(binding)?.roleRef?.kind === 'ClusterRole' &&
        (roleName === 'cluster-admin' ||
          wildcardClusterRoles.has(roleName) ||
          sensitiveClusterRoles.has(roleName));
      const roleRisk = wildcardRoles.has(roleKey) || sensitiveRoles.has(roleKey);

      if (!clusterRoleRisk && !roleRisk) {
        return [];
      }

      return (json(binding)?.subjects || [])
        .filter((subject: any) => isReportableRBACSubject(subject, bindingNamespace, config))
        .map((subject: any) =>
          finding(
            binding,
            `${overexposureMessage(
              roleName,
              wildcardClusterRoles.has(roleName) || wildcardRoles.has(roleKey),
              sensitiveClusterRoles.has(roleName) || sensitiveRoles.has(roleKey)
            )}: ${subject.kind}/${subject.name}`
          )
        );
    }),
  ];
}

function usedServiceAccountKeys(resources: ResourceStates): Set<string> {
  const used = new Set<string>();

  resources.pod.data.forEach(pod => {
    used.add(`${namespace(pod) || 'default'}/${serviceAccountName(pod)}`);
  });

  [...resources.rolebinding.data, ...resources.clusterrolebinding.data].forEach(binding => {
    (json(binding)?.subjects || []).forEach((subject: any) => {
      if (subject?.kind === 'ServiceAccount') {
        used.add(`${subject.namespace || namespace(binding) || 'default'}/${subject.name}`);
      }
    });
  });

  return used;
}

function orphanedRolesFindings(resources: ResourceStates): Finding[] {
  const usedRoles = new Set<string>();
  const findings: Finding[] = [];

  resources.rolebinding.data.forEach(binding => {
    const roleRef = json(binding)?.roleRef || {};
    if (roleRef.kind === 'Role') {
      usedRoles.add(`${namespace(binding) || 'default'}/${roleRef.name}`);
    } else if (roleRef.kind === 'ClusterRole') {
      usedRoles.add(roleRef.name);
    }

    if ((json(binding)?.subjects || []).length === 0) {
      findings.push(finding(binding, 'RoleBinding has no subjects'));
    }
  });

  resources.clusterrolebinding.data.forEach(binding => {
    const roleName = json(binding)?.roleRef?.name;
    if (roleName) {
      usedRoles.add(roleName);
    }

    if (!isDefaultKubernetesRBACBinding(binding) && (json(binding)?.subjects || []).length === 0) {
      findings.push(finding(binding, 'ClusterRoleBinding has no subjects'));
    }
  });

  resources.role.data.forEach(role => {
    const key = rbacResourceKey(role);
    if (!usedRoles.has(key)) {
      findings.push(
        finding(
          role,
          (json(role)?.rules || []).length === 0
            ? 'Role defines no rules'
            : 'Role is not referenced by bindings'
        )
      );
    }
  });

  resources.clusterrole.data.forEach(role => {
    const roleName = name(role);
    if (isBuiltInClusterRole(role)) {
      if ((json(role)?.rules || []).length === 0) {
        findings.push(finding(role, 'ClusterRole has no rules'));
      }
      return;
    }

    const aggregated = resources.clusterrole.data.some(aggregate =>
      (json(aggregate)?.aggregationRule?.clusterRoleSelectors || []).some((selector: unknown) =>
        labelSelectorMatches(selector, objectLabels(role))
      )
    );
    if (aggregated) {
      usedRoles.add(roleName);
    }

    if (!usedRoles.has(roleName)) {
      findings.push(
        finding(
          role,
          (json(role)?.rules || []).length === 0
            ? 'ClusterRole defines no rules'
            : 'Unused ClusterRole'
        )
      );
    }
  });

  return findings;
}

function boundRoleRefs(resources: ResourceStates, config: KubeBuddyConfig): Set<string> {
  const out = new Set<string>();

  resources.rolebinding.data.forEach(binding => {
    if (!bindingHasReportableRBACSubject(binding, namespace(binding) || 'default', config)) {
      return;
    }

    const roleRef = json(binding)?.roleRef || {};
    if (!roleRef.name) {
      return;
    }

    out.add(
      roleRef.kind === 'ClusterRole'
        ? `ClusterRole:${roleRef.name}`
        : `Role:${namespace(binding) || 'default'}/${roleRef.name}`
    );
  });

  resources.clusterrolebinding.data.forEach(binding => {
    if (
      isDefaultKubernetesRBACBinding(binding) ||
      !bindingHasReportableRBACSubject(binding, '', config)
    ) {
      return;
    }

    const roleName = json(binding)?.roleRef?.name;
    if (roleName) {
      out.add(`ClusterRole:${roleName}`);
    }
  });

  return out;
}

function grantsKubeletProxy(role: any): boolean {
  return (json(role)?.rules || []).some(
    (rule: any) => (rule?.resources || []).includes('nodes/proxy') && (rule?.verbs || []).length > 0
  );
}

function recommendedLabelFindings(resource: any): Finding[] {
  const labels = objectLabels(resource);
  const templateLabels = workloadTemplate(resource)?.metadata?.labels || {};
  const required = [
    'app.kubernetes.io/name',
    'app.kubernetes.io/instance',
    'app.kubernetes.io/version',
    'app.kubernetes.io/component',
    'app.kubernetes.io/part-of',
    'app.kubernetes.io/managed-by',
  ];
  const missing = required.filter(
    label => labels[label] === undefined && templateLabels[label] === undefined
  );
  return missing.length > 0 ? [finding(resource, `Missing labels: ${missing.join(', ')}`)] : [];
}

function dangerousRBACReasons(rule: any): string[] {
  const reasons = new Set<string>();
  const verbs = rule?.verbs || [];
  const resources = rule?.resources || [];
  ['impersonate', 'bind', 'escalate'].forEach(verb => {
    if (verbs.includes(verb)) reasons.add(verb);
  });
  ['pods/exec', 'pods/portforward'].forEach(resource => {
    if (resources.includes(resource)) reasons.add(resource);
  });
  if (
    resources.includes('secrets') &&
    ['*', 'get', 'list', 'watch'].some(verb => verbs.includes(verb))
  ) {
    reasons.add('secret read');
  }
  return [...reasons];
}

function dangerousRBACFindings(role: any): Finding[] {
  if (isBuiltInClusterRole(role)) {
    return [];
  }

  return (json(role)?.rules || []).flatMap((rule: any) => {
    const reasons = dangerousRBACReasons(rule);
    return reasons.length > 0
      ? [finding(role, `Dangerous RBAC access: ${reasons.join(', ')}`)]
      : [];
  });
}

function isControlledPod(pod: any): boolean {
  return (json(pod)?.metadata?.ownerReferences || []).length > 0;
}

function isStaticMirrorPod(pod: any): boolean {
  const annotations = objectAnnotations(pod);
  return (
    !!annotations['kubernetes.io/config.mirror'] || !!annotations['kubernetes.io/config.source']
  );
}

function cronJobHygieneIssues(cronJob: any): string[] {
  const spec = json(cronJob)?.spec || {};
  const issues: string[] = [];
  if (!spec.concurrencyPolicy) issues.push('missing concurrencyPolicy');
  if (spec.startingDeadlineSeconds === undefined || spec.startingDeadlineSeconds === null)
    issues.push('missing startingDeadlineSeconds');
  if (spec.successfulJobsHistoryLimit === 0) issues.push('successfulJobsHistoryLimit is zero');
  if (spec.failedJobsHistoryLimit === 0) issues.push('failedJobsHistoryLimit is zero');
  if (spec.suspend === true) issues.push('suspended');
  return issues;
}

function includesString(values: unknown, expected: string): boolean {
  return toArray(values).some(value => String(value) === expected);
}

function stringValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function selectorOverlaps(selector: unknown, labels: unknown): boolean {
  if (!selector || !labels || typeof selector !== 'object' || typeof labels !== 'object') {
    return false;
  }

  return Object.entries(selector as Record<string, unknown>).some(
    ([key, value]) => String((labels as Record<string, unknown>)[key]) === String(value)
  );
}

function weakPdbMessage(pdb: any): string {
  const spec = json(pdb)?.spec || {};
  const minAvailable = stringValue(spec.minAvailable);
  const maxUnavailable = stringValue(spec.maxUnavailable);

  if (minAvailable !== '' && Number(minAvailable) === 0) {
    return 'minAvailable = 0';
  }
  if (maxUnavailable === '1' || maxUnavailable === '100%') {
    return 'maxUnavailable = 100%';
  }
  return '';
}

function pdbCoverageFindings(resources: ResourceStates): Finding[] {
  const findings: Finding[] = [];
  const pdbNamespaces = new Set<string>();

  resources.poddisruptionbudget.data.forEach(pdb => {
    pdbNamespaces.add(namespace(pdb) || 'default');

    if (Number(json(pdb)?.status?.expectedPods || 0) === 0) {
      findings.push(finding(pdb, 'Matches 0 pods'));
    }

    const weak = weakPdbMessage(pdb);
    if (weak) {
      findings.push(finding(pdb, weak));
    }
  });

  [...resources.deployment.data, ...resources.statefulset.data].forEach(workload => {
    const workloadNamespace = namespace(workload) || 'default';
    if (!pdbNamespaces.has(workloadNamespace)) {
      return;
    }

    const labels = workloadLabels(workload);
    if (!labels || typeof labels !== 'object') {
      return;
    }

    const matched = resources.poddisruptionbudget.data.some(
      pdb =>
        (namespace(pdb) || 'default') === workloadNamespace &&
        selectorMatches(json(pdb)?.spec?.selector?.matchLabels, labels)
    );
    if (!matched) {
      findings.push(finding(workload, 'No matching PDB'));
    }
  });

  return findings;
}

function networkPolicyPermissiveFindings(resources: ResourceStates): Finding[] {
  return resources.networkpolicy.data.flatMap(policy => {
    const spec = json(policy)?.spec || {};
    const policyTypes = toArray(spec.policyTypes);
    const parts: string[] = [];

    if (includesString(policyTypes, 'Ingress') && toArray(spec.ingress).length === 0) {
      parts.push('Allows all Ingress traffic (empty ingress rules).');
    }
    if (includesString(policyTypes, 'Egress') && toArray(spec.egress).length === 0) {
      parts.push('Allows all Egress traffic (empty egress rules).');
    }
    toArray(spec.ingress).forEach((rule: any) => {
      toArray(rule?.from).forEach((from: any) => {
        if (from?.ipBlock?.cidr === '0.0.0.0/0') {
          parts.push("Ingress rule contains '0.0.0.0/0' ipBlock.");
        }
      });
    });
    toArray(spec.egress).forEach((rule: any) => {
      toArray(rule?.to).forEach((to: any) => {
        if (to?.ipBlock?.cidr === '0.0.0.0/0') {
          parts.push("Egress rule contains '0.0.0.0/0' ipBlock.");
        }
      });
    });

    return parts.length > 0 ? [finding(policy, parts.join(' '))] : [];
  });
}

function secretDecodedEntries(secret: any): { key: string; value: string }[] {
  return Object.entries(json(secret)?.data || {}).flatMap(([key, value]) => {
    try {
      return [{ key, value: atob(String(value || '')) }];
    } catch {
      return [{ key, value: String(value || '') }];
    }
  });
}

function sensitiveTextReason(value: string): string {
  const text = value.trim();
  if (!text) {
    return '';
  }
  const patterns: [RegExp, string][] = [
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key material'],
    [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
    [/gh[pousr]_[A-Za-z0-9_]{20,}/, 'GitHub token'],
    [/postgres(ql)?:\/\/|mysql:\/\/|mongodb(\+srv)?:\/\//i, 'database connection string'],
    [/AccountKey=[A-Za-z0-9+/=]{40,}/i, 'storage account key'],
    [/password\s*[:=]\s*[^;&\s]{8,}/i, 'password-like value'],
  ];

  return patterns.find(([pattern]) => pattern.test(text))?.[1] || '';
}

function isCertificatePrivateKeyName(key: string): boolean {
  return [
    'key',
    'tls.key',
    'ca.key',
    'cert.key',
    'server.key',
    'private.key',
    'key.pem',
    'tls.key.pem',
    'server-key.pem',
    'private-key.pem',
  ].includes(key.toLowerCase().trim());
}

function isCertificatePublicMaterialName(key: string): boolean {
  return [
    'ca',
    'cert',
    'tls.crt',
    'ca.crt',
    'cert.crt',
    'server.crt',
    'certificate.crt',
    'cert.pem',
    'server.pem',
    'tls.crt.pem',
    'ca.pem',
  ].includes(key.toLowerCase().trim());
}

function isExpectedSecretPrivateKey(secret: any, key: string, reason: string): boolean {
  if (reason !== 'private key material') {
    return false;
  }
  const secretType = String(json(secret)?.type || '').toLowerCase();
  if (secretType === 'kubernetes.io/tls' || secretType === 'kubernetes.io/ssh-auth') {
    return true;
  }
  const normalizedKey = key.toLowerCase().trim();
  if (normalizedKey === 'ssh-privatekey') {
    return true;
  }
  if (!isCertificatePrivateKeyName(normalizedKey)) {
    return false;
  }
  return Object.keys(json(secret)?.data || {}).some(isCertificatePublicMaterialName);
}

function secretMaterialFindings(resources: ResourceStates): Finding[] {
  return resources.secret.data.flatMap(secret => {
    const secretName = name(secret);
    if (
      namespace(secret) === 'kube-system' ||
      secretName.startsWith('bootstrap-token-') ||
      secretName.startsWith('default-token-') ||
      json(secret)?.type === 'helm.sh/release.v1'
    ) {
      return [];
    }

    const reasons = new Set(
      secretDecodedEntries(secret)
        .map(entry => ({ ...entry, reason: sensitiveTextReason(entry.value) }))
        .filter(
          entry => entry.reason && !isExpectedSecretPrivateKey(secret, entry.key, entry.reason)
        )
        .map(entry => entry.reason)
    );
    return reasons.size > 0 ? [finding(secret, [...reasons].join(', '))] : [];
  });
}

function parseAsn1Length(
  bytes: Uint8Array,
  offset: number
): { length: number; next: number } | null {
  if (offset >= bytes.length) {
    return null;
  }
  const first = bytes[offset];
  if (first < 0x80) {
    return { length: first, next: offset + 1 };
  }
  const count = first & 0x7f;
  if (count === 0 || count > 4 || offset + count >= bytes.length) {
    return null;
  }
  let length = 0;
  for (let i = 0; i < count; i += 1) {
    length = (length << 8) | bytes[offset + 1 + i];
  }
  return { length, next: offset + 1 + count };
}

function parseCertificateTime(value: string, generalized: boolean): Date | null {
  const match = generalized
    ? value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/)
    : value.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/);
  if (!match) {
    return null;
  }
  const year = generalized
    ? Number(match[1])
    : Number(match[1]) + (Number(match[1]) >= 50 ? 1900 : 2000);
  const offset = generalized ? 1 : 0;
  return new Date(
    Date.UTC(
      year,
      Number(match[1 + offset]) - 1,
      Number(match[2 + offset]),
      Number(match[3 + offset]),
      Number(match[4 + offset]),
      Number(match[5 + offset])
    )
  );
}

function certificateExpiryFromDer(bytes: Uint8Array): Date | null {
  const dates: Date[] = [];
  for (let i = 0; i < bytes.length - 2; i += 1) {
    if (bytes[i] !== 0x17 && bytes[i] !== 0x18) {
      continue;
    }
    const parsed = parseAsn1Length(bytes, i + 1);
    if (!parsed || parsed.next + parsed.length > bytes.length) {
      continue;
    }
    const raw = Array.from(bytes.slice(parsed.next, parsed.next + parsed.length))
      .map(value => String.fromCharCode(value))
      .join('');
    const date = parseCertificateTime(raw, bytes[i] === 0x18);
    if (date) {
      dates.push(date);
    }
  }

  return dates.sort((a, b) => b.getTime() - a.getTime())[0] || null;
}

function certificateBytesFromBase64(base64: string): Uint8Array | null {
  const cleaned = base64.replace(/\s/g, '');
  if (!cleaned) {
    return null;
  }
  try {
    return Uint8Array.from(atob(cleaned), char => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function tlsCertificateExpiries(pem: string): Date[] {
  const expiries: Date[] = [];
  const blocks = [
    ...pem.matchAll(/-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g),
  ];
  if (blocks.length > 0) {
    blocks.forEach(block => {
      const bytes = certificateBytesFromBase64(block[1]);
      const expiry = bytes ? certificateExpiryFromDer(bytes) : null;
      if (expiry) {
        expiries.push(expiry);
      }
    });
    return expiries;
  }

  const bytes = certificateBytesFromBase64(pem);
  const expiry = bytes ? certificateExpiryFromDer(bytes) : null;
  return expiry ? [expiry] : [];
}

function tlsSecretCertificateFindings(resources: ResourceStates): Finding[] {
  const soon = 30 * 24 * 60 * 60 * 1000;
  return resources.secret.data.flatMap(secret => {
    if (json(secret)?.type !== 'kubernetes.io/tls') {
      return [];
    }
    const encoded = json(secret)?.data?.['tls.crt'];
    if (!encoded) {
      return [finding(secret, 'TLS Secret is missing tls.crt')];
    }
    let pem = '';
    try {
      pem = atob(String(encoded));
    } catch {
      return [finding(secret, 'TLS certificate data is not valid base64')];
    }
    const expiries = tlsCertificateExpiries(pem);
    if (expiries.length === 0) {
      return [
        finding(
          secret,
          'TLS certificate data is present but no X.509 validity period could be parsed'
        ),
      ];
    }
    const expiry = expiries
      .filter(candidate => candidate.getTime() - Date.now() <= soon)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    if (expiry) {
      const state = expiry.getTime() < Date.now() ? 'expired' : 'expires';
      return [finding(secret, `TLS certificate ${state} ${expiry.toISOString().slice(0, 10)}`)];
    }
    return [];
  });
}
function configMapSensitiveDataFindings(resources: ResourceStates): Finding[] {
  return resources.configmap.data.flatMap(cm => {
    const reasons = new Set(
      Object.values(json(cm)?.data || {})
        .map(value => sensitiveTextReason(String(value || '')))
        .filter(Boolean)
    );
    return reasons.size > 0 ? [finding(cm, [...reasons].join(', '))] : [];
  });
}

function imageHasDigest(image: string): boolean {
  return image.includes('@sha256:');
}

function eolImageReason(image: string): string {
  const normalized = image.toLowerCase();
  const matches = [
    [/(:|\/)ubuntu:(14\.04|16\.04|18\.04)(-|$)/, 'EOL Ubuntu base image'],
    [/(:|\/)debian:(jessie|stretch|buster)(-|$)/, 'EOL Debian base image'],
    [/(:|\/)centos:(6|7|8)(-|$)/, 'EOL CentOS base image'],
    [/(:|\/)alpine:3\.(?:[0-9]|1[0-2])(?:-|$)/, 'EOL Alpine base image'],
    [/(:|\/)node:(10|12|14|16)(-|$)/, 'EOL Node.js base image'],
    [/(:|\/)python:(2\.7|3\.[0-7])(-|$)/, 'EOL Python base image'],
  ] as [RegExp, string][];

  return matches.find(([pattern]) => pattern.test(normalized))?.[1] || '';
}

function imageFindings(resources: ResourceStates, predicate: (image: string) => string): Finding[] {
  return [...allWorkloads(resources), ...resources.pod.data].flatMap(item =>
    podImages(item).flatMap(image => {
      const reason = predicate(String(image || ''));
      return reason ? [finding(item, `${reason}: ${image}`)] : [];
    })
  );
}

function dockerInDockerFindings(resources: ResourceStates): Finding[] {
  const hasDockerSocket = (item: any) => {
    const spec = workloadTemplate(item)?.spec || json(item)?.spec || {};
    return (spec?.volumes || []).some((volume: any) =>
      /docker\.sock$/.test(String(volume?.hostPath?.path || ''))
    );
  };

  return [...allWorkloads(resources), ...resources.pod.data].flatMap(item => {
    const badContainers = workloadAllContainers(item).filter(
      container =>
        /docker.*dind|dind/i.test(String(container?.image || '')) ||
        container?.securityContext?.privileged === true
    );
    return badContainers.length > 0 && hasDockerSocket(item)
      ? [
          finding(
            item,
            `Docker socket with privileged/DinD container: ${badContainers
              .map(container => container.name || container.image)
              .join(', ')}`
          ),
        ]
      : [];
  });
}

function isMetadataEndpointAddress(value: string): boolean {
  const address = value.trim().toLowerCase();
  return (
    address.startsWith('169.254.169.254') ||
    address.startsWith('100.100.100.200') ||
    address.startsWith('fd00:ec2::254')
  );
}

function metadataAddressBlocked(networkPolicy: any): boolean {
  const spec = json(networkPolicy)?.spec || {};
  const egress = spec.egress || [];
  if ((spec.policyTypes || []).includes('Egress') && egress.length === 0) {
    return true;
  }
  return egress.some((rule: any) =>
    (rule?.to || []).some((to: any) =>
      (to?.ipBlock?.except || []).some((exceptCidr: string) =>
        isMetadataEndpointAddress(String(exceptCidr || ''))
      )
    )
  );
}

function metadataApiEgressFindings(resources: ResourceStates): Finding[] {
  const namespaces = new Set(resources.pod.data.map(pod => namespace(pod) || 'default'));
  return [...namespaces].flatMap(namespaceName => {
    const policies = resources.networkpolicy.data.filter(
      policy => namespace(policy) === namespaceName
    );
    if (policies.length > 0 && policies.some(metadataAddressBlocked)) {
      return [];
    }
    return [
      {
        resource: `namespace/${namespaceName}`,
        namespace: namespaceName,
        kind: 'Namespace',
        details: 'No NetworkPolicy blocks egress to 169.254.169.254',
      },
    ];
  });
}

function metadataEndpointFindings(resources: ResourceStates): Finding[] {
  return resources.endpoints.data.flatMap(endpoint =>
    (json(endpoint)?.subsets || []).flatMap((subset: any) =>
      (subset?.addresses || [])
        .filter((address: any) => address?.ip === '169.254.169.254')
        .map(() => finding(endpoint, 'Endpoint points to cloud metadata IP 169.254.169.254'))
    )
  );
}

function deprecatedApiFindings(resources: ResourceStates): Finding[] {
  return Object.values(resources).flatMap(state =>
    state.data.flatMap(resource => {
      const apiVersion = String(json(resource)?.apiVersion || '');
      const reason = deprecatedApiReason(apiVersion);
      return reason ? [finding(resource, reason)] : [];
    })
  );
}

function metricsServerFindings(resources: ResourceStates): Finding[] {
  const apiService = resources.apiservice?.data.find(
    item => name(item) === 'v1beta1.metrics.k8s.io'
  );
  if (!apiService) {
    return [
      {
        resource: 'cluster/metrics-server',
        kind: 'Cluster',
        details: 'metrics-server was not detected',
      },
    ];
  }
  const available = (json(apiService)?.status?.conditions || []).some(
    (condition: any) => condition.type === 'Available' && String(condition.status) === 'True'
  );
  return available ? [] : [finding(apiService, 'metrics.k8s.io APIService is not Available')];
}

function nodeUntoleratedTaintFindings(resources: ResourceStates): Finding[] {
  const tolerations = resources.pod.data.flatMap(pod => json(pod)?.spec?.tolerations || []);
  return resources.node.data.flatMap(node =>
    (json(node)?.spec?.taints || [])
      .filter((taint: any) => taint?.key && !taintTolerated(taint, tolerations))
      .filter((taint: any) => !isSystemIsolationTaint(taint, objectLabels(node)))
      .map((taint: any) => {
        const value = taint.value ? `=${taint.value}` : '';
        const effect = taint.effect ? `:${taint.effect}` : '';
        return finding(
          node,
          `No current pod toleration matches taint ${taint.key}${value}${effect}`
        );
      })
  );
}

function hpaBurstCapacityFindings(resources: ResourceStates): Finding[] {
  const allocCpu = resources.node.data.reduce(
    (total, node) => total + cpuMillicoresValue(json(node)?.status?.allocatable?.cpu),
    0
  );
  const allocMem = resources.node.data.reduce(
    (total, node) => total + memoryMiValue(json(node)?.status?.allocatable?.memory),
    0
  );
  let totalCpu = 0;
  let totalMem = 0;
  const findings: Finding[] = [];

  for (const hpa of resources.horizontalpodautoscaler.data) {
    const target = json(hpa)?.spec?.scaleTargetRef || {};
    const workload = allWorkloads(resources).find(
      item =>
        namespace(item) === namespace(hpa) &&
        name(item) === target.name &&
        String(json(item)?.kind || '').toLowerCase() === String(target.kind || '').toLowerCase()
    );
    if (!workload) continue;
    const maxReplicas = Number(json(hpa)?.spec?.maxReplicas || 0);
    const requests = workloadContainers(workload).reduce(
      (totals, container) => ({
        cpu: totals.cpu + cpuMillicoresValue(container?.resources?.requests?.cpu),
        mem: totals.mem + memoryMiValue(container?.resources?.requests?.memory),
      }),
      { cpu: 0, mem: 0 }
    );
    const burstCpu = requests.cpu * maxReplicas;
    const burstMem = requests.mem * maxReplicas;
    totalCpu += burstCpu;
    totalMem += burstMem;
    const reasons = [];
    if (allocCpu > 0 && burstCpu >= allocCpu)
      reasons.push(
        `CPU burst ${Math.round(burstCpu)}m >= cluster allocatable ${Math.round(allocCpu)}m`
      );
    if (allocMem > 0 && burstMem >= allocMem)
      reasons.push(
        `memory burst ${Math.round(burstMem)}Mi >= cluster allocatable ${Math.round(allocMem)}Mi`
      );
    if (reasons.length) findings.push(finding(hpa, reasons.join('; ')));
  }

  const clusterReasons = [];
  if (allocCpu > 0 && totalCpu >= allocCpu)
    clusterReasons.push(
      `all HPA CPU burst ${Math.round(totalCpu)}m >= cluster allocatable ${Math.round(allocCpu)}m`
    );
  if (allocMem > 0 && totalMem >= allocMem)
    clusterReasons.push(
      `all HPA memory burst ${Math.round(totalMem)}Mi >= cluster allocatable ${Math.round(
        allocMem
      )}Mi`
    );
  if (clusterReasons.length)
    findings.push({
      resource: 'cluster/hpa-burst',
      kind: 'Cluster',
      details: clusterReasons.join('; '),
    });
  return findings;
}

function multiplePdbFindings(resources: ResourceStates): Finding[] {
  return allWorkloads(resources).flatMap(workload => {
    const matches = resources.poddisruptionbudget.data.filter(
      pdb =>
        namespace(pdb) === namespace(workload) &&
        labelSelectorMatches(json(pdb)?.spec?.selector, workloadLabels(workload))
    );
    return matches.length > 1
      ? [
          finding(
            workload,
            `Multiple PodDisruptionBudgets match this workload: ${matches
              .map(name)
              .sort()
              .join(', ')}`
          ),
        ]
      : [];
  });
}

function impossiblePdbFindings(resources: ResourceStates): Finding[] {
  return resources.poddisruptionbudget.data.flatMap(pdb => {
    const status = json(pdb)?.status || {};
    const expected = Number(status.expectedPods || 0);
    const desired = Number(status.desiredHealthy || 0);
    const current = Number(status.currentHealthy || 0);
    const allowed = Number(status.disruptionsAllowed || 0);
    if (expected <= 0) return [];
    const reasons = [];
    if (desired > expected) reasons.push(`desiredHealthy ${desired} > expectedPods ${expected}`);
    if (current < desired) reasons.push(`currentHealthy ${current} < desiredHealthy ${desired}`);
    if (allowed === 0 && desired >= expected)
      reasons.push('disruptionsAllowed is 0 because desiredHealthy blocks voluntary disruption');
    return reasons.length ? [finding(pdb, reasons.join('; '))] : [];
  });
}

function networkPolicySelectorNoMatchFindings(resources: ResourceStates): Finding[] {
  return resources.networkpolicy.data.flatMap(policy => {
    const findings: Finding[] = [];
    const policyNamespace = namespace(policy);
    const localPods = resources.pod.data.filter(pod => namespace(pod) === policyNamespace);
    if (
      !localPods.some(pod =>
        labelSelectorMatches(json(policy)?.spec?.podSelector, objectLabels(pod))
      )
    ) {
      findings.push(finding(policy, 'NetworkPolicy podSelector matches no pods in its namespace'));
    }

    for (const direction of ['ingress', 'egress'] as const) {
      const peersKey = direction === 'ingress' ? 'from' : 'to';
      for (const rule of json(policy)?.spec?.[direction] || []) {
        for (const peer of rule?.[peersKey] || []) {
          if (peer.ipBlock) continue;
          let selectedNamespaces = [policyNamespace];
          if (peer.namespaceSelector) {
            selectedNamespaces = resources.namespace.data
              .filter(ns => labelSelectorMatches(peer.namespaceSelector, objectLabels(ns)))
              .map(name);
            if (selectedNamespaces.length === 0) {
              findings.push(
                finding(
                  policy,
                  `NetworkPolicy ${direction} namespaceSelector matches no namespaces`
                )
              );
              continue;
            }
          }
          if (peer.podSelector) {
            const scopedPods = resources.pod.data.filter(pod =>
              selectedNamespaces.includes(namespace(pod))
            );
            if (
              !scopedPods.some(pod => labelSelectorMatches(peer.podSelector, objectLabels(pod)))
            ) {
              findings.push(
                finding(policy, `NetworkPolicy ${direction} podSelector matches no pods`)
              );
            }
          }
        }
      }
    }
    return findings;
  });
}

function coreDnsPoisoningFindings(resources: ResourceStates): Finding[] {
  return resources.configmap.data.flatMap(configMap => {
    const cmName = name(configMap);
    const cmNamespace = namespace(configMap);
    if (
      cmName !== 'coredns' &&
      !(cmNamespace === 'kube-system' && cmName.toLowerCase().includes('coredns'))
    ) {
      return [];
    }
    const corefile = String(json(configMap)?.data?.Corefile || '');
    if (!corefile.trim()) {
      return [];
    }
    return corefile.split('\n').flatMap(line => {
      const trimmed = line.trim();
      const lower = trimmed.toLowerCase();
      if (!trimmed || trimmed.startsWith('#')) {
        return [];
      }
      let reason = '';
      if (lower.startsWith('rewrite ')) reason = 'CoreDNS rewrite rule can redirect service names';
      if (lower.startsWith('hosts ')) reason = 'CoreDNS hosts block can override DNS answers';
      if (lower.startsWith('proxy ')) reason = 'CoreDNS proxy plugin can redirect DNS lookups';
      if (lower.startsWith('forward . ') && !lower.includes('/etc/resolv.conf'))
        reason = 'CoreDNS forwards all unresolved names to a custom upstream';
      return reason ? [finding(configMap, `${reason}: ${trimmed}`)] : [];
    });
  });
}

function eventTamperingRbacFindings(resources: ResourceStates): Finding[] {
  return [...resources.role.data, ...resources.clusterrole.data].flatMap(role =>
    (json(role)?.rules || []).flatMap((rule: any) => {
      const matchesResource = listIncludesAny(rule?.resources, ['events', '*']);
      const matchesApiGroup = listIncludesAny(rule?.apiGroups, ['', 'events.k8s.io', '*']);
      const matchesVerb = listIncludesAny(rule?.verbs, ['delete', 'deletecollection', '*']);
      return matchesResource && matchesApiGroup && matchesVerb
        ? [
            finding(
              role,
              `Role grants event deletion permissions: ${(rule?.verbs || []).join(', ')}`
            ),
          ]
        : [];
    })
  );
}

function sensitiveAdminInterfaceFindings(resources: ResourceStates): Finding[] {
  const findings: Finding[] = [];
  const serviceIndex = new Map<string, any>();
  resources.service.data.forEach(service => {
    serviceIndex.set(`${namespace(service)}/${name(service)}`, service);
    if (servicePubliclyExposedTs(service) && sensitiveAdminNameTs(name(service))) {
      findings.push(
        finding(
          service,
          `Sensitive service appears publicly exposed: ${
            json(service)?.spec?.type || 'externalIPs'
          }`
        )
      );
    }
  });

  [
    { key: 'ingress', items: resources.ingress.data },
    { key: 'gateway', items: resources.gateway.data },
    { key: 'httproute', items: resources.httproute.data },
  ].forEach(group => {
    group.items.forEach(resource => {
      sensitiveRoutingReasonsTs(resource, group.key, serviceIndex).forEach(reason => {
        findings.push(finding(resource, `Sensitive admin interface appears exposed: ${reason}`));
      });
    });
  });
  return findings;
}

function sshServerContainerFindings(resources: ResourceStates): Finding[] {
  return resources.pod.data.flatMap(pod =>
    containers(pod).flatMap(container => {
      const commandLine = [...(container.command || []), ...(container.args || [])]
        .join(' ')
        .toLowerCase();
      const hasCommand =
        commandLine.includes('sshd') ||
        commandLine.includes('openssh-server') ||
        commandLine.includes('/usr/sbin/sshd');
      const hasPort = (container.ports || []).some(
        (port: any) =>
          String(port.containerPort) === '22' ||
          String(port.name || '')
            .toLowerCase()
            .includes('ssh')
      );
      return hasCommand || hasPort
        ? [
            finding(
              pod,
              `Container appears to run or expose SSH: ${
                container.name || container.image || 'container'
              }`
            ),
          ]
        : [];
    })
  );
}

function writableHostPathFindings(resources: ResourceStates): Finding[] {
  return resources.pod.data.flatMap(pod => {
    const hostPathVolumes = new Map<string, string>(
      (json(pod)?.spec?.volumes || [])
        .filter(
          (volume: any) =>
            volume.hostPath?.path && isSensitiveHostPath(String(volume.hostPath.path))
        )
        .map((volume: any) => [String(volume.name || ''), String(volume.hostPath.path)])
    );
    if (hostPathVolumes.size === 0) {
      return [];
    }
    return containers(pod).flatMap(container =>
      (container.volumeMounts || []).flatMap((mount: any) => {
        const hostPath = hostPathVolumes.get(String(mount.name || ''));
        if (!hostPath || mount.readOnly === true) {
          return [];
        }
        return [
          finding(
            pod,
            `Container ${
              container.name || 'container'
            } mounts sensitive hostPath volume read-write: ${mount.name} (${hostPath})`
          ),
        ];
      })
    );
  });
}

function serviceAccountTokenProjectionFindings(resources: ResourceStates): Finding[] {
  return resources.pod.data.flatMap(pod =>
    (json(pod)?.spec?.volumes || []).flatMap((volume: any) => {
      if (String(volume?.name || '').startsWith('kube-api-access-')) {
        return [];
      }
      const sources = volume?.projected?.sources || [];
      return sources.flatMap((source: any) => {
        const token = source?.serviceAccountToken;
        if (!token) {
          return [];
        }
        const reasons: string[] = [];
        const audience = String(token.audience || '').trim();
        const expiration = Number(token.expirationSeconds || 0);
        if (!audience) reasons.push('missing audience');
        if (['api', 'kubernetes', 'https://kubernetes.default.svc'].includes(audience))
          reasons.push('broad Kubernetes API audience');
        if (!expiration) reasons.push('missing expirationSeconds');
        if (expiration > 3600) reasons.push(`long expirationSeconds=${expiration}`);
        return reasons.length
          ? [
              finding(
                pod,
                `Projected ServiceAccount token has weak scoping on volume ${
                  volume.name
                }: ${reasons.join(', ')}`
              ),
            ]
          : [];
      });
    })
  );
}

function duplicateEnvVarFindings(resources: ResourceStates): Finding[] {
  return resources.pod.data.flatMap(pod =>
    containers(pod).flatMap(container => {
      const seen = new Set<string>();
      const duplicates = new Set<string>();
      (container.env || []).forEach((env: any) => {
        const envName = String(env.name || '');
        if (!envName) return;
        if (seen.has(envName)) duplicates.add(envName);
        seen.add(envName);
      });
      return duplicates.size
        ? [
            finding(
              pod,
              `Container ${
                container.name || 'container'
              } has duplicate environment variable keys: ${Array.from(duplicates)
                .sort()
                .join(', ')}`
            ),
          ]
        : [];
    })
  );
}

function deprecatedServiceAccountFieldFindings(resources: ResourceStates): Finding[] {
  const groups = [
    { items: resources.pod.data, path: (item: any) => json(item)?.spec?.serviceAccount },
    {
      items: resources.deployment.data,
      path: (item: any) => json(item)?.spec?.template?.spec?.serviceAccount,
    },
    {
      items: resources.statefulset.data,
      path: (item: any) => json(item)?.spec?.template?.spec?.serviceAccount,
    },
    {
      items: resources.daemonset.data,
      path: (item: any) => json(item)?.spec?.template?.spec?.serviceAccount,
    },
    {
      items: resources.job.data,
      path: (item: any) => json(item)?.spec?.template?.spec?.serviceAccount,
    },
    {
      items: resources.cronjob.data,
      path: (item: any) => json(item)?.spec?.jobTemplate?.spec?.template?.spec?.serviceAccount,
    },
  ];
  return groups.flatMap(group =>
    group.items.flatMap(item => {
      const value = group.path(item);
      const spec = workloadTemplate(item)?.spec || json(item)?.spec || {};
      return value && value !== spec.serviceAccountName
        ? [
            finding(
              item,
              `Deprecated serviceAccount field is set; use serviceAccountName: ${value}`
            ),
          ]
        : [];
    })
  );
}

function identicalProbeFindings(resources: ResourceStates): Finding[] {
  return resources.pod.data.flatMap(pod =>
    containers(pod).flatMap(container => {
      const readiness = container.readinessProbe;
      const liveness = container.livenessProbe;
      if (!readiness || !liveness) {
        return [];
      }
      return JSON.stringify(readiness) === JSON.stringify(liveness)
        ? [
            finding(
              pod,
              `Container readinessProbe and livenessProbe are identical: ${
                container.name || 'container'
              }`
            ),
          ]
        : [];
    })
  );
}

function ephemeralStorageFindings(resources: ResourceStates): Finding[] {
  return resources.pod.data.flatMap(pod =>
    containers(pod).flatMap(container => {
      const missing = [];
      if (!container.resources?.requests?.['ephemeral-storage'])
        missing.push('requests.ephemeral-storage');
      if (!container.resources?.limits?.['ephemeral-storage'])
        missing.push('limits.ephemeral-storage');
      return missing.length
        ? [finding(pod, `Container ${container.name || 'container'} missing ${missing.join(', ')}`)]
        : [];
    })
  );
}

function statefulSetHeadlessServiceFindings(resources: ResourceStates): Finding[] {
  return resources.statefulset.data.flatMap(statefulSet => {
    const serviceName = json(statefulSet)?.spec?.serviceName;
    if (!serviceName) {
      return [finding(statefulSet, 'StatefulSet spec.serviceName is missing')];
    }
    const service = resources.service.data.find(
      item => namespace(item) === namespace(statefulSet) && name(item) === serviceName
    );
    if (!service) {
      return [
        finding(statefulSet, `StatefulSet serviceName does not match a Service: ${serviceName}`),
      ];
    }
    return json(service)?.spec?.clusterIP === 'None'
      ? []
      : [
          finding(
            statefulSet,
            `StatefulSet serviceName should reference a headless Service with clusterIP None: ${serviceName}`
          ),
        ];
  });
}

function hpaTargetMissingFindings(resources: ResourceStates): Finding[] {
  return resources.horizontalpodautoscaler.data.flatMap(hpa => {
    const target = json(hpa)?.spec?.scaleTargetRef || {};
    if (!target.kind || !target.name) {
      return [finding(hpa, 'HPA scaleTargetRef is incomplete')];
    }
    const targetKey = hpaTargetResourceKey(String(target.kind));
    if (!targetKey) {
      return [];
    }
    return resourceKindNameExists(resources, targetKey, namespace(hpa), String(target.name))
      ? []
      : [finding(hpa, `HPA target workload was not found: ${target.kind}/${target.name}`)];
  });
}

function pdbUnhealthyPodEvictionPolicyFindings(resources: ResourceStates): Finding[] {
  return resources.poddisruptionbudget.data.flatMap(pdb => {
    const policy = json(pdb)?.spec?.unhealthyPodEvictionPolicy;
    if (!policy) {
      return [finding(pdb, 'PDB unhealthyPodEvictionPolicy is not explicitly set')];
    }
    return policy === 'IfHealthyBudget' && Number(json(pdb)?.status?.disruptionsAllowed || 0) === 0
      ? [finding(pdb, 'PDB uses IfHealthyBudget while disruptionsAllowed is 0')]
      : [];
  });
}

function hpaTargetResourceKey(kind: string): string {
  const aliases: Record<string, string> = {
    deployment: 'deployment',
    statefulset: 'statefulset',
  };
  return aliases[kind.toLowerCase()] || '';
}

function resourceKindNameExists(
  resources: ResourceStates,
  resourceKey: string,
  resourceNamespace: string | undefined,
  resourceName: string
): boolean {
  const state = resources[resourceKey];
  return Boolean(
    state?.data?.some(item => name(item) === resourceName && namespace(item) === resourceNamespace)
  );
}

function listIncludesAny(values: unknown, expected: string[]): boolean {
  return Array.isArray(values) && values.some(value => expected.includes(String(value)));
}

function servicePubliclyExposedTs(service: any): boolean {
  const spec = json(service)?.spec || {};
  return (
    spec.type === 'LoadBalancer' ||
    spec.type === 'NodePort' ||
    (Array.isArray(spec.externalIPs) && spec.externalIPs.length > 0)
  );
}

function sensitiveAdminNameTs(value: string): boolean {
  const lower = value.toLowerCase();
  return [
    'kubernetes-dashboard',
    'dashboard',
    'argo-server',
    'argocd-server',
    'prometheus',
    'grafana',
    'jenkins',
    'kubeflow',
    'nifi',
    'weave-scope',
  ].some(keyword => lower.includes(keyword));
}

function sensitiveRoutingReasonsTs(
  resource: any,
  kind: string,
  serviceIndex: Map<string, any>
): string[] {
  const reasons = new Set<string>();
  if (sensitiveAdminNameTs(name(resource))) {
    reasons.add('resource name matches sensitive admin interface');
  }
  routingHostsTs(resource, kind).forEach(host => {
    if (sensitiveAdminNameTs(host)) {
      reasons.add(`host matches sensitive admin interface: ${host}`);
    }
  });
  routingBackendServicesTs(resource, kind).forEach(serviceName => {
    const backend = serviceIndex.get(`${namespace(resource)}/${serviceName}`);
    if (sensitiveAdminNameTs(serviceName) || (backend && sensitiveAdminNameTs(name(backend)))) {
      reasons.add(`backend service matches sensitive admin interface: ${serviceName}`);
    }
  });
  return Array.from(reasons).sort();
}

function routingHostsTs(resource: any, kind: string): string[] {
  const spec = json(resource)?.spec || {};
  if (kind === 'ingress') {
    return (spec.rules || []).map((rule: any) => rule.host).filter(Boolean);
  }
  if (kind === 'httproute') {
    return (spec.hostnames || []).filter(Boolean);
  }
  if (kind === 'gateway') {
    return (spec.listeners || []).map((listener: any) => listener.hostname).filter(Boolean);
  }
  return [];
}

function routingBackendServicesTs(resource: any, kind: string): string[] {
  const services = new Set<string>();
  const spec = json(resource)?.spec || {};
  const add = (serviceName?: string) => {
    if (serviceName) services.add(serviceName);
  };
  if (kind === 'ingress') {
    add(spec.defaultBackend?.service?.name);
    (spec.rules || []).forEach((rule: any) =>
      (rule.http?.paths || []).forEach((path: any) => add(path.backend?.service?.name))
    );
  }
  if (kind === 'httproute') {
    (spec.rules || []).forEach((rule: any) =>
      (rule.backendRefs || []).forEach((ref: any) => {
        if (!ref.kind || ref.kind === 'Service') add(ref.name);
      })
    );
  }
  return Array.from(services).sort();
}

function broadSubjectBindingFindings(
  resources: ResourceStates,
  config: KubeBuddyConfig
): Finding[] {
  return [...resources.rolebinding.data, ...resources.clusterrolebinding.data].flatMap(binding => {
    if (isDefaultKubernetesRBACBinding(binding)) {
      return [];
    }
    const bindingNamespace = namespace(binding) || 'default';
    return (json(binding)?.subjects || [])
      .filter((subject: any) => isReportableRBACSubject(subject, bindingNamespace, config))
      .filter(
        (subject: any) =>
          (subject?.kind === 'Group' &&
            ['system:authenticated', 'system:unauthenticated'].includes(subject?.name)) ||
          (subject?.kind === 'User' && subject?.name === 'system:anonymous')
      )
      .map((subject: any) => finding(binding, `Broad subject ${subject.kind}/${subject.name}`));
  });
}

function crossNamespaceServiceAccountBindingFindings(
  resources: ResourceStates,
  config: KubeBuddyConfig
): Finding[] {
  return resources.rolebinding.data.flatMap(binding => {
    const bindingNamespace = namespace(binding) || 'default';
    return (json(binding)?.subjects || [])
      .filter((subject: any) => subject?.kind === 'ServiceAccount')
      .filter(
        (subject: any) => !isExcludedRBACNamespace(subject?.namespace || bindingNamespace, config)
      )
      .filter((subject: any) => (subject?.namespace || bindingNamespace) !== bindingNamespace)
      .map((subject: any) =>
        finding(
          binding,
          `ServiceAccount ${subject.namespace}/${subject.name} bound from namespace ${bindingNamespace}`
        )
      );
  });
}

function referencedRole(resources: ResourceStates, binding: any): any | undefined {
  const roleRef = json(binding)?.roleRef;
  const roleName = roleRef?.name || '';
  if (roleRef?.kind === 'ClusterRole') {
    return resources.clusterrole.data.find(role => name(role) === roleName);
  }
  return resources.role.data.find(
    role => namespace(role) === (namespace(binding) || 'default') && name(role) === roleName
  );
}

function roleHasDangerousPermission(role: any | undefined): boolean {
  return (
    Boolean(role) &&
    (name(role) === 'cluster-admin' || roleIsWildcard(role) || roleIsSensitive(role))
  );
}

function defaultServiceAccountDangerousFindings(
  resources: ResourceStates,
  config: KubeBuddyConfig
): Finding[] {
  return [...resources.rolebinding.data, ...resources.clusterrolebinding.data].flatMap(binding => {
    const bindingNamespace = namespace(binding) || 'default';
    if (!roleHasDangerousPermission(referencedRole(resources, binding))) {
      return [];
    }
    return (json(binding)?.subjects || [])
      .filter((subject: any) => subject?.kind === 'ServiceAccount' && subject?.name === 'default')
      .filter(
        (subject: any) => !isExcludedRBACNamespace(subject?.namespace || bindingNamespace, config)
      )
      .map((subject: any) =>
        finding(
          binding,
          `Default ServiceAccount has dangerous permissions: ${
            subject.namespace || bindingNamespace
          }/default`
        )
      );
  });
}

function sensitiveServiceAccountWorkloadFindings(
  resources: ResourceStates,
  config: KubeBuddyConfig
): Finding[] {
  const risky = new Set<string>();
  [...resources.rolebinding.data, ...resources.clusterrolebinding.data].forEach(binding => {
    const bindingNamespace = namespace(binding) || 'default';
    if (!roleHasDangerousPermission(referencedRole(resources, binding))) {
      return;
    }
    (json(binding)?.subjects || []).forEach((subject: any) => {
      if (
        subject?.kind === 'ServiceAccount' &&
        !isExcludedRBACNamespace(subject?.namespace || bindingNamespace, config)
      ) {
        risky.add(`${subject.namespace || bindingNamespace}/${subject.name}`);
      }
    });
  });

  return [...allWorkloads(resources), ...resources.pod.data]
    .filter(item => risky.has(`${namespace(item) || 'default'}/${serviceAccountName(item)}`))
    .map(item =>
      finding(item, `Uses ServiceAccount with dangerous RBAC: ${serviceAccountName(item)}`)
    );
}

function workloadReplicaFindings(resources: ResourceStates): Finding[] {
  return [...resources.deployment.data, ...resources.statefulset.data]
    .filter(workload => Number(json(workload)?.spec?.replicas ?? 1) <= 1)
    .map(workload => finding(workload, 'Workload has one replica'));
}

function workloadDnsOverrideFindings(resources: ResourceStates): Finding[] {
  return [...allWorkloads(resources), ...resources.pod.data]
    .filter(item => {
      const spec = workloadTemplate(item)?.spec || json(item)?.spec || {};
      return Boolean(
        spec.hostAliases?.length ||
          spec.dnsConfig ||
          (spec.dnsPolicy && spec.dnsPolicy !== 'ClusterFirst')
      );
    })
    .map(item => finding(item, 'DNS policy/config or hostAliases overridden'));
}

function missingPriorityClassFindings(resources: ResourceStates): Finding[] {
  return allWorkloads(resources)
    .filter(workload => !stringValue(workloadTemplate(workload)?.spec?.priorityClassName))
    .map(workload => finding(workload, 'priorityClassName is not set'));
}

function bidirectionalMountPropagationFindings(resources: ResourceStates): Finding[] {
  return resources.pod.data.flatMap(pod =>
    containers(pod).flatMap(container =>
      (container?.volumeMounts || [])
        .filter((mount: any) => mount?.mountPropagation === 'Bidirectional')
        .map((mount: any) =>
          finding(
            pod,
            `Container ${container.name} uses Bidirectional mountPropagation on ${
              mount.mountPath || mount.name
            }`
          )
        )
    )
  );
}
function allocatedDeviceHealthFindings(resources: ResourceStates): Finding[] {
  return resources.pod.data.flatMap(pod => {
    const signals: string[] = [];

    ['containerStatuses', 'initContainerStatuses'].forEach(statusList => {
      toArray(json(pod)?.status?.[statusList]).forEach((containerStatus: any) => {
        const containerName = stringValue(containerStatus?.name);
        toArray(containerStatus?.allocatedResourcesStatus).forEach((resourceStatus: any) => {
          toArray(resourceStatus?.resources).forEach((health: any) => {
            const state = stringValue(health?.health);
            if (state !== 'Unhealthy' && state !== 'Unknown') {
              return;
            }
            const resourceName = stringValue(
              resourceStatus?.name || health?.resourceName || health?.resourceID
            );
            signals.push(`${containerName} ${resourceName} ${state}`.trim());
          });
        });
      });
    });

    return signals.length > 0
      ? [
          finding(
            pod,
            [...new Set(signals)].sort().join('; '),
            'Pod has allocated device resources reporting Unhealthy or Unknown.'
          ),
        ]
      : [];
  });
}

function webhookHasBroadScope(webhook: any): boolean {
  const hasNamespaceSelector =
    webhook?.namespaceSelector !== undefined && webhook?.namespaceSelector !== null;
  return toArray(webhook?.rules).some(
    (rule: any) =>
      includesString(rule?.resources, '*') &&
      includesString(rule?.operations, '*') &&
      !hasNamespaceSelector
  );
}

function admissionWebhookFindings(resources: ResourceStates): Finding[] {
  return [
    ...resources.mutatingwebhookconfiguration.data,
    ...resources.validatingwebhookconfiguration.data,
  ].flatMap(config => {
    const configName = name(config);

    return toArray(json(config)?.webhooks).flatMap((webhook: any) => {
      const issues: string[] = [];
      if (String(webhook?.failurePolicy || '').toLowerCase() === 'ignore') {
        issues.push('failurePolicy=Ignore');
      }
      if (!['None', 'NoneOnDryRun'].includes(stringValue(webhook?.sideEffects))) {
        issues.push('sideEffects not None/NoneOnDryRun');
      }
      if (webhookHasBroadScope(webhook)) {
        issues.push('broad wildcard scope');
      }

      return issues.length > 0
        ? [
            {
              resource: `admissionwebhook/${configName}`,
              namespace: '(cluster)',
              kind: kind(config),
              apiVersion: apiVersion(config),
              uid: uid(config),
              commandName: configName,
              details: issues.join(', '),
              message: `Webhook ${
                stringValue(webhook?.name) || 'unknown'
              } may fail open or apply too broadly`,
              link: link(config),
            },
          ]
        : [];
    });
  });
}

function deploymentLabelConsistencyFindings(resources: ResourceStates): Finding[] {
  return resources.deployment.data.flatMap(deployment => {
    const selector = workloadSelector(deployment);
    const templateLabels = workloadLabels(deployment);
    const findings: Finding[] = [];

    if (!selectorMatches(selector, templateLabels)) {
      findings.push(finding(deployment, 'Deployment selector does not match pod template labels'));
    }

    resources.service.data.forEach(service => {
      const selector = serviceSelector(service);
      if (namespace(service) !== namespace(deployment) || !selector) {
        return;
      }
      if (selectorMatches(selector, templateLabels)) {
        return;
      }
      const hasTarget =
        resources.deployment.data.some(
          other =>
            namespace(other) === namespace(service) &&
            selectorMatches(selector, workloadLabels(other))
        ) ||
        resources.pod.data.some(
          pod =>
            namespace(pod) === namespace(service) && selectorMatches(selector, objectLabels(pod))
        );
      if (hasTarget) {
        return;
      }
      if (selectorOverlaps(selector, templateLabels)) {
        findings.push(
          finding(
            deployment,
            `Service selector does not align with deployment pod labels: service/${name(service)}`
          )
        );
      }
    });

    return findings;
  });
}

function warningEventFindings(resources: ResourceStates): Finding[] {
  const grouped = new Map<string, { event: any; count: number }>();

  resources.events.data
    .filter(event => json(event)?.type === 'Warning')
    .forEach(event => {
      const eventData = json(event);
      const reason = stringValue(eventData?.reason);
      const message = stringValue(eventData?.message || eventData?.note);
      const key = `${reason}|${message}`;
      const existing = grouped.get(key);
      grouped.set(key, { event, count: (existing?.count || 0) + 1 });
    });

  return [...grouped.values()].map(({ event, count }) => {
    const eventData = json(event);
    const reason = stringValue(eventData?.reason) || 'Warning event';
    const message = stringValue(eventData?.message || eventData?.note) || reason;
    return finding(event, count > 1 ? `${count} events: ${reason} - ${message}` : message);
  });
}

const nativeHandlers: Record<string, NativeHandler> = {
  ...Object.fromEntries(
    Object.keys(podSecurityHandlers({ pod: EMPTY_RESOURCE_STATE })).map(key => [
      key,
      (resources: ResourceStates) => podSecurityHandlers(resources)[key],
    ])
  ),
  CFG001: resources => {
    const used = usedConfigMapKeys(resources);
    return resources.configmap.data
      .filter(
        cm =>
          !['kube-root-ca.crt', 'istio-ca-root'].includes(name(cm)) &&
          !name(cm).startsWith('sh.helm.release.v1.')
      )
      .filter(cm => !used.has(`${namespace(cm)}/${name(cm)}`))
      .map(cm => finding(cm, 'ConfigMap appears unused'));
  },
  CFG002: resources => {
    const byName = new Map<string, string[]>();
    resources.configmap.data.forEach(cm => {
      if (['kube-root-ca.crt', 'istio-ca-root'].includes(name(cm))) return;
      byName.set(name(cm), [...(byName.get(name(cm)) || []), namespace(cm) || 'default']);
    });
    return [...byName.entries()]
      .filter(([, namespaces]) => namespaces.length > 1)
      .flatMap(([cmName, namespaces]) =>
        namespaces.map(configMapNamespace => ({
          namespace: configMapNamespace,
          resource: `configmap/${cmName}`,
          details: `Found in namespaces: ${namespaces.join(', ')}`,
        }))
      );
  },
  CFG003: resources =>
    resources.configmap.data
      .filter(cm => JSON.stringify(json(cm)?.data || {}).length > 1048576)
      .map(cm => finding(cm, 'ConfigMap exceeds 1 MiB')),
  CFG004: deprecatedApiFindings,
  CFG005: metricsServerFindings,
  CFG006: coreDnsPoisoningFindings,
  CFG007: duplicateEnvVarFindings,
  CFG008: deprecatedServiceAccountFieldFindings,
  EVENT001: warningEventFindings,
  EVENT002: resources =>
    resources.events.data
      .filter(event => json(event)?.type === 'Warning')
      .map(event => finding(event, json(event)?.reason || json(event)?.note || 'Warning event')),
  SEC014: (resources, config) =>
    resources.pod.data.flatMap(pod =>
      containers(pod, false)
        .filter(
          container =>
            !config.trustedRegistries.some(registry =>
              String(container.image || '').startsWith(registry)
            )
        )
        .map(container => finding(pod, `Image from untrusted registry: ${container.image}`))
    ),
  JOB001: (resources, config) =>
    resources.job.data
      .filter(
        job =>
          daysSince(json(job)?.status?.startTime) !== null &&
          Date.now() - new Date(json(job)?.status?.startTime).getTime() >
            config.thresholds.stuckJobHours * 60 * 60 * 1000 &&
          !json(job)?.status?.succeeded
      )
      .map(job => finding(job, `Job running longer than ${config.thresholds.stuckJobHours} hours`)),
  JOB002: resources =>
    resources.job.data
      .filter(job => (json(job)?.status?.failed || 0) > 0 && !json(job)?.status?.succeeded)
      .map(job => finding(job, `${json(job)?.status?.failed} failures`)),
  JOB003: resources =>
    resources.cronjob.data.flatMap(cronJob => {
      const issues = cronJobHygieneIssues(cronJob);
      return issues.length > 0 ? [finding(cronJob, issues.join(', '))] : [];
    }),
  NET001: resources =>
    resources.service.data
      .filter(
        service =>
          json(service)?.spec?.type !== 'ExternalName' &&
          !resources.endpoints.data.some(
            ep =>
              namespace(ep) === namespace(service) &&
              name(ep) === name(service) &&
              (json(ep)?.subsets || []).length > 0
          ) &&
          !resources.endpointslice.data.some(
            ep =>
              namespace(ep) === namespace(service) &&
              json(ep)?.metadata?.labels?.['kubernetes.io/service-name'] === name(service) &&
              endpointSliceHasReadyEndpoint(ep)
          )
      )
      .map(service => finding(service, 'No endpoints or endpoint slices')),
  NET002: resources =>
    resources.service.data.flatMap(service => {
      const serviceType = json(service)?.spec?.type;
      if (serviceType !== 'LoadBalancer' && serviceType !== 'NodePort') {
        return [];
      }

      const external = (json(service)?.status?.loadBalancer?.ingress || [])
        .map((entry: any) => String(entry?.ip || entry?.hostname || '').trim())
        .filter((value: string) => value && !isInternalIP(value));
      if (serviceType !== 'NodePort' && external.length === 0) {
        return [];
      }

      return [
        finding(
          service,
          external.length > 0
            ? `Exposed via external IP: ${external.join(', ')}`
            : 'Exposed via NodePort'
        ),
      ];
    }),
  NET003: resources =>
    resources.ingress.data.flatMap(ingress => {
      const findings: Finding[] = [];
      if (
        !json(ingress)?.spec?.ingressClassName &&
        !objectAnnotations(ingress)['kubernetes.io/ingress.class']
      )
        findings.push(finding(ingress, 'Missing ingress class'));
      (json(ingress)?.spec?.tls || []).forEach((tls: any) => {
        if (
          tls.secretName &&
          !resources.secret.data.some(
            secret => namespace(secret) === namespace(ingress) && name(secret) === tls.secretName
          )
        )
          findings.push(finding(ingress, `TLS secret ${tls.secretName} not found`));
      });
      return findings;
    }),
  NET004: resources =>
    resources.namespace.data
      .filter(
        ns =>
          resources.pod.data.some(pod => namespace(pod) === name(ns)) &&
          !resources.networkpolicy.data.some(policy => namespace(policy) === name(ns))
      )
      .map(ns => finding(ns, 'Namespace has pods but no NetworkPolicy')),
  NET005: resources =>
    resources.ingress.data.flatMap(ingress => {
      const seen = new Set<string>();
      return (json(ingress)?.spec?.rules || []).flatMap((rule: any) =>
        (rule.http?.paths || []).flatMap((path: any) => {
          const key = `${rule.host || '*'}${path.path || '/'}`;
          if (seen.has(key)) return [finding(ingress, `Duplicate host/path ${key}`)];
          seen.add(key);
          return [];
        })
      );
    }),
  NET006: resources =>
    resources.ingress.data.flatMap(ingress =>
      (json(ingress)?.spec?.rules || [])
        .filter((rule: any) => String(rule.host || '').includes('*'))
        .map((rule: any) => finding(ingress, `Wildcard host ${rule.host}`))
    ),
  NET007: resources =>
    resources.service.data.flatMap(service => {
      if (json(service)?.spec?.type === 'ExternalName' || !serviceSelector(service)) {
        return [];
      }

      const matchingPods = resources.pod.data.filter(
        pod =>
          namespace(pod) === namespace(service) &&
          selectorMatches(serviceSelector(service), objectLabels(pod)) &&
          json(pod)?.status?.phase === 'Running'
      );
      if (matchingPods.length === 0) {
        return [];
      }

      return (json(service)?.spec?.ports || []).flatMap((port: any) => {
        const targetPort = String(port.targetPort || port.port || '').trim();
        return targetPort && !serviceTargetPortMatchesPods(targetPort, matchingPods)
          ? [finding(service, `Service targetPort '${targetPort}' not found in backing pods`)]
          : [];
      });
    }),
  NET008: resources =>
    resources.service.data
      .filter(
        service =>
          json(service)?.spec?.type === 'ExternalName' &&
          /^\d+\.\d+\.\d+\.\d+$/.test(json(service)?.spec?.externalName || '')
      )
      .map(service =>
        finding(service, `ExternalName points to IP ${json(service)?.spec?.externalName}`)
      ),
  NET009: networkPolicyPermissiveFindings,
  NET010: resources =>
    resources.networkpolicy.data
      .filter(policy => JSON.stringify(json(policy)?.spec || {}).includes('0.0.0.0/0'))
      .map(policy => finding(policy, 'Allows 0.0.0.0/0')),
  NET011: resources =>
    resources.networkpolicy.data
      .filter(policy => !(json(policy)?.spec?.policyTypes || []).length)
      .map(policy => finding(policy, 'policyTypes missing')),
  NET012: resources =>
    resources.pod.data
      .filter(pod => json(pod)?.spec?.hostNetwork)
      .map(pod => finding(pod, 'hostNetwork enabled')),
  NET013: resources =>
    resources.ingress.data.length > 0 &&
    resources.gateway.data.length === 0 &&
    resources.httproute.data.length === 0
      ? [
          {
            resource: 'gateway-api/adoption',
            details: 'Ingress is in use but Gateway API resources are not adopted',
          },
        ]
      : [],
  NET014: resources =>
    resources.httproute.data
      .filter(
        route =>
          !(json(route)?.status?.parents || []).some((parent: any) =>
            (parent.conditions || []).some(
              (condition: any) =>
                condition.type === 'Accepted' && String(condition.status).toLowerCase() === 'true'
            )
          )
      )
      .map(route => finding(route, 'HTTPRoute is not accepted')),
  NET015: resources =>
    resources.gateway.data
      .filter(
        gateway =>
          !resources.httproute.data.some(route =>
            (json(route)?.spec?.parentRefs || []).some(
              (parent: any) =>
                (parent.namespace || namespace(route)) === namespace(gateway) &&
                parent.name === name(gateway)
            )
          )
      )
      .map(gateway => finding(gateway, 'Gateway has no attached HTTPRoutes')),
  NET016: resources =>
    resources.gateway.data.flatMap(gateway =>
      (json(gateway)?.status?.conditions || [])
        .filter(
          (condition: any) =>
            ['Accepted', 'Programmed'].includes(condition.type) &&
            String(condition.status).toLowerCase() !== 'true'
        )
        .map((condition: any) =>
          finding(
            gateway,
            `${condition.type}: ${condition.reason || condition.message || 'not healthy'}`
          )
        )
    ),
  NET017: resources =>
    resources.gateway.data.flatMap(gateway =>
      (json(gateway)?.spec?.listeners || []).flatMap((listener: any) =>
        (listener.tls?.certificateRefs || [])
          .filter((ref: any) => ref.kind === 'Secret' || !ref.kind)
          .filter(
            (ref: any) =>
              !resources.secret.data.some(
                secret =>
                  namespace(secret) === (ref.namespace || namespace(gateway)) &&
                  name(secret) === ref.name
              )
          )
          .map((ref: any) => finding(gateway, `Missing TLS secret ${ref.name}`))
      )
    ),
  NET018: resources => {
    const grouped = new Map<string, any[]>();
    resources.service.data.forEach(service => {
      const key = `${namespace(service)}|${selectorKey(serviceSelector(service))}`;
      if (key.endsWith('|')) return;
      grouped.set(key, [...(grouped.get(key) || []), service]);
    });
    return [...grouped.values()]
      .filter(group => group.length > 1)
      .flatMap(group =>
        group.map(service =>
          finding(service, `Duplicate selector also used by ${group.map(name).join(', ')}`)
        )
      );
  },
  NET019: resources =>
    resources.service.data
      .filter(service => {
        const externalIPs = json(service)?.spec?.externalIPs;
        return Array.isArray(externalIPs) && externalIPs.length > 0;
      })
      .map(service =>
        finding(service, `externalIPs: ${json(service)?.spec?.externalIPs.join(', ')}`)
      ),
  NET020: resources =>
    [
      ...resources.deployment.data,
      ...resources.daemonset.data,
      ...resources.statefulset.data,
      ...resources.pod.data,
      ...resources.service.data,
    ]
      .filter(item => /ingress-nginx/i.test(JSON.stringify(json(item))))
      .map(item => finding(item, 'Ingress NGINX detected')),
  NET021: metadataApiEgressFindings,
  NET022: metadataEndpointFindings,
  NET023: networkPolicySelectorNoMatchFindings,
  NET024: sensitiveAdminInterfaceFindings,
  NODE001: resources =>
    resources.node.data
      .filter(item => !nodeReady(item))
      .map(item => finding(item, 'Ready condition is not True')),
  NODE002: nodePressureFindings,
  NODE003: (resources, config) =>
    resources.node.data
      .filter(
        node =>
          Number(json(node)?.status?.capacity?.pods || 0) > 0 &&
          resources.pod.data.filter(pod => json(pod)?.spec?.nodeName === name(node)).length /
            Number(json(node)?.status?.capacity?.pods || 1) >
            config.thresholds.podsPerNodeCritical / 100
      )
      .map(node => finding(node, `Pod capacity above ${config.thresholds.podsPerNodeCritical}%`)),
  NODE004: nodeUntoleratedTaintFindings,
  NS001: namespaceHygieneFindings,
  NS002: resources =>
    resources.namespace.data
      .filter(ns => !resources.resourcequota.data.some(quota => namespace(quota) === name(ns)))
      .map(ns => finding(ns, 'No ResourceQuota')),
  NS003: resources =>
    resources.namespace.data
      .filter(ns => !resources.limitrange.data.some(limit => namespace(limit) === name(ns)))
      .map(ns => finding(ns, 'No LimitRange')),
  NS004: resources =>
    resources.pod.data
      .filter(pod => namespace(pod) === 'default')
      .map(pod => finding(pod, 'Pod running in default namespace')),
  POD001: (resources, config) =>
    resources.pod.data
      .map(pod => ({ pod, restarts: restartCount(pod) }))
      .filter(item => item.restarts > config.thresholds.restartsWarning)
      .map(item => finding(item.pod, `${item.restarts} restarts`)),
  POD002: (resources, config) =>
    resources.pod.data
      .map(pod => ({ pod, age: daysSince(json(pod)?.status?.startTime) }))
      .filter(
        item =>
          json(item.pod)?.status?.phase === 'Running' &&
          item.age !== null &&
          item.age > config.thresholds.podAgeWarning
      )
      .map(item => finding(item.pod, `${item.age} days old`)),
  POD006: resources =>
    resources.pod.data
      .filter(pod => /debugger/i.test(name(pod)))
      .map(pod => finding(pod, json(pod)?.status?.phase || 'Debug pod left behind')),
  POD007: resources =>
    resources.pod.data
      .filter(pod =>
        podImages(pod).some(
          image =>
            !image.includes('@sha256:') &&
            (image.endsWith(':latest') || image.lastIndexOf(':') <= image.lastIndexOf('/'))
        )
      )
      .map(pod => finding(pod, podImages(pod).join(', '))),
  POD008: resources =>
    resources.pod.data
      .filter(pod => json(pod)?.spec?.automountServiceAccountToken !== false)
      .map(pod => finding(pod, 'automountServiceAccountToken is enabled or inherited')),
  POD009: allocatedDeviceHealthFindings,
  POD010: resources =>
    resources.pod.data
      .filter(pod => !isStaticMirrorPod(pod) && !isControlledPod(pod))
      .map(pod => finding(pod, 'Pod is not managed by a workload controller')),
  POD011: resources =>
    resources.pod.data
      .filter(pod => json(pod)?.spec?.shareProcessNamespace === true)
      .map(pod => finding(pod, 'shareProcessNamespace enabled')),
  POD012: resources =>
    resources.pod.data
      .filter(pod => Number(json(pod)?.spec?.terminationGracePeriodSeconds) === 0)
      .map(pod => finding(pod, 'terminationGracePeriodSeconds is 0')),
  POD013: bidirectionalMountPropagationFindings,
  PV001: resources =>
    resources.persistentvolume.data
      .filter(
        pv =>
          json(pv)?.status?.phase !== 'Bound' &&
          !resources.persistentvolumeclaim.data.some(
            pvc => json(pvc)?.spec?.volumeName === name(pv)
          )
      )
      .map(pv => finding(pv, 'PV is not bound to any PVC')),
  PVC001: resources =>
    resources.persistentvolumeclaim.data
      .filter(pvc => {
        const condition = pvcUnusedCondition(pvc);
        if (condition) {
          return String(condition.status).toLowerCase() === 'true';
        }
        return !resources.pod.data.some(pod => nonTerminalPodUsesPVC(pod, pvc));
      })
      .map(pvcUnusedFinding),
  PVC003: resources =>
    resources.persistentvolumeclaim.data
      .filter(pvc => (json(pvc)?.spec?.accessModes || []).includes('ReadWriteMany'))
      .filter(
        pvc =>
          !json(pvc)?.spec?.storageClassName ||
          resources.storageclass.data.some(
            sc =>
              name(sc) === json(pvc)?.spec?.storageClassName &&
              /disk|ebs|pd|cinder|local-path/i.test(json(sc)?.provisioner || '')
          )
      )
      .map(pvc => finding(pvc, 'ReadWriteMany PVC may use block storage')),
  PVC004: resources =>
    resources.persistentvolumeclaim.data
      .filter(pvc => json(pvc)?.status?.phase === 'Pending')
      .map(pvc => finding(pvc, 'Pending')),
  PVC005: resources =>
    resources.persistentvolumeclaim.data
      .filter(pvc =>
        JSON.stringify(json(pvc)?.status || {})
          .toLowerCase()
          .includes('fail')
      )
      .map(pvc => finding(pvc, 'PVC resize or allocation failure signal')),
  RBAC001: rbacMisconfigFindings,
  RBAC002: rbacOverexposureFindings,
  RBAC003: resources => {
    const used = usedServiceAccountKeys(resources);
    return resources.serviceaccount.data
      .filter(sa => name(sa) !== 'default' && !used.has(rbacResourceKey(sa)))
      .map(sa => finding(sa, 'ServiceAccount not used by pods or RBAC bindings'));
  },
  RBAC004: orphanedRolesFindings,
  RBAC005: (resources, config) => {
    const bound = boundRoleRefs(resources, config);
    return [
      ...resources.clusterrole.data
        .filter(role => bound.has(`ClusterRole:${name(role)}`) && grantsKubeletProxy(role))
        .map(role => finding(role, 'Grants nodes/proxy access')),
      ...resources.role.data
        .filter(role => bound.has(`Role:${rbacResourceKey(role)}`) && grantsKubeletProxy(role))
        .map(role => finding(role, 'Grants nodes/proxy access')),
    ];
  },
  RBAC006: (resources, config) => {
    const bound = boundRoleRefs(resources, config);
    return [
      ...resources.clusterrole.data
        .filter(role => bound.has(`ClusterRole:${name(role)}`))
        .flatMap(dangerousRBACFindings),
      ...resources.role.data
        .filter(role => bound.has(`Role:${rbacResourceKey(role)}`))
        .flatMap(dangerousRBACFindings),
    ];
  },
  RBAC007: broadSubjectBindingFindings,
  RBAC008: crossNamespaceServiceAccountBindingFindings,
  RBAC009: defaultServiceAccountDangerousFindings,
  RBAC010: sensitiveServiceAccountWorkloadFindings,
  RBAC011: eventTamperingRbacFindings,
  SC002_AKS: resources =>
    resources.storageclass.data
      .filter(sc =>
        ['kubernetes.io/azure-disk', 'kubernetes.io/azure-file'].includes(json(sc)?.provisioner)
      )
      .map(sc => finding(sc, 'Azure in-tree provisioner')),
  SC002_EXPANSION: resources =>
    resources.storageclass.data
      .filter(sc => json(sc)?.allowVolumeExpansion !== true)
      .map(sc => finding(sc, 'Volume expansion disabled')),
  SC003: clusterStoragePressureFindings,
  SEC001: resources => {
    const used = usedSecretKeys(resources);
    return resources.secret.data
      .filter(
        secret =>
          !name(secret).startsWith('sh.helm.release.v1.') &&
          !name(secret).startsWith('bootstrap-token-') &&
          !name(secret).startsWith('default-token-') &&
          name(secret) !== 'kube-root-ca.crt'
      )
      .filter(
        secret =>
          !used.has(`${namespace(secret)}/${name(secret)}`) && !used.has(`*/${name(secret)}`)
      )
      .map(secret => finding(secret, 'Secret appears unused'));
  },
  SEC007: resources =>
    resources.namespace.data
      .filter(ns => !objectLabels(ns)?.['pod-security.kubernetes.io/enforce'])
      .map(ns => finding(ns, 'No pod-security enforce label')),
  SEC018: resources =>
    resources.serviceaccount.data
      .filter(serviceAccount => json(serviceAccount)?.automountServiceAccountToken !== false)
      .map(serviceAccount =>
        finding(
          serviceAccount,
          'Some ServiceAccounts have automountServiceAccountToken enabled, potentially exposing API credentials to Pods.',
          'Some ServiceAccounts have automountServiceAccountToken enabled, potentially exposing API credentials to Pods.',
          {
            yamlPath: 'automountServiceAccountToken',
            yamlValue:
              json(serviceAccount)?.automountServiceAccountToken ?? 'not set (defaults to true)',
          }
        )
      ),
  SEC022: missingSecretReferenceFindings,
  SEC028: resources => [
    ...resources.pod.data.flatMap(pod =>
      (json(pod)?.spec?.imagePullSecrets || []).map((secret: any) =>
        finding(pod, `imagePullSecret ${secret.name || 'unknown'}`)
      )
    ),
    ...resources.serviceaccount.data.flatMap(sa =>
      (json(sa)?.imagePullSecrets || []).map((secret: any) =>
        finding(sa, `imagePullSecret ${secret.name || 'unknown'}`)
      )
    ),
  ],
  SEC025: validatingAdmissionPolicyBindingFindings,
  SEC026: resources =>
    resources.validatingadmissionpolicy.data
      .filter(
        policy =>
          !toArray(json(policy)?.spec?.validations).some((validation: any) =>
            stringValue(validation?.expression)
          )
      )
      .map(policy =>
        finding(policy, 'ValidatingAdmissionPolicy has no CEL validation rules defined.')
      ),
  SEC030: admissionWebhookFindings,
  SEC031: secretMaterialFindings,
  SEC032: tlsSecretCertificateFindings,
  SEC033: configMapSensitiveDataFindings,
  SEC034: resources => imageFindings(resources, eolImageReason),
  SEC035: resources =>
    imageFindings(resources, image =>
      imageHasDigest(image) ? '' : 'Image is not pinned to a digest'
    ),
  SEC036: dockerInDockerFindings,
  SEC037: sshServerContainerFindings,
  SEC038: writableHostPathFindings,
  SEC040: serviceAccountTokenProjectionFindings,
  WRK001: resources =>
    resources.daemonset.data
      .filter(
        daemonSet =>
          (json(daemonSet)?.status?.numberReady || 0) <
          (json(daemonSet)?.status?.desiredNumberScheduled || 0)
      )
      .map(daemonSet =>
        finding(
          daemonSet,
          `${json(daemonSet)?.status?.numberReady || 0}/${
            json(daemonSet)?.status?.desiredNumberScheduled || 0
          } ready`
        )
      ),
  WRK002: resources =>
    resources.deployment.data
      .filter(
        deployment =>
          (json(deployment)?.status?.availableReplicas || 0) <
          (json(deployment)?.spec?.replicas || 1)
      )
      .map(deployment =>
        finding(
          deployment,
          `${json(deployment)?.status?.availableReplicas || 0}/${
            json(deployment)?.spec?.replicas || 1
          } available`
        )
      ),
  WRK003: resources =>
    resources.statefulset.data
      .filter(
        statefulSet =>
          (json(statefulSet)?.status?.readyReplicas || 0) <
          (json(statefulSet)?.status?.replicas || 1)
      )
      .map(statefulSet =>
        finding(
          statefulSet,
          `${json(statefulSet)?.status?.readyReplicas || 0}/${
            json(statefulSet)?.status?.replicas || 1
          } ready`
        )
      ),
  WRK004: resources =>
    resources.horizontalpodautoscaler.data
      .filter(
        hpa =>
          !(json(hpa)?.status?.currentMetrics || []).length ||
          (json(hpa)?.status?.conditions || []).some(
            (condition: any) => condition.status === 'False'
          )
      )
      .map(hpa => finding(hpa, 'HPA has no metrics or unhealthy condition')),
  WRK005: resources => workloadResourceFindings(resources, 'requests'),
  WRK006: pdbCoverageFindings,
  WRK007: workloadProbeFindings,
  WRK008: resources =>
    resources.deployment.data
      .filter(
        deployment =>
          !resources.pod.data.some(
            pod =>
              namespace(pod) === namespace(deployment) &&
              selectorMatches(workloadSelector(deployment), objectLabels(pod))
          )
      )
      .map(deployment => finding(deployment, 'Deployment selector matches no pods')),
  WRK009: deploymentLabelConsistencyFindings,
  WRK010: resources =>
    resources.horizontalpodautoscaler.data
      .filter(hpa =>
        (json(hpa)?.spec?.metrics || []).some((metric: any) => metric.type === 'Resource')
      )
      .flatMap(hpa => {
        const targetName = json(hpa)?.spec?.scaleTargetRef?.name;
        const workload = allWorkloads(resources).find(
          item => namespace(item) === namespace(hpa) && name(item) === targetName
        );
        return workload
          ? workloadContainers(workload)
              .filter(
                container =>
                  !hasResource(container, 'requests', 'cpu') &&
                  !hasResource(container, 'requests', 'memory')
              )
              .map(container => finding(hpa, `Target container ${container.name} missing requests`))
          : [finding(hpa, `Target ${targetName} not found`)];
      }),
  WRK011: resources =>
    resources.verticalpodautoscaler.data.map(vpa =>
      finding(vpa, 'VPA detected; verify update mode and workload requests')
    ),
  WRK012: resources =>
    allWorkloads(resources)
      .filter(
        workload =>
          Number(json(workload)?.spec?.replicas || 1) > 1 &&
          !resources.poddisruptionbudget.data.some(
            pdb =>
              namespace(pdb) === namespace(workload) &&
              selectorMatches(json(pdb)?.spec?.selector?.matchLabels, workloadLabels(workload))
          )
      )
      .map(workload => finding(workload, 'Replicated workload has no matching PDB')),
  WRK013: (resources, config) =>
    resources.pod.data.flatMap(pod => {
      const specByName = new Map<string, any>(
        containers(pod, false).map(container => [String(container.name || ''), container])
      );
      return (json(pod)?.status?.containerStatuses || []).flatMap((status: any) => {
        const reasons: string[] = [];
        const restarts = Number(status?.restartCount || 0);
        if (status?.state?.waiting?.reason === 'CrashLoopBackOff') {
          reasons.push('CrashLoopBackOff');
        }
        if (
          status?.lastState?.terminated?.reason === 'OOMKilled' ||
          status?.state?.terminated?.reason === 'OOMKilled'
        ) {
          reasons.push('OOMKilled');
        }
        if (restarts >= config.thresholds.restartsCritical) {
          reasons.push(`HighRestarts(${restarts})`);
        }
        if (reasons.length === 0) {
          return [];
        }

        const spec = specByName.get(String(status?.name || '')) || {};
        return [
          finding(
            pod,
            `${reasons.join(', ')} cpuReq=${spec?.resources?.requests?.cpu || ''} cpuLimit=${
              spec?.resources?.limits?.cpu || ''
            } memReq=${spec?.resources?.requests?.memory || ''} memLimit=${
              spec?.resources?.limits?.memory || ''
            }`
          ),
        ];
      });
    }),
  WRK014: resources => workloadResourceFindings(resources, 'limits', true),
  WRK015: resources =>
    allWorkloads(resources)
      .filter(replicatedWorkloadMissingSpread)
      .map(workload =>
        finding(
          workload,
          'Replicated workload defines neither pod anti-affinity nor topology spread constraints'
        )
      ),
  WRK017: workloadReplicaFindings,
  WRK018: resources =>
    resources.deployment.data
      .filter(deployment => json(deployment)?.spec?.strategy?.type === 'Recreate')
      .map(deployment => finding(deployment, 'Deployment strategy is Recreate')),
  WRK019: resources =>
    resources.deployment.data
      .filter(deployment => Number(json(deployment)?.spec?.revisionHistoryLimit) === 0)
      .map(deployment => finding(deployment, 'revisionHistoryLimit is 0')),
  WRK020: workloadDnsOverrideFindings,
  WRK021: missingPriorityClassFindings,
  WRK022: hpaBurstCapacityFindings,
  WRK023: multiplePdbFindings,
  WRK024: impossiblePdbFindings,
  WRK025: identicalProbeFindings,
  WRK026: ephemeralStorageFindings,
  WRK027: statefulSetHeadlessServiceFindings,
  WRK028: hpaTargetMissingFindings,
  WRK029: pdbUnhealthyPodEvictionPolicyFindings,
  WRK016: resources => allWorkloads(resources).flatMap(recommendedLabelFindings),
};

export function evaluateCheck(
  check: GeneratedCheck,
  resources: ResourceStates,
  config: KubeBuddyConfig
): CheckResult {
  if (check.nativeHandler) {
    const handler = nativeHandlers[check.nativeHandler];
    if (!handler) {
      return resultFromCheck(
        check,
        [],
        'skipped',
        `Native handler ${check.nativeHandler} is not implemented in the Headlamp plugin yet.`
      );
    }
    return resultFromCheck(check, handler(resources, config));
  }

  const nativeIdHandler = check.id === 'SEC018' ? nativeHandlers[check.id] : undefined;
  if (nativeIdHandler) {
    return resultFromCheck(check, nativeIdHandler(resources, config));
  }

  const items = getResourcesForCheck(check, resources);
  if (!items) {
    return resultFromCheck(
      check,
      [],
      'skipped',
      `Resource kind ${check.resourceKind} is not mapped in the plugin yet.`
    );
  }

  const findings = items.flatMap(resource => {
    const value = resolveExpression(json(resource), check.value);
    const yamlPath = expressionYamlPath(check.value);
    return evaluateOperator(check.operator || 'exists', value, check.expected)
      ? [
          finding(resource, valueDetails(check, value), check.failMessage, {
            yamlPath,
            yamlValue: value,
          }),
        ]
      : [];
  });

  return resultFromCheck(check, findings);
}
