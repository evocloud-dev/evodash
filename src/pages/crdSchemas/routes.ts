/**
 * Route names for the schema browser, in one place.
 *
 * The index links to the detail page, the detail page's breadcrumb links back,
 * and index.tsx registers both. A name typed out in three files is a name that
 * eventually only matches in two, and a `createRouteURL` given one that does not
 * resolve returns an empty path rather than failing — so the link would simply
 * stop working with nothing to show for it.
 */
import { Router } from '@kinvolk/headlamp-plugin/lib';

// Via the namespace, not `lib/lib/router` — see the note in ui/chrome.tsx.
const { createRouteURL } = Router;

export const CRD_SCHEMAS_ROUTE = 'evocloud-crd-schemas';
export const CRD_SCHEMA_ROUTE = 'evocloud-crd-schema';

/** URL of one version's schema page. `crdName` is the CRD's `plural.group`. */
export function schemaURL(crdName: string, version: string): string {
  return createRouteURL(CRD_SCHEMA_ROUTE, { name: crdName, version });
}
