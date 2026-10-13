/**
 * The KubeVela addon catalog: where to look, and what comes back.
 *
 * An addon is a packaged capability — cert-manager, Flux, KEDA, VelaUX itself —
 * published to a registry and installed into the cluster as an Application. Two
 * halves again, and this file reads both sides of the comparison the page
 * makes: the registries the cluster is configured with, and the index each one
 * publishes.
 *
 * Nothing here installs anything. Installing an addon means rendering its CUE
 * with the parameters you chose, which needs a CUE evaluator — the one thing a
 * plugin running in a browser cannot do. Listing, though, needs nothing but a
 * ConfigMap and one file over HTTP.
 */
import { load as loadYaml } from 'js-yaml';

/** Where KubeVela records the registries it will install addons from. */
export const REGISTRY_CONFIGMAP = 'vela-addon-registry';

/** The single key inside it: a JSON object of registry name to definition. */
export const REGISTRY_DATA_KEY = 'registries';

export type RegistryKind = 'helm' | 'git' | 'gitee' | 'oss' | 'unknown';

export interface AddonRegistry {
  name: string;
  kind: RegistryKind;
  url: string | null;
  /** Subdirectory holding the addons, on a git registry. */
  path?: string;
}

/**
 * Read the configured registries out of the ConfigMap.
 *
 * The value is JSON inside YAML inside a ConfigMap, which is KubeVela's own
 * arrangement and not something this can tidy up. Anything unparseable yields
 * no registries rather than an exception: a malformed entry means the catalog
 * has nothing to show, which the page says plainly, and not that it crashes.
 */
export function parseRegistries(data?: Record<string, string> | null): AddonRegistry[] {
  const raw = data?.[REGISTRY_DATA_KEY];
  if (!raw) {
    return [];
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== 'object') {
    return [];
  }

  return Object.entries<any>(parsed).map(([key, value]) => {
    const name = typeof value?.name === 'string' && value.name ? value.name : key;

    if (value?.helm?.url) {
      return { name, kind: 'helm' as const, url: String(value.helm.url) };
    }
    if (value?.git?.url) {
      return {
        name,
        kind: 'git' as const,
        url: String(value.git.url),
        path: value.git.path ? String(value.git.path) : undefined,
      };
    }
    if (value?.gitee?.url) {
      return { name, kind: 'gitee' as const, url: String(value.gitee.url) };
    }
    if (value?.oss?.endpoint) {
      return { name, kind: 'oss' as const, url: String(value.oss.endpoint) };
    }
    return { name, kind: 'unknown' as const, url: null };
  });
}

/**
 * The URLs worth trying for a helm registry's index, best first.
 *
 * Normally there is one: the configured URL with `/index.yaml` on the end. The
 * second candidate exists because of a problem that is specific to a browser
 * and cannot be solved in one.
 *
 * KubeVela ships pointing at `kubevela.github.io/catalog/official`. GitHub
 * Pages serves that repository under a custom domain, so it answers with a
 * redirect to `kubevela.io` — and a redirect in reply to a cross-origin request
 * must itself carry the CORS header, which this one does not. The browser
 * therefore refuses to follow it and the fetch fails outright, while the
 * destination it was pointing at serves the very same file with CORS open.
 * `vela` and VelaUX never notice: they fetch from a server, where none of this
 * applies.
 *
 * So the destination is offered as a fallback rather than a rewrite. If GitHub
 * ever starts sending the header, or KubeVela changes the default, the first
 * candidate simply starts working and this stops being reached.
 */
export function indexCandidates(registry: AddonRegistry): string[] {
  if (registry.kind !== 'helm' || !registry.url) {
    return [];
  }

  const base = registry.url.replace(/\/+$/, '');
  const candidates = [`${base}/index.yaml`];

  const redirected = base.replace(
    'https://kubevela.github.io/catalog',
    'https://kubevela.io/catalog'
  );
  if (redirected !== base) {
    candidates.push(`${redirected}/index.yaml`);
  }

  return candidates;
}

/** One published version of an addon. */
export interface AddonVersion {
  version: string;
  created?: string;
  /** Where the package itself can be downloaded. */
  url?: string;
  /** The `system.vela` requirement: which KubeVela versions it will install on. */
  requires?: string;
}

