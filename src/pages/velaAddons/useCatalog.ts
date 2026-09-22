/**
 * Fetching the addon catalog, one registry at a time.
 *
 * This is the only place in the plugin that talks to something other than the
 * Kubernetes API. It goes straight out of the browser: Headlamp does have a
 * proxy for plugins that need to reach the internet, but it answers only for
 * URLs an administrator has put on an allow-list, so a page that depended on it
 * would show nothing on an unconfigured install. A registry that serves its
 * index with CORS open needs no proxy at all.
 *
 * Registries are fetched in parallel and reported separately. One unreachable
 * registry must not empty the page of the addons the others published, and the
 * page needs to be able to name which one failed.
 */
import React from 'react';
import { AddonRegistry, CatalogAddon, indexCandidates, parseHelmIndex } from '../../k8s/velaAddons';

export type RegistryStatus = 'ok' | 'empty' | 'error' | 'unsupported';

/** What came back from one registry. */
export interface RegistryResult {
  registry: AddonRegistry;
  status: RegistryStatus;
  count: number;
  /** The URL that answered, for the ones that did. */
  source?: string;
  /** Plain-language reason, for the ones that did not. */
  error?: string;
}

export interface CatalogState {
  addons: CatalogAddon[];
  results: RegistryResult[];
  loading: boolean;
}

/**
 * Turn a failed fetch into something worth reading.
 *
 * A browser reports every cross-origin refusal as the same bare "Failed to
 * fetch" with no detail, by design — the page is not allowed to learn why. So
 * the common cause is named as the likely one rather than reported as fact,
 * because the alternative is showing the user two words that explain nothing.
 */
function describeFailure(url: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return (
      `The browser could not reach ${url}. That is usually the registry not allowing ` +
      `cross-origin requests, or redirecting to somewhere that does not — both of which ` +
      `only affect reading it from a browser. The vela CLI is unaffected.`
    );
  }
  return `${url}: ${message}`;
}

async function fetchRegistry(
  registry: AddonRegistry,
  signal: AbortSignal
): Promise<{ result: RegistryResult; addons: CatalogAddon[] }> {
  const candidates = indexCandidates(registry);

  if (candidates.length === 0) {
    return {
      addons: [],
      result: {
        registry,
        status: 'unsupported',
        count: 0,
        error:
          registry.kind === 'helm'
            ? 'This registry has no URL configured.'
            : `Browsing a ${registry.kind} registry needs the vela CLI — only helm registries publish an index this page can read.`,
      },
    };
  }

  let lastError: string | undefined;

  for (const url of candidates) {
    try {
      const response = await fetch(url, { signal });
      if (!response.ok) {
        lastError = `${url} answered ${response.status} ${response.statusText}`;
        continue;
      }

      const addons = parseHelmIndex(await response.text(), registry.name);
      return {
        addons,
        result: {
          registry,
          status: addons.length ? 'ok' : 'empty',
          count: addons.length,
          source: url,
          error: addons.length ? undefined : `${url} is a valid index listing no addons.`,
        },
      };
    } catch (err) {
      if (signal.aborted) {
        throw err;
      }
      lastError = describeFailure(url, err);
    }
  }

  return {
    addons: [],
    result: { registry, status: 'error', count: 0, error: lastError },
  };
}

export function useCatalog(registries: AddonRegistry[]): CatalogState {
  // Identity of the registry list, not the array itself: the ConfigMap it is
  // built from re-renders on every watch event, and refetching 40 addons over
  // the network because an unrelated object changed would be absurd.
  const key = registries.map(r => `${r.name}|${r.kind}|${r.url ?? ''}`).join('\n');

  const latest = React.useRef(registries);
  latest.current = registries;

  const [state, setState] = React.useState<CatalogState>({
    addons: [],
    results: [],
    loading: registries.length > 0,
  });

  React.useEffect(() => {
    const current = latest.current;

    if (current.length === 0) {
      setState({ addons: [], results: [], loading: false });
      return undefined;
    }

    const controller = new AbortController();
    setState(previous => ({ ...previous, loading: true }));

    (async () => {
      try {
        const settled = await Promise.all(
          current.map(registry => fetchRegistry(registry, controller.signal))
        );
        if (controller.signal.aborted) {
          return;
        }
        setState({
          addons: settled.flatMap(s => s.addons),
          results: settled.map(s => s.result),
          loading: false,
        });
      } catch {
        // Only an abort reaches here — fetchRegistry resolves every other
        // failure into a result. A cancelled fetch has no state to report.
        if (!controller.signal.aborted) {
          setState({ addons: [], results: [], loading: false });
        }
      }
    })();

    return () => controller.abort();
  }, [key]);

  return state;
}
