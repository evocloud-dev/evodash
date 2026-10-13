/**
 * Addons — the capabilities KubeVela can install, and which ones this cluster has.
 *
 * Two sources, joined. The registries come from the cluster, so pointing
 * KubeVela at a different catalog changes this page without touching it, and
 * what is installed comes from the Applications KubeVela writes for its addons
 * — the same list the KubeVela Apps page already watches, so the join costs
 * nothing extra.
 *
 * The catalog itself is fetched from the registry over HTTP, which is the only
 * request in this plugin that leaves the cluster. See velaAddons/useCatalog.ts
 * for why it goes direct rather than through a proxy, and k8s/velaAddons.ts for
 * the one place where a browser has to be told to try a second URL.
 *
 * Reading only. Installing an addon renders its CUE templates, which a browser
 * cannot do; the detail panel hands over the command instead of pretending
 * otherwise.
 */
import { K8s } from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import { addonOf, Application, DEFINITION_NAMESPACE } from '../k8s/kubevela';
import {
  InstalledAddon,
  installedByName,
  parseRegistries,
  REGISTRY_CONFIGMAP,
} from '../k8s/velaAddons';
import {
  Chip,
  Code,
  EvoPage,
  FilterSelect,
  FolderIcon,
  isForbidden,
  isNotFound,
  ListQuery,
  Notice,
  SearchBox,
  SectionHeading,
  SidePanel,
  StatGrid,
  usePalette,
  useSidePanelViable,
} from '../ui/chrome';
import { AddonCard } from './velaAddons/AddonCard';
import { AddonDetail } from './velaAddons/AddonDetail';
import { AddonState, buildAddonViews, matchesAddon, tagsOf, tallyAddons } from './velaAddons/model';
import { useCatalog } from './velaAddons/useCatalog';

