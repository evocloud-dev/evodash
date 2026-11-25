/**
 * The resource lists the Cluster Health checks read, put into the shape the
 * engine expects, with excluded namespaces taken out. No React, so a scan can
 * be run on fixtures in tests exactly as the page runs it.
 */
import { isSystemNamespace } from '../namespaces';
import {
  DEFAULT_EXCLUDED_NAMESPACES,
  defaultKubeBuddyConfig,
  KubeBuddyConfig,
  namespaceOrName,
  ResourceState,
  ResourceStates,
} from './engine';

/** Every list a scan reads, by the label the page reports it under. */
export const HEALTH_LISTS = [
  'APIServices',
  'ClusterRoleBindings',
  'ClusterRoles',
  'ConfigMaps',
  'CronJobs',
  'DaemonSets',
  'Deployments',
  'Endpoints',
  'EndpointSlices',
  'Events',
  'Gateways',
  'HorizontalPodAutoscalers',
  'HTTPRoutes',
  'Ingresses',
  'Jobs',
  'LimitRanges',
  'MutatingWebhookConfigurations',
  'Namespaces',
  'NetworkPolicies',
  'Nodes',
  'PersistentVolumeClaims',
  'PersistentVolumes',
  'PodDisruptionBudgets',
  'Pods',
  'ResourceQuotas',
  'RoleBindings',
  'Roles',
  'Secrets',
  'ServiceAccounts',
  'Services',
  'StatefulSets',
  'StorageClasses',
  'ValidatingAdmissionPolicies',
  'ValidatingAdmissionPolicyBindings',
  'ValidatingWebhookConfigurations',
] as const;

export type HealthList = (typeof HEALTH_LISTS)[number];

/**
 * Lists a cluster may simply not have: Gateway API is an add-on, and the
 * admission policy APIs are recent. Missing, they count as empty.
 */
export const OPTIONAL_LISTS: HealthList[] = [
  'Gateways',
  'HTTPRoutes',
  'ValidatingAdmissionPolicies',
  'ValidatingAdmissionPolicyBindings',
];

const EMPTY: ResourceState = { data: [], loading: false };

/**
 * Namespaces a scan leaves out unless asked not to: KubeBuddy's defaults and
 * this plugin's own rule for platform namespaces, so the score is about the
 * workloads rather than the control plane, which needs what the checks forbid.
 */
export function isExcludedByDefault(namespace: string): boolean {
  return DEFAULT_EXCLUDED_NAMESPACES.includes(namespace) || isSystemNamespace(namespace);
}

function without(state: ResourceState, excluded: (ns: string) => boolean): ResourceState {
  return {
    ...state,
    data: state.data.filter(item => {
      const ns = namespaceOrName(item);
      return !ns || !excluded(ns);
    }),
  };
}

/**
 * The engine's resource map, keyed the way the check catalog names kinds,
 * including the combined keys a few checks read ("role,clusterrole").
 */
export function buildResourceStates(
  lists: Partial<Record<HealthList, ResourceState>>,
  excluded: (ns: string) => boolean = () => false
): ResourceStates {
  const get = (label: HealthList) => without(lists[label] ?? EMPTY, excluded);
  const roles = get('Roles');
  const clusterRoles = get('ClusterRoles');
  const mutating = get('MutatingWebhookConfigurations');
  const validating = get('ValidatingWebhookConfigurations');
  const vapBindings = get('ValidatingAdmissionPolicyBindings');
  const endpoints = get('Endpoints');
  const jobs = get('Jobs');

  return {
    apiservice: get('APIServices'),
    clusterrole: clusterRoles,
    clusterrolebinding: get('ClusterRoleBindings'),
    configmap: get('ConfigMaps'),
    cronjob: get('CronJobs'),
    daemonset: get('DaemonSets'),
    deployment: get('Deployments'),
    endpoint: endpoints,
    endpoints,
    endpointslice: get('EndpointSlices'),
    events: get('Events'),
    gateway: get('Gateways'),
    horizontalpodautoscaler: get('HorizontalPodAutoscalers'),
    httproute: get('HTTPRoutes'),
    ingress: get('Ingresses'),
    job: jobs,
    jobs,
    limitrange: get('LimitRanges'),
    namespace: get('Namespaces'),
    networkpolicy: get('NetworkPolicies'),
    node: get('Nodes'),
    persistentvolume: get('PersistentVolumes'),
    persistentvolumeclaim: get('PersistentVolumeClaims'),
    pod: get('Pods'),
    poddisruptionbudget: get('PodDisruptionBudgets'),
    resourcequota: get('ResourceQuotas'),
    role: roles,
    'role,clusterrole': { data: [...roles.data, ...clusterRoles.data], loading: false },
    rolebinding: get('RoleBindings'),
    secret: get('Secrets'),
    service: get('Services'),
    serviceaccount: get('ServiceAccounts'),
    statefulset: get('StatefulSets'),
    storageclass: get('StorageClasses'),
    validatingadmissionpolicy: get('ValidatingAdmissionPolicies'),
    validatingadmissionpolicybinding: vapBindings,
    validatingadmissionpolicybindings: vapBindings,
    mutatingwebhookconfiguration: mutating,
    validatingwebhookconfiguration: validating,
    'mutatingwebhookconfiguration,validatingwebhookconfiguration': {
      data: [...mutating.data, ...validating.data],
      loading: false,
    },
    // The plugin reads no VPA list, as upstream's does not: VPA checks pass empty.
    verticalpodautoscaler: EMPTY,
  };
}

/**
 * KubeBuddy's configuration for a scan. The RBAC checks read the excluded
 * namespaces from here as well as from the lists, so both say the same.
 */
export function healthConfig(excludedNamespaces: string[]): KubeBuddyConfig {
  const config = defaultKubeBuddyConfig();
  return {
    ...config,
    useSystemNamespaceExclusions: excludedNamespaces.length > 0,
    excludedNamespaces,
  };
}
