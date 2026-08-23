/**
 * Compliance and policy posture.
 *
 * Three layers, most specific first:
 *
 * 1. Kyverno policies — what the cluster is supposed to enforce.
 * 2. Policy reports — what actually passed and failed. These are the
 *    `wgpolicyk8s.io` shared report format rather than a Kyverno type, so the
 *    section fills for any engine that writes it.
 * 3. Admission control — the ValidatingWebhookConfigurations and
 *    MutatingWebhookConfigurations that are the mechanism underneath. This is
 *    core Kubernetes, so it renders on every cluster, including ones with no
 *    policy engine at all — which is itself the compliance answer for such a
 *    cluster, and more useful than an empty page.
 */
import MutatingWebhookConfiguration from '@kinvolk/headlamp-plugin/lib/lib/k8s/mutatingWebhookConfiguration';
import ValidatingWebhookConfiguration from '@kinvolk/headlamp-plugin/lib/lib/k8s/validatingWebhookConfiguration';
import { useTheme } from '@mui/material/styles';
import React from 'react';
import { Readiness, readiness, readyTone } from '../k8s/conditions';
import {
  addSummaries,
  ClusterPolicy,
  ClusterPolicyReport,
  EMPTY_SUMMARY,
  FailureAction,
  failureAction,
  matchedKinds,
  Policy,
  PolicyReport,
  reportScope,
  ReportSummary,
  reportSummary,
  ruleKinds,
} from '../k8s/kyverno';
import { EVOCLOUD_DARK, EVOCLOUD_LIGHT, EvoCloudPalette } from '../palette';
import {
  age,
  allNotFound,
  Chip,
  Code,
  Column,
  DataTable,
  Dot,
  EvoPage,
  FilterSelect,
  firstRealError,
  FolderIcon,
  ListQuery,
  LiveBadge,
  Mono,
  Notice,
  Pill,
  SearchBox,
  SectionHeading,
  StatGrid,
  useRevision,
} from '../ui/chrome';

interface PolicyRow {
  key: string;
  kind: 'ClusterPolicy' | 'Policy';
  name: string;
  ns: string;
  action: FailureAction;
  rules: number;
  ruleKinds: string[];
  appliesTo: string[];
  background: boolean;
  ready: Readiness;
  created?: string;
}

interface ReportRow {
  key: string;
  kind: 'PolicyReport' | 'ClusterPolicyReport';
  name: string;
  ns: string;
  scope: string;
  summary: ReportSummary;
  created?: string;
}

interface WebhookRow {
  key: string;
  kind: 'Validating' | 'Mutating';
  name: string;
  webhooks: number;
  failurePolicy: string;
  created?: string;
}

/** Enforcing is the strong claim, so only that gets the loud colour. */
function actionTone(C: EvoCloudPalette, action: FailureAction) {
  switch (action) {
    case 'Enforce':
      return { fg: C.healthy, bg: C.healthySoft, border: C.healthyBorder };
    case 'Audit':
      return { fg: C.gold, bg: C.goldSoft, border: C.goldBorder };
    case 'Mixed':
      return { fg: C.brand, bg: C.brandSoft, border: C.brandBorder };
    default:
      return { fg: C.textDimmer, bg: C.chip, border: C.border };
  }
}

