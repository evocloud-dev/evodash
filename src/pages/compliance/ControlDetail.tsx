/**
 * One Kubescape control in the side panel: how it scores here, what it checks,
 * how to fix it, and which resources fail it.
 *
 * Everything comes from the scan already read for the page plus the rule
 * library's own text (k8s/kubescapeControlDocs.ts), so opening a control makes
 * no request of its own.
 */
import React from 'react';
import { ControlScore } from '../../k8s/kubescape';
import { KUBESCAPE_CONTROL_DOCS } from '../../k8s/kubescapeControlDocs';
import { KUBESCAPE_CONTROLS, KUBESCAPE_FRAMEWORKS } from '../../k8s/kubescapeFrameworks';
import { isSystemNamespace } from '../../k8s/namespaces';
import { EvoCloudPalette } from '../../palette';
import { Chip, KeyValues, MONO, Pill } from '../../ui/chrome';
import { Caption, ResourceChip, severityTone, SystemMark } from './shared';
import { scoreColor } from './useScanResults';

const CLUSTER_SCOPED = 'Cluster-scoped';

function Section({
  C,
  title,
  children,
}: {
  C: EvoCloudPalette;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <Caption C={C}>{title}</Caption>
      {children}
    </section>
  );
}

function Prose({ C, children }: { C: EvoCloudPalette; children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: '12.5px',
        lineHeight: 1.6,
        color: C.textMuted,
        whiteSpace: 'pre-wrap',
      }}
    >
      {children}
    </p>
  );
}

/** The failing resources by namespace, workload namespaces first, cluster-scoped last. */
function byNamespace(failing: ControlScore['failing']) {
  const groups = new Map<string, ControlScore['failing']>();
  for (const f of failing) {
    const ns = f.resource.namespace ?? CLUSTER_SCOPED;
    groups.set(ns, [...(groups.get(ns) ?? []), f]);
  }
  const rank = (ns: string) => (ns === CLUSTER_SCOPED ? 2 : isSystemNamespace(ns) ? 1 : 0);
  return [...groups].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
}

export function ControlDetail({
  C,
  control,
  frameworkLabel,
}: {
  C: EvoCloudPalette;
  control: ControlScore;
  /** The framework the control was opened from. */
  frameworkLabel: string;
}) {
  const doc = KUBESCAPE_CONTROL_DOCS[control.controlID] ?? {};
  const meta = KUBESCAPE_CONTROLS[control.controlID];
  const tone = severityTone(C, control.severity);
  const evaluated = control.evaluated > 0;
  const excepted = control.failing.filter(f => f.excepted).length;
  const frameworks = KUBESCAPE_FRAMEWORKS.filter(f => f.controlIDs.includes(control.controlID));
  const groups = byNamespace(control.failing);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
        <Pill fg={tone.fg} bg={tone.bg} border={tone.border}>
          {control.severity}
        </Pill>
        <Chip C={C} title={control.category ?? 'No category'}>
          {control.category ?? 'Uncategorised'}
        </Chip>
        {evaluated ? (
          <Pill
            fg={scoreColor(C, control.score)}
            bg={C.chip}
            border={C.border}
            title={`Passed on ${control.passed} of the ${control.evaluated} resources it checked`}
          >
            {Math.round(control.score)}% compliant
          </Pill>
        ) : (
          <Pill
            fg={C.textDimmer}
            bg={C.chip}
            border={C.border}
            title="Nothing on this cluster for this control to check"
          >
            not evaluated
          </Pill>
        )}
      </div>

      <KeyValues
        C={C}
        rows={[
          {
            k: 'checked',
            v: evaluated ? `${control.evaluated} resources` : 'nothing to check here',
          },
          { k: 'passed', v: control.passed, color: control.passed ? C.healthy : undefined },
          { k: 'failing', v: control.failed, color: control.failed ? C.danger : undefined },
          ...(control.failed
            ? [
                {
                  k: 'excepted',
                  v: excepted
                    ? `${excepted} of the ${control.failed} failures have a posture exception`
                    : 'none',
                },
              ]
            : []),
          ...(meta ? [{ k: 'base score', v: `${meta.baseScore} / 10` }] : []),
          { k: 'opened from', v: frameworkLabel },
        ]}
      />

      {doc.description && (
        <Section C={C} title="What it checks">
          <Prose C={C}>{doc.description}</Prose>
        </Section>
      )}
      {doc.test && (
        <Section C={C} title="How it's tested">
          <Prose C={C}>{doc.test}</Prose>
        </Section>
      )}
      {doc.remediation && (
        <Section C={C} title="How to fix it">
          <Prose C={C}>{doc.remediation}</Prose>
        </Section>
      )}

      {frameworks.length > 0 && (
        <Section C={C} title="In frameworks">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {frameworks.map(f => (
              <Chip key={f.name} C={C} title={f.description}>
                {f.label}
              </Chip>
            ))}
          </div>
        </Section>
      )}

      <Section C={C} title={`Failing resources (${control.failed})`}>
        {control.failed === 0 ? (
          <Prose C={C}>
            {evaluated
              ? `Every one of the ${control.evaluated} resources it checked passed.`
              : 'Kubescape found nothing on this cluster for this control to check.'}
          </Prose>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {groups.map(([ns, items]) => (
              <div key={ns} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontFamily: MONO, fontSize: '11.5px', color: C.textMuted }}>
                    {ns}
                  </span>
                  {ns !== CLUSTER_SCOPED && isSystemNamespace(ns) && <SystemMark C={C} />}
                  <span style={{ fontSize: '11px', color: C.textDimmer }}>{items.length}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {items.map(({ resource, excepted: isExcepted }) => (
                    <span
                      key={resource.key}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <ResourceChip
                        C={C}
                        resource={resource}
                        title={
                          isExcepted ? 'Failed, with a posture exception filed for it' : undefined
                        }
                      />
                      {isExcepted && (
                        <Pill fg={C.gold} bg={C.goldSoft} border={C.goldBorder}>
                          excepted
                        </Pill>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {doc.references && doc.references.length > 0 && (
        <Section C={C} title="References">
          <ul
            style={{
              margin: 0,
              paddingLeft: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            {doc.references.map(ref => (
              <li
                key={ref}
                style={{ fontSize: '12px', color: C.textMuted, wordBreak: 'break-all' }}
              >
                {/^https?:\/\//.test(ref) ? (
                  <a href={ref} target="_blank" rel="noreferrer noopener" style={{ color: C.link }}>
                    {ref}
                  </a>
                ) : (
                  ref
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
