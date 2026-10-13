/**
 * The documentation for one definition's settings, fetched on demand.
 *
 * KubeVela writes a JSON Schema of every definition's parameters into its own
 * ConfigMap, which is what lets this plugin label an application's settings
 * without evaluating any CUE. There are 180-odd of those ConfigMaps on a stock
 * install and some are tens of kilobytes, so they are never listed — the panel
 * asks for the one definition it is drawing, by name, and only while it is open.
 *
 * One hook per definition rather than one for all of them, so React can
 * cache, dedupe and drop each independently. That means a caller with several
 * components renders a child per component and lets each child call this, which
 * is the only arrangement the rules of hooks allow when the count varies.
 */
import { K8s } from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import {
  DEFINITION_NAMESPACE,
  DefinitionScope,
  ParameterDoc,
  parseParameterDocs,
  SCHEMA_DATA_KEY,
  schemaConfigMapName,
} from '../../k8s/kubevela';

/**
 * Per-field documentation for `type`, or null when there is none to be had.
 *
 * Null covers every way this can come up empty — the schema has not loaded
 * yet, KubeVela never wrote one for this definition, the user cannot read
 * `vela-system`, or the payload was not what it should be. None of those are
 * worth a message: the caller shows the settings unannotated and the page reads
 * as slightly plainer rather than broken.
 */
export function useParameterDocs(
  scope: DefinitionScope,
  type: string
): Record<string, ParameterDoc> | null {
  // An empty type would build a name that cannot exist, which 404s exactly like
  // a definition with no schema — the same null, by the same path.
  const name = schemaConfigMapName(scope, type);

  const [configMap] = K8s.ResourceClasses.ConfigMap.useGet(name, DEFINITION_NAMESPACE);

  return React.useMemo(() => {
    const data = (configMap as any)?.jsonData?.data ?? (configMap as any)?.data;
    return parseParameterDocs(data?.[SCHEMA_DATA_KEY]);
  }, [configMap]);
}