/** One addon, as a registry describes it. */
export interface CatalogAddon {
  name: string;
  /** Name of the registry it came from — two registries may both carry a name. */
  registry: string;
  description?: string;
  icon?: string;
  home?: string;
  tags: string[];
  /** Newest first. */
  versions: AddonVersion[];
  latest: AddonVersion | null;
}

/**
 * Read a Helm repository index into addons.
 *
 * Helm publishes its index newest-version-first per entry and that order is
 * kept rather than re-sorted: the versions here are not reliably semver — the
 * official catalog carries `v1.9.5` beside `3.0.2` — so the publisher's own
 * ordering is better evidence of which is current than anything this could
 * work out from the strings.
 */
export function parseHelmIndex(text: string, registryName: string): CatalogAddon[] {
  let index: any;
  try {
    index = loadYaml(text);
  } catch {
    return [];
  }

  const entries = index?.entries;
  if (!entries || typeof entries !== 'object') {
    return [];
  }

  const addons: CatalogAddon[] = [];

  for (const [name, published] of Object.entries<any>(entries)) {
    if (!Array.isArray(published) || published.length === 0) {
      continue;
    }

    const versions: AddonVersion[] = published
      .filter(v => v && typeof v === 'object')
      .map(v => ({
        version: String(v.version ?? ''),
        created: typeof v.created === 'string' ? v.created : undefined,
        url: Array.isArray(v.urls) && v.urls.length ? String(v.urls[0]) : undefined,
        requires:
          typeof v.annotations?.['system.vela'] === 'string'
            ? v.annotations['system.vela']
            : undefined,
      }))
      .filter(v => v.version);

    // The newest entry describes the addon; older ones repeat the description
    // and icon and are only worth keeping for the version list.
    const newest = published[0] ?? {};

    addons.push({
      name: typeof newest.name === 'string' && newest.name ? newest.name : name,
      registry: registryName,
      description: typeof newest.description === 'string' ? newest.description : undefined,
      icon: typeof newest.icon === 'string' ? newest.icon : undefined,
      home: typeof newest.home === 'string' ? newest.home : undefined,
      tags: Array.isArray(newest.keywords) ? newest.keywords.map(String) : [],
      versions,
      latest: versions[0] ?? null,
    });
  }

  return addons.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Compare two version strings well enough to answer "is there a newer one".
 *
 * Not a semver implementation, and not trying to be. It compares the numeric
 * parts in order and treats a version with a pre-release suffix as older than
 * the same version without one. The leading `v` some addons carry and others do
 * not is stripped first, which is the difference that actually matters here:
 * the installed version is read off a label and the available one out of an
 * index, and the two do not agree on the prefix.
 *
 * Returns a negative number when `a` is older, positive when newer, 0 when
 * they compare equal or cannot be told apart.
 */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => {
    const cleaned = v.trim().replace(/^v/i, '');
    const [core, ...rest] = cleaned.split('-');
    return {
      numbers: core.split('.').map(n => Number.parseInt(n, 10)),
      prerelease: rest.join('-'),
    };
  };

  const left = parts(a);
  const right = parts(b);

  const length = Math.max(left.numbers.length, right.numbers.length);
  for (let i = 0; i < length; i += 1) {
    const l = Number.isFinite(left.numbers[i]) ? left.numbers[i] : 0;
    const r = Number.isFinite(right.numbers[i]) ? right.numbers[i] : 0;
    if (l !== r) {
      return l - r;
    }
  }

  if (left.prerelease === right.prerelease) {
    return 0;
  }
  // 1.0.0-rc1 is older than 1.0.0; between two pre-releases, alphabetical is a
  // guess, but a consistent one.
  if (!left.prerelease) {
    return 1;
  }
  if (!right.prerelease) {
    return -1;
  }
  return left.prerelease.localeCompare(right.prerelease);
}

/** What the cluster has installed of one addon. */
export interface InstalledAddon {
  name: string;
  version?: string;
  registry?: string;
  /** Name of the Application KubeVela created for it, for the cross-link. */
  application: string;
  namespace: string;
}

/**
 * Index the installed addons by name, from the Applications KubeVela created.
 *
 * `apps` is the raw list — the Applications the KubeVela Apps page already
 * watches — so the catalog costs no extra request to know what is installed.
 */
export function installedByName(installed: InstalledAddon[]): Record<string, InstalledAddon> {
  const byName: Record<string, InstalledAddon> = {};
  for (const addon of installed) {
    byName[addon.name] = addon;
  }
  return byName;
}
