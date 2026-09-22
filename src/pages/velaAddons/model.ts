/**
 * Shaping and filtering for the addon catalog.
 *
 * The page is a join of two lists that were never meant to line up: what the
 * registries publish, and what the cluster has installed. Doing that join here
 * keeps the page to composition, and keeps the awkward part — an addon that is
 * installed and no longer in any catalog — somewhere it can be handled once.
 */
import { CatalogAddon, compareVersions, InstalledAddon } from '../../k8s/velaAddons';
import { fuzzyMatchAny } from '../../ui/chrome';

export interface AddonView {
  key: string;
  name: string;
  registry: string | null;
  description?: string;
  icon?: string;
  home?: string;
  tags: string[];
  /** Newest published version, or null for an addon no registry carries. */
  latest: string | null;
  /** Requirement the newest version puts on the KubeVela version. */
  requires?: string;
  /** How many versions the registry publishes. */
  versionCount: number;
  installed: InstalledAddon | null;
  /** True only when both versions are known and the published one is newer. */
  updateAvailable: boolean;
  /** The catalog entry, for the detail panel. Absent when only installed. */
  catalog: CatalogAddon | null;
}

/**
 * Join the published catalog to what is installed.
 *
 * An installed addon that no registry carries still gets a card. It is on the
 * cluster either way, and a catalog that quietly omitted it would be a worse
 * answer to "what addons do I have" than one that says it cannot find its
 * listing.
 */
export function buildAddonViews(
  published: CatalogAddon[],
  installed: Record<string, InstalledAddon>
): AddonView[] {
  const views: AddonView[] = published.map(addon => {
    const here = installed[addon.name] ?? null;
    const latest = addon.latest?.version ?? null;

    return {
      key: `${addon.registry}/${addon.name}`,
      name: addon.name,
      registry: addon.registry,
      description: addon.description,
      icon: addon.icon,
      home: addon.home,
      tags: addon.tags,
      latest,
      requires: addon.latest?.requires,
      versionCount: addon.versions.length,
      installed: here,
      updateAvailable: !!(here?.version && latest && compareVersions(here.version, latest) < 0),
      catalog: addon,
    };
  });

  const listed = new Set(published.map(a => a.name));
  for (const addon of Object.values(installed)) {
    if (listed.has(addon.name)) {
      continue;
    }
    views.push({
      key: `installed/${addon.name}`,
      name: addon.name,
      registry: null,
      tags: [],
      latest: null,
      versionCount: 0,
      installed: addon,
      updateAvailable: false,
      catalog: null,
    });
  }

  return views.sort((a, b) => a.name.localeCompare(b.name));
}

/** Every tag in use, most common first, for the filter. */
export function tagsOf(views: AddonView[]): string[] {
  const counts = new Map<string, number>();
  for (const view of views) {
    for (const tag of view.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag]) => tag);
}

export type AddonState = 'all' | 'installed' | 'available' | 'update';

export interface AddonFilter {
  query: string;
  tag: string;
  state: AddonState;
}

export function matchesAddon(view: AddonView, filter: AddonFilter): boolean {
  if (
    filter.query.trim() &&
    !fuzzyMatchAny(filter.query, [view.name, view.description, ...view.tags])
  ) {
    return false;
  }
  if (filter.tag !== 'all' && !view.tags.includes(filter.tag)) {
    return false;
  }
  switch (filter.state) {
    case 'installed':
      return !!view.installed;
    case 'available':
      return !view.installed;
    case 'update':
      return view.updateAvailable;
    default:
      return true;
  }
}

/** Counts for the stat row and the filter labels. */
export function tallyAddons(views: AddonView[]) {
  const installed = views.filter(v => v.installed).length;
  return {
    total: views.length,
    installed,
    available: views.length - installed,
    updatable: views.filter(v => v.updateAvailable).length,
    unlisted: views.filter(v => v.installed && !v.catalog).length,
  };
}