export default function VelaAddons() {
  const C = usePalette();

  const [q, setQ] = React.useState('');
  const [tagFilter, setTagFilter] = React.useState('all');
  const [stateFilter, setStateFilter] = React.useState<AddonState>('all');
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const panelViable = useSidePanelViable();

  // Which registries this cluster will install from. Read rather than
  // hardcoded: a cluster pointed at a private catalog must show that catalog.
  const [registryConfig, registryError] = K8s.ResourceClasses.ConfigMap.useGet(
    REGISTRY_CONFIGMAP,
    DEFINITION_NAMESPACE
  );

  const registries = React.useMemo(
    () => parseRegistries((registryConfig as any)?.jsonData?.data ?? (registryConfig as any)?.data),
    [registryConfig]
  );

  const catalog = useCatalog(registries);

  // The addon Applications, off the list the other page already watches.
  const appQuery = Application.useList() as unknown as ListQuery;
  const installed = React.useMemo(() => {
    const found: InstalledAddon[] = [];
    for (const item of appQuery.items ?? []) {
      const json = (item as any).jsonData ?? item;
      const addon = addonOf(json);
      if (!addon) {
        continue;
      }
      found.push({
        name: addon.name,
        version: addon.version,
        registry: addon.registry,
        application: json.metadata?.name ?? addon.name,
        namespace: json.metadata?.namespace ?? '',
      });
    }
    return installedByName(found);
  }, [appQuery.items]);

  const addons = React.useMemo(
    () => buildAddonViews(catalog.addons, installed),
    [catalog.addons, installed]
  );

  const counts = tallyAddons(addons);
  const tags = tagsOf(addons);

  const filter = { query: q, tag: tagFilter, state: stateFilter };
  const shown = addons.filter(a => matchesAddon(a, filter));
  const filtering = !!q.trim() || tagFilter !== 'all' || stateFilter !== 'all';

  const selected = selectedKey ? addons.find(a => a.key === selectedKey) ?? null : null;

  const failed = catalog.results.filter(r => r.status === 'error' || r.status === 'unsupported');
  const reachable = catalog.results.filter(r => r.status === 'ok').length;

  const noRegistryConfig = isNotFound(registryError);
  const registryForbidden = isForbidden(registryError);

  let summary: React.ReactNode;
  if (catalog.loading) {
    summary = 'Fetching the addon catalog';
  } else if (noRegistryConfig) {
    summary = 'KubeVela is not installed on this cluster';
  } else if (registries.length === 0) {
    summary = 'No addon registries are configured';
  } else if (filtering) {
    summary = `${shown.length} of ${addons.length} addons match`;
  } else {
    summary = [
      `${addons.length} ${addons.length === 1 ? 'addon' : 'addons'}`,
      `${counts.installed} installed`,
      `${reachable} of ${registries.length} ${registries.length === 1 ? 'registry' : 'registries'}`,
    ].join(' · ');
  }

  const tagOptions = [
    { value: 'all', label: 'All tags' },
    ...tags.map(tag => ({
      value: tag,
      label: `${tag} (${addons.filter(a => a.tags.includes(tag)).length})`,
    })),
  ];

  const stateOptions = [
    { value: 'all', label: `Everything (${counts.total})` },
    { value: 'installed', label: `Installed (${counts.installed})` },
    { value: 'available', label: `Not installed (${counts.available})` },
    { value: 'update', label: `Update available (${counts.updatable})` },
  ];

  const actions = (
    <>
      <SearchBox C={C} value={q} onChange={setQ} placeholder="Filter addons" />
      <FilterSelect
        C={C}
        value={tagFilter}
        onChange={setTagFilter}
        options={tagOptions}
        label="Filter by tag"
        icon={<FolderIcon size={14} stroke={C.textDim} />}
      />
      <FilterSelect
        C={C}
        value={stateFilter}
        onChange={v => setStateFilter(v as AddonState)}
        options={stateOptions}
        label="Filter by state"
      />
    </>
  );

  /** Registries that answered with nothing usable, named with the reason. */
  const registryTrouble = failed.length > 0 && (
    <div style={{ marginBottom: '20px' }}>
      <Notice
        C={C}
        title={
          reachable === 0
            ? 'No registry could be read'
            : `${failed.length} of ${catalog.results.length} registries could not be read`
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {failed.map(result => (
            <div key={result.registry.name}>
              <Chip C={C}>{result.registry.name}</Chip>{' '}
              <span style={{ fontSize: '12px' }}>{result.error}</span>
            </div>
          ))}
        </div>
      </Notice>
    </div>
  );

  let body: React.ReactNode;
  if (noRegistryConfig) {
    body = (
      <Notice C={C} title="KubeVela is not installed on this cluster">
        There is no <Code>{REGISTRY_CONFIGMAP}</Code> in <Code>{DEFINITION_NAMESPACE}</Code>, which
        is where KubeVela records the catalogs it installs addons from. Install KubeVela and its
        registries appear here.
      </Notice>
    );
  } else if (registryForbidden) {
    body = (
      <Notice C={C} title="Not allowed to read the addon registries">
        This page needs to read the <Code>{REGISTRY_CONFIGMAP}</Code> ConfigMap in{' '}
        <Code>{DEFINITION_NAMESPACE}</Code>.
      </Notice>
    );
  } else if (catalog.loading) {
    body = (
      <Notice C={C} busy title="Fetching the catalog">
        Reading the addon index published by{' '}
        {registries.length === 1 ? registries[0].name : `${registries.length} registries`}.
      </Notice>
    );
  } else if (registries.length === 0) {
    body = (
      <Notice C={C} title="No addon registries are configured">
        KubeVela is installed, but <Code>{REGISTRY_CONFIGMAP}</Code> lists no catalog to install
        addons from.
      </Notice>
    );
  } else if (addons.length === 0) {
    body = (
      <>
        {registryTrouble}
        {failed.length === 0 && (
          <Notice C={C} title="The registries published no addons">
            Every configured registry answered, and none of them lists an addon.
          </Notice>
        )}
      </>
    );
  } else {
    body = (
      <>
        {registryTrouble}
        <StatGrid
          C={C}
          min="220px"
          stats={[
            {
              label: 'Addons',
              value: addons.length,
              // The ring measures the registries, not the addons: how much of
              // the configured catalog this page actually managed to read is
              // the caveat that belongs on the total, and there is no whole for
              // a catalog size to be a part of.
              sub: `${reachable} of ${registries.length} ${
                registries.length === 1 ? 'registry' : 'registries'
              }`,
              ratio: { value: reachable, total: registries.length, of: 'registries read' },
            },
            {
              label: 'Installed',
              value: counts.installed,
              sub: counts.unlisted ? `${counts.unlisted} not in a catalog` : 'on this cluster',
              tone: counts.installed ? C.healthy : undefined,
              ratio: { value: counts.installed, total: counts.total, of: 'installed' },
            },
            {
              label: 'Available',
              value: counts.available,
              sub: 'not installed here',
              ratio: { value: counts.available, total: counts.total, of: 'not installed' },
            },
            {
              label: 'Updates',
              value: counts.updatable,
              sub: counts.updatable ? 'newer version published' : 'all current',
              tone: counts.updatable ? C.gold : undefined,
              // Against what is installed, not against the whole catalog: an
              // addon this cluster does not have cannot be out of date.
              ratio: {
                value: counts.updatable,
                total: counts.installed,
                of: 'installed and behind',
              },
            },
            // No ring: a tag count is a grand total with nothing to be a part of.
            { label: 'Tags', value: tags.length, sub: 'across the catalog' },
          ]}
        />

        <section style={{ marginTop: '26px' }}>
          <SectionHeading C={C} label="Catalog" count={shown.length} />
          {shown.length === 0 ? (
            <div
              style={{
                padding: '22px',
                border: `1px dashed ${C.border}`,
                borderRadius: '10px',
                background: C.surfaceSunken,
                fontSize: '12.5px',
                color: C.textMuted,
                textAlign: 'center',
              }}
            >
              No addons match the current filters.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))',
                gap: '12px',
              }}
            >
              {shown.map(addon => (
                <AddonCard
                  key={addon.key}
                  C={C}
                  addon={addon}
                  onOpen={panelViable ? () => setSelectedKey(addon.key) : undefined}
                />
              ))}
            </div>
          )}
        </section>
      </>
    );
  }

  return (
    <EvoPage section="KubeVela" title="Addons" summary={summary} actions={actions}>
      {body}

      <SidePanel
        C={C}
        open={!!selected}
        title={selected?.name ?? ''}
        subtitle={selected && (selected.registry ?? 'installed, not in a catalog')}
        onClose={() => setSelectedKey(null)}
      >
        {selected && (
          <div style={{ padding: '16px' }}>
            <AddonDetail C={C} addon={selected} />
          </div>
        )}
      </SidePanel>
    </EvoPage>
  );
}
