/**
 * Compliance Policies — which of the platform's Kyverno policies the cluster's
 * resources pass and fail.
 *
 * The other half of Compliance from the Frameworks page, and kept apart from it
 * because it answers a different question. Kubescape asks how the cluster
 * would fare against a framework someone else wrote; Kyverno reports on the
 * rules this platform adopted, and whether it blocks violations or only
 * records them. The two also behave differently: Kubescape's results are a
 * snapshot read on request, Kyverno's are watched and move as it writes them.
 *
 * Top to bottom: whether Kyverno is running at all, the totals, where in the
 * cluster the failures sit, then the results themselves — by policy, or turned
 * inside out by resource. Workload and system namespaces are kept apart
 * throughout, because the platform's own components fail Pod Security by
 * design and would otherwise drown out the failures someone can act on.
 *
 * The install commands mirror EvoCloud's own Kyverno roles: the kyverno chart
 * as `kyverno-operator`, then kyverno-policies at the baseline Pod Security
 * Standard with medium severity.
 *
 * This file is composition only. Scoring is in k8s/kyverno.ts, reading it in
 * compliance/useKyverno.ts and useKyvernoEngine.ts, and the parts in the
 * compliance/ folder beside them.
 */

import React from 'react';
import { readyToEnforce, ResourceFailures, totalChecks } from '../k8s/kyverno';
import { EvoCloudPalette } from '../palette';
import {
  Code,
  EvoPage,
  FilterSelect,
  FolderIcon,
  LiveBadge,
  Notice,
  SearchBox,
  SectionHeading,
  SidePanel,
  Stat,
  StatGrid,
  usePalette,
  useSidePanelViable,
} from '../ui/chrome';
import { ListToolbar, ListView, useListView } from '../ui/listView';
import { REVEAL_MARGIN, useRevealSection } from '../ui/reveal';
import { EngineStrip } from './compliance/EngineStrip';
import { NamespacePanel } from './compliance/NamespacePanel';
import { PolicyCard } from './compliance/PolicyCard';
import { PolicyDetail } from './compliance/PolicyDetail';
import {
  matchesPolicy,
  matchesResource,
  POLICY_DEFAULT_SORT,
  POLICY_EXPORT_FIELDS,
  POLICY_GROUP_FIELDS,
  POLICY_SORT_FIELDS,
  policyMode,
  policyStatus,
  RESOURCE_DEFAULT_SORT,
  RESOURCE_EXPORT_FIELDS,
  RESOURCE_GROUP_FIELDS,
  RESOURCE_SORT_FIELDS,
  sortPolicies,
} from './compliance/policyFields';
import { PolicyTable } from './compliance/PolicyTable';
import { ResourceCard } from './compliance/ResourceCard';
import { ResourceDetail } from './compliance/ResourceDetail';
import { ResourceTable } from './compliance/ResourceTable';
import { InstallStep, InstallSteps, Segmented } from './compliance/shared';
import { useKyverno } from './compliance/useKyverno';
import { useKyvernoEngine } from './compliance/useKyvernoEngine';

const KYVERNO_INSTALL_DOCS = 'https://kyverno.io/docs/installation/';

const INSTALL_KYVERNO: InstallStep = {
  label: 'Install Kyverno',
  command:
    'helm upgrade --install kyverno-operator oci://ghcr.io/kyverno/charts/kyverno ' +
    '--version 3.8.2 -n kyverno --create-namespace',
};

const INSTALL_POLICIES: InstallStep = {
  label: 'Add the baseline Pod Security policies',
  command:
    'helm upgrade --install kyverno-policies oci://ghcr.io/kyverno/charts/kyverno-policies ' +
    '--version 3.8.2 -n kyverno --set podSecurityStandard=baseline --set podSecuritySeverity=medium',
};

type View = 'policy' | 'resource';

/** What the side panel shows: a policy or a failing resource, by key. */
type PanelTarget = { type: 'policy'; key: string } | { type: 'resource'; key: string } | null;

