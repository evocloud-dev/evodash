/**
 * The resource kinds the Cluster Health checks read that Headlamp has no class
 * for. Read-only lists, the same as Headlamp's own.
 */
import { makeCustomResourceClass } from '@kinvolk/headlamp-plugin/lib/lib/k8s/crd';

export const EventResource = makeCustomResourceClass({
  apiInfo: [
    { group: '', version: 'v1' },
    { group: 'events.k8s.io', version: 'v1' },
  ],
  kind: 'Event',
  pluralName: 'events',
  singularName: 'event',
  isNamespaced: true,
});

export const APIServiceResource = makeCustomResourceClass({
  apiInfo: [{ group: 'apiregistration.k8s.io', version: 'v1' }],
  kind: 'APIService',
  pluralName: 'apiservices',
  singularName: 'apiservice',
  isNamespaced: false,
});

const ADMISSION = [
  { group: 'admissionregistration.k8s.io', version: 'v1' },
  { group: 'admissionregistration.k8s.io', version: 'v1beta1' },
];

export const MutatingWebhookConfiguration = makeCustomResourceClass({
  apiInfo: ADMISSION,
  kind: 'MutatingWebhookConfiguration',
  pluralName: 'mutatingwebhookconfigurations',
  singularName: 'mutatingwebhookconfiguration',
  isNamespaced: false,
});

export const ValidatingWebhookConfiguration = makeCustomResourceClass({
  apiInfo: ADMISSION,
  kind: 'ValidatingWebhookConfiguration',
  pluralName: 'validatingwebhookconfigurations',
  singularName: 'validatingwebhookconfiguration',
  isNamespaced: false,
});

export const ValidatingAdmissionPolicy = makeCustomResourceClass({
  apiInfo: ADMISSION,
  kind: 'ValidatingAdmissionPolicy',
  pluralName: 'validatingadmissionpolicies',
  singularName: 'validatingadmissionpolicy',
  isNamespaced: false,
});

export const ValidatingAdmissionPolicyBinding = makeCustomResourceClass({
  apiInfo: ADMISSION,
  kind: 'ValidatingAdmissionPolicyBinding',
  pluralName: 'validatingadmissionpolicybindings',
  singularName: 'validatingadmissionpolicybinding',
  isNamespaced: false,
});
