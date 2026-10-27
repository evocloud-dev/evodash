/**
 * Whether Kyverno itself is running — the guard, rather than what it found.
 *
 * Reports outlive the controllers that wrote them, so a page of passing results
 * says nothing about whether anything is still checking. This reads the
 * controllers' Deployments and the webhook configurations Kyverno registers,
 * which are what actually put it in the path of a request.
 *
 * Controllers are found by the component label Kyverno's chart and its release
 * manifest both set, then kept only if their image is Kyverno's: the component
 * names are generic enough that another operator could share one. The
 * reports-server EvoCloud installs alongside is looked up by name.
 */

import { K8s } from '@kinvolk/headlamp-plugin/lib';
import { makeCustomResourceClass } from '@kinvolk/headlamp-plugin/lib/lib/k8s/crd';
import { ListQuery } from '../../ui/chrome';

// Declared here rather than imported from Headlamp's own k8s modules: the build
// maps only a few deep `lib/lib/...` paths to the running app, and these are
// not among them, so importing them compiles and then fails in the browser.
// The CRD helper is mapped, and serves any API group, built-in ones included.
const ValidatingWebhookConfiguration = makeCustomResourceClass({
  apiInfo: [{ group: 'admissionregistration.k8s.io', version: 'v1' }],
  kind: 'ValidatingWebhookConfiguration',
  pluralName: 'validatingwebhookconfigurations',
  singularName: 'validatingwebhookconfiguration',
  isNamespaced: false,
});

const MutatingWebhookConfiguration = makeCustomResourceClass({
  apiInfo: [{ group: 'admissionregistration.k8s.io', version: 'v1' }],
  kind: 'MutatingWebhookConfiguration',
  pluralName: 'mutatingwebhookconfigurations',
  singularName: 'mutatingwebhookconfiguration',
  isNamespaced: false,
});

/** Kyverno's controllers, by component label, in the order they are shown. */
const COMPONENTS: Record<string, string> = {
  'admission-controller': 'Admission',
  'background-controller': 'Background',
  'cleanup-controller': 'Cleanup',
  'reports-controller': 'Reports',
};

const WEBHOOK_SELECTOR = 'webhook.kyverno.io/managed-by=kyverno';

export interface Controller {
  key: string;
  /** Short name for the strip: Admission, Reports, … */
  label: string;
  name: string;
  namespace: string;
  ready: number;
  desired: number;
}

export interface KyvernoEngine {
  loading: boolean;
  controllers: Controller[];
  /** Image tag of the admission controller, e.g. v1.18.2. */
  version: string | null;
  webhookConfigs: number;
  webhooks: number;
}

function imageOf(json: any): string {
  return json?.spec?.template?.spec?.containers?.[0]?.image ?? '';
}

/** `reg.kyverno.io/kyverno/kyverno:v1.18.2@sha256:…` → `v1.18.2`. */
function tagOf(image: string): string | null {
  const ref = image.split('@')[0];
  const colon = ref.lastIndexOf(':');
  return colon > ref.lastIndexOf('/') ? ref.slice(colon + 1) : null;
}

function toController(json: any, label: string): Controller {
  const meta = json?.metadata ?? {};
  return {
    key: `${meta.namespace}/${meta.name}`,
    label,
    name: meta.name ?? '',
    namespace: meta.namespace ?? '',
    ready: json?.status?.readyReplicas ?? 0,
    desired: json?.spec?.replicas ?? 1,
  };
}

function jsonOf(query: ListQuery): any[] {
  return (query.items ?? []).map((item: any) => item?.jsonData ?? item);
}

export function useKyvernoEngine(): KyvernoEngine {
  const deployments = K8s.ResourceClasses.Deployment.useList({
    labelSelector: `app.kubernetes.io/component in (${Object.keys(COMPONENTS).join(',')})`,
  }) as unknown as ListQuery;
  const reportsServer = K8s.ResourceClasses.Deployment.useList({
    labelSelector: 'app.kubernetes.io/name=reports-server',
  }) as unknown as ListQuery;
  const validating = ValidatingWebhookConfiguration.useList({
    labelSelector: WEBHOOK_SELECTOR,
  }) as unknown as ListQuery;
  const mutating = MutatingWebhookConfiguration.useList({
    labelSelector: WEBHOOK_SELECTOR,
  }) as unknown as ListQuery;

  const kyverno = jsonOf(deployments).filter(json => imageOf(json).includes('kyverno'));
  const order = Object.keys(COMPONENTS);
  const controllers = kyverno
    .map(json => {
      const component = json?.metadata?.labels?.['app.kubernetes.io/component'];
      return { component, controller: toController(json, COMPONENTS[component] ?? component) };
    })
    .sort((a, b) => order.indexOf(a.component) - order.indexOf(b.component))
    .map(({ controller }) => controller);

  for (const json of jsonOf(reportsServer)) {
    controllers.push(toController(json, 'Reports server'));
  }

  const admission = kyverno.find(
    json => json?.metadata?.labels?.['app.kubernetes.io/component'] === 'admission-controller'
  );
  const configs = [...jsonOf(validating), ...jsonOf(mutating)];

  return {
    loading: [deployments, validating, mutating].some(q => q.isLoading),
    controllers,
    version: admission ? tagOf(imageOf(admission)) : null,
    webhookConfigs: configs.length,
    webhooks: configs.reduce((n, json) => n + (json?.webhooks?.length ?? 0), 0),
  };
}
