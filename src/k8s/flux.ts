/**
 * Flux custom resources.
 *
 * Two families are read here:
 *
 * - the Flux toolkit itself — sources (`source.toolkit.fluxcd.io`) and the
 *   controllers that apply them, Kustomization and HelmRelease;
 * - the flux-operator's `fluxcd.controlplane.io` FluxInstance and FluxReport,
 *   which is how a Flux installed by the operator describes its own version
 *   and controller health. Clusters running upstream Flux have no operator, so
 *   both are optional and the page falls back to counting resources directly.
 *
 * Where a kind has been served under more than one API version in supported
 * Flux releases, every version is listed: Headlamp probes them and uses the
 * first that answers, so one plugin build works against a v2beta and a v2
 * cluster alike.
 */
import { makeCustomResourceClass } from '@kinvolk/headlamp-plugin/lib/lib/k8s/crd';

const SOURCE_GROUP = 'source.toolkit.fluxcd.io';

const sourceVersions = [
  { group: SOURCE_GROUP, version: 'v1' },
  { group: SOURCE_GROUP, version: 'v1beta2' },
];

export const GitRepository = makeCustomResourceClass({
  apiInfo: sourceVersions,
  kind: 'GitRepository',
  pluralName: 'gitrepositories',
  singularName: 'gitrepository',
  isNamespaced: true,
});

export const OCIRepository = makeCustomResourceClass({
  apiInfo: sourceVersions,
  kind: 'OCIRepository',
  pluralName: 'ocirepositories',
  singularName: 'ocirepository',
  isNamespaced: true,
});

export const HelmRepository = makeCustomResourceClass({
  apiInfo: sourceVersions,
  kind: 'HelmRepository',
  pluralName: 'helmrepositories',
  singularName: 'helmrepository',
  isNamespaced: true,
});

export const Bucket = makeCustomResourceClass({
  apiInfo: sourceVersions,
  kind: 'Bucket',
  pluralName: 'buckets',
  singularName: 'bucket',
  isNamespaced: true,
});

export const Kustomization = makeCustomResourceClass({
  apiInfo: [
    { group: 'kustomize.toolkit.fluxcd.io', version: 'v1' },
    { group: 'kustomize.toolkit.fluxcd.io', version: 'v1beta2' },
  ],
  kind: 'Kustomization',
  pluralName: 'kustomizations',
  singularName: 'kustomization',
  isNamespaced: true,
});

export const HelmRelease = makeCustomResourceClass({
  apiInfo: [
    { group: 'helm.toolkit.fluxcd.io', version: 'v2' },
    { group: 'helm.toolkit.fluxcd.io', version: 'v2beta2' },
  ],
  kind: 'HelmRelease',
  pluralName: 'helmreleases',
  singularName: 'helmrelease',
  isNamespaced: true,
});

export const FluxInstance = makeCustomResourceClass({
  apiInfo: [{ group: 'fluxcd.controlplane.io', version: 'v1' }],
  kind: 'FluxInstance',
  pluralName: 'fluxinstances',
  singularName: 'fluxinstance',
  isNamespaced: true,
});

export const FluxReport = makeCustomResourceClass({
  apiInfo: [{ group: 'fluxcd.controlplane.io', version: 'v1' }],
  kind: 'FluxReport',
  pluralName: 'fluxreports',
  singularName: 'fluxreport',
  isNamespaced: true,
});

/** The kinds that carry a revision into the cluster. */
export const SOURCE_KINDS = ['GitRepository', 'OCIRepository', 'HelmRepository', 'Bucket'] as const;

/** The kinds that apply a revision to the cluster. */
export const APPLIER_KINDS = ['Kustomization', 'HelmRelease'] as const;

/**
 * What the flux-operator publishes about the installation.
 *
 * Only the fields the GitOps page renders are typed; the report carries more.
 */
export interface FluxReportSpec {
  distribution?: {
    version?: string;
    status?: string;
    managedBy?: string;
    entitlement?: string;
  };
  cluster?: {
    nodes?: number;
    platform?: string;
    serverVersion?: string;
  };
  operator?: {
    version?: string;
    platform?: string;
    apiVersion?: string;
  };
  components?: {
    name: string;
    ready: boolean;
    status?: string;
    image?: string;
  }[];
  reconcilers?: {
    kind: string;
    apiVersion?: string;
    stats?: {
      running?: number;
      failing?: number;
      suspended?: number;
      totalSize?: string;
    };
  }[];
  sync?: {
    id?: string;
    source?: string;
    path?: string;
    ready?: boolean;
    status?: string;
  };
}

/**
 * The revision an object is currently at.
 *
 * Each controller records this in its own field, so they are tried in the order
 * that answers soonest for each kind: sources publish an artifact,
 * Kustomization records what it last applied, and a HelmRelease reports the
 * chart version it has deployed — falling back to what it last attempted when
 * an upgrade is in flight or has failed.
 */
export function fluxRevision(json: any): string | null {
  const status = json?.status ?? {};
  return (
    status.artifact?.revision ??
    status.lastAppliedRevision ??
    status.history?.[0]?.chartVersion ??
    status.lastAttemptedRevision ??
    null
  );
}

/**
 * Where an object gets its content from.
 *
 * Sources carry a URL of their own. Appliers point at a source, so their origin
 * is that reference rather than a URL — rendered as `Kind/namespace/name` so it
 * can be matched against the source rows above it on the page.
 */
export function fluxOrigin(json: any): string | null {
  const spec = json?.spec ?? {};

  if (spec.url) {
    return spec.url;
  }
  // Bucket has no url; it is an endpoint plus a bucket name.
  if (spec.bucketName) {
    return spec.endpoint ? `${spec.endpoint}/${spec.bucketName}` : spec.bucketName;
  }

  const ref = spec.sourceRef ?? spec.chartRef ?? spec.chart?.spec?.sourceRef;
  if (ref?.name) {
    const ns = ref.namespace ? `${ref.namespace}/` : '';
    return ref.kind ? `${ref.kind}/${ns}${ref.name}` : `${ns}${ref.name}`;
  }
  return null;
}