/** The by-resource filter: everything, one side of the split, or one namespace. */
type Scope = 'all' | 'workloads' | 'system' | `ns:${string}`;

function inScope(entry: ResourceFailures, scope: Scope): boolean {
  if (scope === 'all') return true;
  if (scope === 'workloads') return !entry.system;
  if (scope === 'system') return entry.system;
  return (entry.resource.namespace ?? '') === scope.slice(3);
}

/** A line of explanation under the tiles, quieter than a full notice. */
function Note({ C, children }: { C: EvoCloudPalette; children: React.ReactNode }) {
  return (
    <div
      style={{
        marginBottom: '20px',
        padding: '12px 14px',
        border: `1px dashed ${C.border}`,
        borderRadius: '10px',
        background: C.surfaceSunken,
        fontSize: '12.5px',
        color: C.textMuted,
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  );
}

const CARD_GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: '12px',
};

const STATUS_LABEL = { failing: 'Failing', passing: 'Passing', unevaluated: 'Not evaluated' };

/**
 * A list's rows under their group headings, or as one block when grouping is
 * off. Each group draws itself with `render`, as cards or as a table.
 */
function Grouped<R>({
  C,
  list,
  render,
}: {
  C: EvoCloudPalette;
  list: ListView<R>;
  render: (rows: R[]) => React.ReactNode;
}) {
  const [closed, setClosed] = React.useState<Record<string, boolean>>({});
  if (!list.grouped) {
    return <>{render(list.sorted)}</>;
  }
  return (
    <>
      {list.groups.map(group => {
        const open = !closed[group.name];
        return (
          <section key={group.name} style={{ marginBottom: '22px' }}>
            <SectionHeading
              C={C}
              label={group.name}
              count={group.rows.length}
              open={open}
              onToggle={() => setClosed(c => ({ ...c, [group.name]: !c[group.name] }))}
            />
            {open && render(group.rows)}
          </section>
        );
      })}
    </>
  );
}

export default function CompliancePolicies() {
  const C = usePalette();
  const kyverno = useKyverno();
  const engine = useKyvernoEngine();
  const { phase, posture, reportsMissing, error } = kyverno;
  const { checks } = posture;

  const [view, setView] = React.useState<View>('policy');
  const [scope, setScope] = React.useState<Scope>('all');
  // Failing only by default, but every policy while nothing fails — an empty
  // table says less than the list. Followed until the filter is used: reports
  // can land after the policies, and a default fixed on the first render would
  // be decided before there was anything failing to show.
  const [statusChoice, setStatusChoice] = React.useState<string | null>(null);
  const [modeFilter, setModeFilter] = React.useState('all');
  const [policyQuery, setPolicyQuery] = React.useState('');
  const [resourceQuery, setResourceQuery] = React.useState('');
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [resultsRef, revealResults] = useRevealSection();
  /**
   * The item in the side panel, by key rather than by value, so the panel
   * re-reads the live posture on every render: results that move while it is
   * open update in place, and an item that disappears closes it.
   */
  const [panel, setPanel] = React.useState<PanelTarget>(null);
  const panelViable = useSidePanelViable();
  const closePanel = React.useCallback(() => setPanel(null), []);
  const openPolicy = panelViable
    ? (policy: { key: string }) => setPanel({ type: 'policy', key: policy.key })
    : undefined;
  const openResource = panelViable
    ? (entry: { resource: { key: string } }) =>
        setPanel({ type: 'resource', key: entry.resource.key })
    : undefined;
  const panelPolicy =
    panel?.type === 'policy' ? posture.policies.find(p => p.key === panel.key) ?? null : null;
  const panelResource =
    panel?.type === 'resource'
      ? posture.offenders.find(o => o.resource.key === panel.key) ?? null
      : null;
  const policyByRef = (ref: string) => {
    const policy = posture.policies.find(p => p.ref === ref);
    return policy ? () => setPanel({ type: 'policy', key: policy.key }) : null;
  };

  const declared = posture.policies.filter(p => p.kind);
  const enforcing = declared.filter(p => p.action === 'Enforce' || p.action === 'Mixed').length;
  const auditing = declared.filter(p => p.action === 'Audit').length;
  const ready = declared.filter(readyToEnforce).length;
  const excepted = declared.filter(p => p.exceptions.length > 0).length;
  const total = totalChecks(checks);
  const other = checks.warn + checks.error + checks.skip;

  const side = (system: boolean) =>
    posture.namespaces
      .filter(n => n.system === system)
      .reduce(
        (acc, n) => ({ resources: acc.resources + n.resources, failing: acc.failing + n.failing }),
        {
          resources: 0,
          failing: 0,
        }
      );
  const workloads = side(false);
  const system = side(true);

  const anyFailing = posture.policies.some(p => p.failed > 0);
  const statusFilter = statusChoice ?? (anyFailing ? 'failing' : 'all');
  // Through sortPolicies first, so "worst first" ties fall back to its order.
  const shownPolicies = React.useMemo(
    () =>
      sortPolicies(posture.policies).filter(p =>
        matchesPolicy(p, { query: policyQuery, status: statusFilter, mode: modeFilter })
      ),
    [posture.policies, policyQuery, statusFilter, modeFilter]
  );
  const shownOffenders = React.useMemo(
    () => posture.offenders.filter(o => inScope(o, scope) && matchesResource(o, resourceQuery)),
    [posture.offenders, scope, resourceQuery]
  );

  const policyList = useListView({
    id: 'kyverno-policies',
    rows: shownPolicies,
    sortFields: POLICY_SORT_FIELDS,
    groupFields: POLICY_GROUP_FIELDS,
    defaultSort: POLICY_DEFAULT_SORT,
    defaultView: 'list',
  });
  const resourceList = useListView({
    id: 'kyverno-resources',
    rows: shownOffenders,
    sortFields: RESOURCE_SORT_FIELDS,
    groupFields: RESOURCE_GROUP_FIELDS,
    defaultSort: RESOURCE_DEFAULT_SORT,
    defaultView: 'list',
  });

  const policyFiltering = !!policyQuery.trim() || statusFilter !== 'all' || modeFilter !== 'all';
  const resourceFiltering = !!resourceQuery.trim() || scope !== 'all';

  const showNamespace = (namespace: string | null) => {
    setView('resource');
    setScope(`ns:${namespace ?? ''}`);
    revealResults();
  };
  // By policy and By resource are two different lists: switching brings the new one into view.
  const switchView = (next: View) => {
    setView(next);
    revealResults();
  };

  let summary: React.ReactNode;
  if (phase === 'loading') {
    summary = 'Reading Kyverno policies and reports';
  } else if (phase === 'not-installed') {
    summary = 'Kyverno is not installed on this cluster';
  } else if (phase === 'ready') {
    summary = `${declared.length} Kyverno ${declared.length === 1 ? 'policy' : 'policies'} · ${
      posture.resources
    } resources checked`;
  } else {
    summary = 'Kyverno policies and policy reports';
  }

  const actions =
    phase === 'ready' ? (
      <LiveBadge
        C={C}
        fetching={kyverno.fetching}
        error={null}
        revision={kyverno.revision}
        what="Kyverno policies, policy reports and exceptions"
      />
    ) : null;

  let body: React.ReactNode;
  if (phase === 'loading') {
    body = <Notice C={C} title="Reading Kyverno policies and reports" busy />;
  } else if (phase === 'not-installed') {
    body = (
      <Notice C={C} title="Kyverno is not installed on this cluster">
        Kyverno checks resources against policies as they are admitted and writes what it found to
        policy reports, which this page scores. Install it and the baseline Pod Security policies
        the way EvoCloud does, and results appear within a minute or two.
        <InstallSteps C={C} steps={[INSTALL_KYVERNO, INSTALL_POLICIES]} />
        <a href={KYVERNO_INSTALL_DOCS} target="_blank" rel="noreferrer noopener">
          Kyverno installation guide ↗
        </a>
      </Notice>
    );
  } else if (phase === 'forbidden') {
    body = (
      <Notice C={C} title="Not allowed to read Kyverno's policies">
        Your account cannot list <Code>clusterpolicies</Code> or <Code>policyreports</Code> in this
        cluster.
      </Notice>
    );
  } else if (phase === 'error') {
    body = (
      <Notice C={C} title="Could not read Kyverno's policies">
        {error}
      </Notice>
    );
  } else if (posture.policies.length === 0) {
    body = (
      <>
        <EngineStrip C={C} engine={engine} />
        <Notice C={C} title="Kyverno has no policies yet">
          Kyverno is installed, but no <Code>ClusterPolicy</Code>, <Code>Policy</Code> or{' '}
          <Code>ValidatingPolicy</Code> exists, so there is nothing to check resources against.
          <InstallSteps C={C} steps={[INSTALL_POLICIES]} />
        </Notice>
      </>
    );
  } else {
    // Two rows of four, as on Frameworks: the policies and their results, then
    // where in the cluster the results fall.
    const policyStats: Stat[] = [
      {
        label: 'Policies',
        value: declared.length,
        sub: `${enforcing} enforcing · ${auditing} auditing`,
      },
      {
        label: 'Ready to enforce',
        value: ready,
        sub: auditing ? `of ${auditing} audit-only, no violations` : 'no audit-only policies',
        tone: ready ? C.healthy : undefined,
        ratio: auditing
          ? { value: ready, total: auditing, of: 'audit-only policies with no violations' }
          : undefined,
      },
      {
        label: 'Passed',
        value: checks.pass,
        sub: `of ${total} checks`,
        tone: checks.pass ? C.healthy : undefined,
        ratio: { value: checks.pass, total, of: 'checks passed' },
      },
      {
        label: 'Failed',
        value: checks.fail,
        sub: `across ${posture.failingResources} resources`,
        tone: checks.fail ? C.danger : total ? C.healthy : undefined,
        ratio: { value: checks.fail, total, of: 'checks failed' },
      },
    ];

    const whereStats: Stat[] = [
      {
        label: 'Resources',
        value: posture.resources,
        sub: `${posture.failingResources} failing a policy`,
        ratio: {
          value: posture.failingResources,
          total: posture.resources,
          of: 'resources failing a policy',
        },
      },
      {
        label: 'Workload namespaces',
        value: workloads.failing,
        sub: `failing of ${workloads.resources} resources`,
        tone: workloads.failing ? C.danger : workloads.resources ? C.healthy : undefined,
        ratio: {
          value: workloads.failing,
          total: workloads.resources,
          of: 'workload resources failing a policy',
        },
      },
      {
        label: 'System namespaces',
        value: system.failing,
        sub: `failing of ${system.resources} resources`,
        // Gold, not red: platform components failing Pod Security is expected.
        tone: system.failing ? C.gold : system.resources ? C.healthy : undefined,
        ratio: {
          value: system.failing,
          total: system.resources,
          of: 'system resources failing a policy',
        },
      },
      {
        label: 'Exceptions',
        value: posture.exceptions,
        sub: posture.exceptions
          ? `relaxing ${excepted} ${excepted === 1 ? 'policy' : 'policies'}`
          : 'none recorded',
      },
    ];
    // Only when there is something in it, so the usual rows stay four wide.
    if (other) {
      whereStats.push({
        label: 'Other results',
        value: other,
        sub: `${checks.warn} warn · ${checks.error} error · ${checks.skip} skip`,
        tone: checks.warn + checks.error ? C.gold : undefined,
      });
    }

    const namespaceOptions = posture.namespaces
      .filter(n => n.failing > 0)
      .map(n => ({
        value: `ns:${n.namespace ?? ''}`,
        label: `${n.namespace ?? 'cluster-scoped'} (${n.failing})`,
      }));
    const modeOptions = ['Enforce', 'Mixed', 'Audit', 'Unset', 'Reported']
      .map(mode => ({ mode, count: posture.policies.filter(p => policyMode(p) === mode).length }))
      .filter(m => m.count > 0)
      .map(m => ({ value: m.mode, label: `${m.mode} (${m.count})` }));
    const offenderCount = (filter: Scope) =>
      posture.offenders.filter(o => inScope(o, filter)).length;

    let empty = {
      title: 'Nothing here fails a Kyverno policy',
      body: 'Every resource in this selection passed every policy that checked it.',
    };
    if (resourceQuery.trim() && posture.offenders.length > 0) {
      empty = {
        title: 'No failing resource matches the search',
        body: 'Search looks at the kind, name and namespace, and the titles of the policies it fails.',
      };
    } else if (scope === 'workloads' && posture.offenders.length > 0) {
      empty = {
        title: 'No workload fails a Kyverno policy',
        body: 'Every failing resource is in a system namespace. Choose System namespaces to see them.',
      };
    }

    body = (
      <>
        <EngineStrip C={C} engine={engine} />
        <StatGrid C={C} min="230px" spacing="12px" stats={policyStats} />
        <StatGrid C={C} min="230px" stats={whereStats} />

        {reportsMissing ? (
          <Note C={C}>
            The policies are installed but the <Code>wgpolicyk8s.io</Code> report API is not
            answering, so there are no results to score. With EvoCloud&apos;s reports-server, check
            that it is running in the <Code>kyverno</Code> namespace.
          </Note>
        ) : total === 0 ? (
          <Note C={C}>
            Kyverno has not reported on any resource yet. Its reports controller writes results
            shortly after a policy is created, and again on every background scan.
          </Note>
        ) : null}

        {posture.namespaces.length > 0 && (
          <>
            <SectionHeading C={C} label="Namespaces" count={posture.namespaces.length} />
            <NamespacePanel C={C} namespaces={posture.namespaces} onSelect={showNamespace} />
          </>
        )}

        <div ref={resultsRef} style={REVEAL_MARGIN}>
          <SectionHeading
            C={C}
            label={view === 'policy' ? 'Kyverno policies' : 'Failing resources'}
            count={view === 'policy' ? shownPolicies.length : shownOffenders.length}
            right={
              <Segmented<View>
                C={C}
                label="Group results"
                value={view}
                onChange={switchView}
                options={[
                  { value: 'policy', label: 'By policy' },
                  { value: 'resource', label: 'By resource' },
                ]}
              />
            }
          />
          {view === 'policy' ? (
            <>
              <ListToolbar
                C={C}
                list={policyList}
                shown={shownPolicies.length}
                total={posture.policies.length}
                noun="policies"
                onClearFilters={
                  policyFiltering
                    ? () => {
                        setPolicyQuery('');
                        setStatusChoice('all');
                        setModeFilter('all');
                      }
                    : undefined
                }
                sortFields={POLICY_SORT_FIELDS}
                groupFields={POLICY_GROUP_FIELDS}
                exportFields={POLICY_EXPORT_FIELDS}
                exportName="Kyverno policies"
                filters={
                  <>
                    <SearchBox
                      C={C}
                      value={policyQuery}
                      onChange={setPolicyQuery}
                      placeholder="Filter policies"
                      width="200px"
                    />
                    <FilterSelect
                      C={C}
                      value={statusFilter}
                      onChange={setStatusChoice}
                      label="Filter policies by result"
                      options={[
                        { value: 'all', label: `Any result (${posture.policies.length})` },
                        ...(['failing', 'passing', 'unevaluated'] as const).map(status => ({
                          value: status,
                          label: `${STATUS_LABEL[status]} (${
                            posture.policies.filter(p => policyStatus(p) === status).length
                          })`,
                        })),
                      ]}
                    />
                    <FilterSelect
                      C={C}
                      value={modeFilter}
                      onChange={setModeFilter}
                      label="Filter policies by mode"
                      options={[{ value: 'all', label: 'Any mode' }, ...modeOptions]}
                    />
                  </>
                }
              />
              {shownPolicies.length === 0 ? (
                statusFilter === 'failing' && !policyQuery.trim() && modeFilter === 'all' ? (
                  <Notice C={C} title="No Kyverno policy is failing">
                    Every policy passed on every resource it checked.
                  </Notice>
                ) : (
                  <Notice C={C} title="No policy matches the current filters">
                    Clear the filters to see every policy.
                  </Notice>
                )
              ) : (
                <Grouped
                  C={C}
                  list={policyList}
                  render={rows =>
                    policyList.view === 'grid' ? (
                      <div style={CARD_GRID}>
                        {rows.map(policy => (
                          <PolicyCard
                            key={policy.key}
                            C={C}
                            policy={policy}
                            expanded={!!expanded[policy.key]}
                            onToggle={() =>
                              setExpanded(e => ({ ...e, [policy.key]: !e[policy.key] }))
                            }
                            onOpen={openPolicy ? () => openPolicy(policy) : undefined}
                          />
                        ))}
                      </div>
                    ) : (
                      <PolicyTable
                        C={C}
                        policies={rows}
                        sort={policyList.sort}
                        onSort={policyList.sortBy}
                        onOpen={openPolicy}
                      />
                    )
                  }
                />
              )}
            </>
          ) : (
            <>
              <ListToolbar
                C={C}
                list={resourceList}
                shown={shownOffenders.length}
                total={posture.offenders.length}
                noun="failing resources"
                onClearFilters={
                  resourceFiltering
                    ? () => {
                        setResourceQuery('');
                        setScope('all');
                      }
                    : undefined
                }
                sortFields={RESOURCE_SORT_FIELDS}
                groupFields={RESOURCE_GROUP_FIELDS}
                exportFields={RESOURCE_EXPORT_FIELDS}
                exportName="Kyverno failing resources"
                filters={
                  <>
                    <SearchBox
                      C={C}
                      value={resourceQuery}
                      onChange={setResourceQuery}
                      placeholder="Filter resources"
                      width="200px"
                    />
                    <FilterSelect
                      C={C}
                      value={scope}
                      onChange={v => setScope(v as Scope)}
                      label="Filter failing resources by namespace"
                      icon={<FolderIcon size={14} stroke={C.textDim} />}
                      options={[
                        { value: 'all', label: `All namespaces (${posture.offenders.length})` },
                        {
                          value: 'workloads',
                          label: `Workload namespaces (${offenderCount('workloads')})`,
                        },
                        {
                          value: 'system',
                          label: `System namespaces (${offenderCount('system')})`,
                        },
                        ...namespaceOptions,
                      ]}
                    />
                  </>
                }
              />
              {shownOffenders.length === 0 ? (
                <ResourceTable C={C} offenders={[]} empty={empty} />
              ) : (
                <Grouped
                  C={C}
                  list={resourceList}
                  render={rows =>
                    resourceList.view === 'grid' ? (
                      <div style={CARD_GRID}>
                        {rows.map(entry => (
                          <ResourceCard
                            key={entry.resource.key}
                            C={C}
                            entry={entry}
                            onOpen={openResource ? () => openResource(entry) : undefined}
                          />
                        ))}
                      </div>
                    ) : (
                      <ResourceTable
                        C={C}
                        offenders={rows}
                        empty={empty}
                        sort={resourceList.sort}
                        onSort={resourceList.sortBy}
                        onOpen={openResource}
                      />
                    )
                  }
                />
              )}
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <EvoPage section="Compliance" title="Kyverno Policies" summary={summary} actions={actions}>
      {body}

      <SidePanel
        C={C}
        open={!!(panelPolicy || panelResource)}
        title={panelPolicy?.meta.title ?? panelResource?.resource.name ?? ''}
        subtitle={
          panelPolicy
            ? panelPolicy.ref
            : panelResource
            ? `${panelResource.resource.kind} · ${
                panelResource.resource.namespace ?? 'cluster-scoped'
              }`
            : undefined
        }
        onClose={closePanel}
      >
        <div style={{ padding: '16px' }}>
          {panelPolicy && <PolicyDetail C={C} policy={panelPolicy} />}
          {panelResource && <ResourceDetail C={C} entry={panelResource} openPolicy={policyByRef} />}
        </div>
      </SidePanel>
    </EvoPage>
  );
}