export default function CompliancePolicies() {
  const [q, setQ] = React.useState('');
  const [actionFilter, setActionFilter] = React.useState('all');

  const isDark = useTheme().palette.mode === 'dark';
  const C = isDark ? EVOCLOUD_DARK : EVOCLOUD_LIGHT;

  const clusterPolicies = ClusterPolicy.useList() as unknown as ListQuery;
  const policies = Policy.useList() as unknown as ListQuery;
  const clusterReports = ClusterPolicyReport.useList() as unknown as ListQuery;
  const reports = PolicyReport.useList() as unknown as ListQuery;
  const validating = ValidatingWebhookConfiguration.useList() as unknown as ListQuery;
  const mutating = MutatingWebhookConfiguration.useList() as unknown as ListQuery;

  const engine = [clusterPolicies, policies];
  const reportQueries = [clusterReports, reports];
  const watched = [...engine, ...reportQueries, validating, mutating];

  const policyRows: PolicyRow[] = React.useMemo(() => {
    const build = (kind: 'ClusterPolicy' | 'Policy', query: ListQuery): PolicyRow[] =>
      (query.items ?? []).map((item: any) => {
        const json = item.jsonData ?? {};
        const ns = item.metadata?.namespace ?? '';
        return {
          key: item.metadata?.uid || `${kind}/${ns}/${item.metadata?.name}`,
          kind,
          name: item.metadata?.name ?? '',
          ns,
          action: failureAction(json),
          rules: (json.spec?.rules ?? []).length,
          ruleKinds: ruleKinds(json),
          appliesTo: matchedKinds(json),
          background: json.spec?.background !== false,
          ready: readiness(json),
          created: item.metadata?.creationTimestamp,
        };
      });
    return [...build('ClusterPolicy', clusterPolicies), ...build('Policy', policies)];
  }, [clusterPolicies.items, policies.items]);

  const reportRows: ReportRow[] = React.useMemo(() => {
    const build = (kind: 'PolicyReport' | 'ClusterPolicyReport', query: ListQuery): ReportRow[] =>
      (query.items ?? []).map((item: any) => {
        const json = item.jsonData ?? {};
        const ns = item.metadata?.namespace ?? '';
        return {
          key: item.metadata?.uid || `${kind}/${ns}/${item.metadata?.name}`,
          kind,
          name: item.metadata?.name ?? '',
          ns,
          scope: reportScope(json),
          summary: reportSummary(json),
          created: item.metadata?.creationTimestamp,
        };
      });
    return [...build('ClusterPolicyReport', clusterReports), ...build('PolicyReport', reports)];
  }, [clusterReports.items, reports.items]);

  const webhookRows: WebhookRow[] = React.useMemo(() => {
    const build = (kind: 'Validating' | 'Mutating', query: ListQuery): WebhookRow[] =>
      (query.items ?? []).map((item: any) => {
        const hooks: any[] = item.jsonData?.webhooks ?? [];
        // A configuration can mix Fail and Ignore across its webhooks; showing
        // every distinct value keeps that visible instead of picking the first.
        const policies = [...new Set(hooks.map(h => h.failurePolicy ?? 'Fail'))];
        return {
          key: item.metadata?.uid || `${kind}/${item.metadata?.name}`,
          kind,
          name: item.metadata?.name ?? '',
          webhooks: hooks.length,
          failurePolicy: policies.join(', ') || '—',
          created: item.metadata?.creationTimestamp,
        };
      });
    return [...build('Validating', validating), ...build('Mutating', mutating)];
  }, [validating.items, mutating.items]);

  const revision = useRevision(watched);
  const fetching = watched.some(x => x.isFetching);
  const loading = watched.every(x => x.isLoading);
  const engineMissing = allNotFound(engine);
  const reportsMissing = allNotFound(reportQueries);
  const hardError = firstRealError(watched);

  const totals = reportRows.reduce((acc, r) => addSummaries(acc, r.summary), EMPTY_SUMMARY);
  const enforcing = policyRows.filter(p => p.action === 'Enforce' || p.action === 'Mixed').length;
  const auditing = policyRows.filter(p => p.action === 'Audit').length;

  const query = q.trim().toLowerCase();
  const matchesPolicy = (p: PolicyRow) =>
    (!query || `${p.name} ${p.ns} ${p.kind} ${p.appliesTo.join(' ')}`.toLowerCase().includes(query)) &&
    (actionFilter === 'all' || p.action === actionFilter);
  const matchesReport = (r: ReportRow) =>
    !query || `${r.name} ${r.ns} ${r.scope} ${r.kind}`.toLowerCase().includes(query);
  const matchesWebhook = (w: WebhookRow) => !query || `${w.name} ${w.kind}`.toLowerCase().includes(query);

  const shownPolicies = policyRows.filter(matchesPolicy);
  const shownReports = reportRows.filter(matchesReport);
  const shownWebhooks = webhookRows.filter(matchesWebhook);
  const filtering = !!query || actionFilter !== 'all';

  let summary: React.ReactNode;
  if (loading) {
    summary = 'Reading policies and admission configuration from the cluster';
  } else if (filtering) {
    summary = `${shownPolicies.length + shownReports.length + shownWebhooks.length} of ${
      policyRows.length + reportRows.length + webhookRows.length
    } resources match`;
  } else if (engineMissing) {
    summary = `No policy engine installed · ${webhookRows.length} admission webhook configurations`;
  } else {
    summary = `${policyRows.length} policies · ${reportRows.length} reports · ${webhookRows.length} admission configurations`;
  }

  const actions = (
    <>
      <SearchBox C={C} value={q} onChange={setQ} placeholder="Filter policies" />
      <FilterSelect
        C={C}
        value={actionFilter}
        onChange={setActionFilter}
        options={[
          { value: 'all', label: 'Any action' },
          { value: 'Enforce', label: `Enforce (${policyRows.filter(p => p.action === 'Enforce').length})` },
          { value: 'Audit', label: `Audit (${policyRows.filter(p => p.action === 'Audit').length})` },
          { value: 'Mixed', label: `Mixed (${policyRows.filter(p => p.action === 'Mixed').length})` },
          { value: 'Unset', label: `Unset (${policyRows.filter(p => p.action === 'Unset').length})` },
        ]}
        label="Filter by failure action"
        icon={<FolderIcon size={14} stroke={C.textDim} />}
      />
      <LiveBadge
        C={C}
        fetching={fetching}
        error={hardError}
        revision={revision}
        what="policies, policy reports and admission webhooks"
      />
    </>
  );

  const policyColumns: Column<PolicyRow>[] = [
    {
      key: 'kind',
      label: 'Scope',
      width: 'minmax(112px, 126px)',
      render: p => (
        <Pill
          fg={C.brand}
          bg={C.brandSoft}
          border={C.brandBorder}
          title={p.kind === 'ClusterPolicy' ? 'Applies cluster-wide' : `Applies within ${p.ns}`}
        >
          {p.kind === 'ClusterPolicy' ? 'Cluster' : 'Namespaced'}
        </Pill>
      ),
    },
    {
      key: 'name',
      label: 'Policy',
      width: 'minmax(150px, 1.3fr)',
      render: p => (
        <span
          title={p.name}
          style={{ fontSize: '13.5px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}
        >
          {p.name}
        </span>
      ),
    },
    {
      key: 'ns',
      label: 'Namespace',
      width: 'minmax(100px, 0.8fr)',
      render: p => <Chip C={C} title={p.ns || 'cluster-scoped'}>{p.ns || '—'}</Chip>,
    },
    {
      key: 'action',
      label: 'On failure',
      width: 'minmax(92px, 104px)',
      render: p => {
        const tone = actionTone(C, p.action);
        return (
          <Pill
            {...tone}
            title={
              p.action === 'Mixed'
                ? 'Rules in this policy disagree: some enforce, some only audit.'
                : p.action === 'Unset'
                ? 'No failure action set on the policy or its rules.'
                : `Violations are ${p.action === 'Enforce' ? 'blocked at admission' : 'recorded but allowed'}.`
            }
          >
            {p.action}
          </Pill>
        );
      },
    },
    {
      key: 'rules',
      label: 'Rules',
      width: '64px',
      render: p => (
        <Mono C={C} title={p.ruleKinds.join(', ') || 'no typed rules'}>
          {p.rules}
        </Mono>
      ),
    },
    {
      key: 'applies',
      label: 'Applies to',
      width: 'minmax(140px, 1.4fr)',
      render: p => (
        <Mono C={C} title={p.appliesTo.join(', ') || 'Not restricted by kind'}>
          {p.appliesTo.length ? p.appliesTo.join(', ') : 'any kind'}
        </Mono>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: 'minmax(104px, 118px)',
      render: p => {
        const tone = readyTone(C, p.ready.state);
        return (
          <>
            <Dot color={tone.fg} title={p.ready.message ?? p.ready.label} />
            <Mono C={C} color={tone.fg} title={p.ready.message ?? p.ready.label}>
              {p.ready.label}
            </Mono>
          </>
        );
      },
    },
    {
      key: 'age',
      label: 'Age',
      width: '64px',
      align: 'right',
      render: p => (
        <Mono C={C} color={C.textDimmer} title={p.created}>
          {age(p.created)}
        </Mono>
      ),
    },
  ];

  const count = (n: number, color: string) => (
    <Mono C={C} color={n > 0 ? color : C.textDimmer}>
      {n}
    </Mono>
  );

  const reportColumns: Column<ReportRow>[] = [
    {
      key: 'name',
      label: 'Report',
      width: 'minmax(150px, 1.4fr)',
      render: r => (
        <span
          title={r.name}
          style={{ fontSize: '13.5px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}
        >
          {r.name}
        </span>
      ),
    },
    {
      key: 'ns',
      label: 'Namespace',
      width: 'minmax(100px, 0.8fr)',
      render: r => <Chip C={C} title={r.ns || 'cluster-scoped'}>{r.ns || '—'}</Chip>,
    },
    {
      key: 'scope',
      label: 'Subject',
      width: 'minmax(150px, 1.5fr)',
      render: r => (
        <Mono C={C} title={r.scope}>
          {r.scope}
        </Mono>
      ),
    },
    { key: 'pass', label: 'Pass', width: '64px', render: r => count(r.summary.pass, C.healthy) },
    { key: 'fail', label: 'Fail', width: '64px', render: r => count(r.summary.fail, C.danger) },
    { key: 'warn', label: 'Warn', width: '64px', render: r => count(r.summary.warn, C.gold) },
    { key: 'error', label: 'Error', width: '64px', render: r => count(r.summary.error, C.danger) },
    { key: 'skip', label: 'Skip', width: '64px', render: r => count(r.summary.skip, C.textMuted) },
    {
      key: 'age',
      label: 'Age',
      width: '64px',
      align: 'right',
      render: r => (
        <Mono C={C} color={C.textDimmer} title={r.created}>
          {age(r.created)}
        </Mono>
      ),
    },
  ];

  const webhookColumns: Column<WebhookRow>[] = [
    {
      key: 'kind',
      label: 'Type',
      width: 'minmax(104px, 118px)',
      render: w => (
        <Pill
          fg={w.kind === 'Validating' ? C.brand : C.gold}
          bg={w.kind === 'Validating' ? C.brandSoft : C.goldSoft}
          border={w.kind === 'Validating' ? C.brandBorder : C.goldBorder}
          title={w.kind === 'Validating' ? 'Can reject a request' : 'Can rewrite a request'}
        >
          {w.kind}
        </Pill>
      ),
    },
    {
      key: 'name',
      label: 'Configuration',
      width: 'minmax(200px, 2fr)',
      render: w => (
        <span
          title={w.name}
          style={{ fontSize: '13.5px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}
        >
          {w.name}
        </span>
      ),
    },
    { key: 'hooks', label: 'Webhooks', width: '88px', render: w => <Mono C={C}>{w.webhooks}</Mono> },
    {
      key: 'failure',
      label: 'On failure',
      width: 'minmax(110px, 140px)',
      render: w => (
        <Mono
          C={C}
          color={w.failurePolicy.includes('Fail') ? C.gold : C.textMuted}
          title={
            w.failurePolicy.includes('Fail')
              ? 'Requests are rejected when the webhook is unreachable.'
              : 'Requests are admitted when the webhook is unreachable.'
          }
        >
          {w.failurePolicy}
        </Mono>
      ),
    },
    {
      key: 'age',
      label: 'Age',
      width: '64px',
      align: 'right',
      render: w => (
        <Mono C={C} color={C.textDimmer} title={w.created}>
          {age(w.created)}
        </Mono>
      ),
    },
  ];

  const emptyBlock = (text: React.ReactNode) => (
    <div
      style={{
        padding: '22px',
        border: `1px dashed ${C.border}`,
        borderRadius: '10px',
        background: C.surfaceSunken,
        fontSize: '12.5px',
        color: C.textMuted,
        textAlign: 'center',
        lineHeight: 1.6,
      }}
    >
      {text}
    </div>
  );

  let body: React.ReactNode;
  if (loading) {
    body = <Notice C={C} title="Loading compliance data">Reading policies, reports and admission webhooks.</Notice>;
  } else if (hardError) {
    body = <Notice C={C} title="Could not load compliance data">{hardError.message || String(hardError)}</Notice>;
  } else {
    body = (
      <>
        <StatGrid
          C={C}
          stats={[
            {
              label: 'Policies',
              value: engineMissing ? '—' : policyRows.length,
              sub: engineMissing ? 'no engine' : `${enforcing} enforcing · ${auditing} auditing`,
            },
            {
              label: 'Passing',
              value: totals.pass,
              sub: 'results',
              tone: totals.pass ? C.healthy : undefined,
            },
            {
              label: 'Failing',
              value: totals.fail,
              sub: totals.fail ? 'violations' : 'none',
              tone: totals.fail ? C.danger : undefined,
            },
            {
              label: 'Warnings',
              value: totals.warn + totals.error,
              sub: 'warn + error',
              tone: totals.warn + totals.error ? C.gold : undefined,
            },
            {
              label: 'Admission',
              value: webhookRows.length,
              sub: `${webhookRows.filter(w => w.kind === 'Validating').length} validating · ${
                webhookRows.filter(w => w.kind === 'Mutating').length
              } mutating`,
            },
          ]}
        />

        <section style={{ marginBottom: '26px' }}>
          <SectionHeading C={C} label="Policies" count={engineMissing ? undefined : shownPolicies.length} />
          {engineMissing
            ? emptyBlock(
                <>
                  No <Code>kyverno.io</Code> resource definitions were found, so this cluster has no Kyverno policies to
                  report on. The admission configuration below is still read from core Kubernetes and shows what does
                  gate requests today.
                </>
              )
            : shownPolicies.length === 0
            ? emptyBlock(
                policyRows.length === 0 ? (
                  <>
                    Kyverno is installed and no <Code>ClusterPolicy</Code> or <Code>Policy</Code> exists yet.
                  </>
                ) : (
                  'No policies match the current filter.'
                )
              )
            : <DataTable C={C} columns={policyColumns} rows={shownPolicies} rowKey={p => p.key} />}
        </section>

        <section style={{ marginBottom: '26px' }}>
          <SectionHeading C={C} label="Policy reports" count={reportsMissing ? undefined : shownReports.length} />
          {reportsMissing
            ? emptyBlock(
                <>
                  No <Code>wgpolicyk8s.io</Code> report definitions were found. Any policy engine that writes the shared
                  PolicyReport format populates this table.
                </>
              )
            : shownReports.length === 0
            ? emptyBlock(
                reportRows.length === 0
                  ? 'No policy reports have been written yet. They appear once the engine has evaluated a resource.'
                  : 'No reports match the current filter.'
              )
            : <DataTable C={C} columns={reportColumns} rows={shownReports} rowKey={r => r.key} />}
        </section>

        <section style={{ marginBottom: '26px' }}>
          <SectionHeading C={C} label="Admission control" count={shownWebhooks.length} />
          {shownWebhooks.length === 0
            ? emptyBlock(
                webhookRows.length === 0
                  ? 'Nothing is registered to validate or mutate admission requests on this cluster.'
                  : 'No configurations match the current filter.'
              )
            : <DataTable C={C} columns={webhookColumns} rows={shownWebhooks} rowKey={w => w.key} />}
        </section>
      </>
    );
  }

  return (
    <EvoPage
      section="Compliance"
      title="Compliance Policies"
      summary={summary}
      actions={actions}
    >
      {body}
    </EvoPage>
  );
}
