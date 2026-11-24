import { describe, expect, it } from 'vitest';
import { KUBESCAPE_CONTROL_DOCS } from './kubescapeControlDocs';
import { KUBESCAPE_FRAMEWORKS } from './kubescapeFrameworks';

describe('Kubescape control docs', () => {
  it('describes every control a framework lists, and says how to fix it', () => {
    const ids = [...new Set(KUBESCAPE_FRAMEWORKS.flatMap(f => f.controlIDs))];
    const undescribed = ids.filter(id => !KUBESCAPE_CONTROL_DOCS[id]?.description);
    const unfixable = ids.filter(id => !KUBESCAPE_CONTROL_DOCS[id]?.remediation);
    expect(undescribed).toEqual([]);
    expect(unfixable).toEqual([]);
  });

  it('keeps no empty references', () => {
    const empty = Object.entries(KUBESCAPE_CONTROL_DOCS).filter(
      ([, doc]) => doc.references && (doc.references.length === 0 || doc.references.some(r => !r))
    );
    expect(empty).toEqual([]);
  });
});
