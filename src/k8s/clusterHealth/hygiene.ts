/*
 * Ported from the KubeBuddy Headlamp plugin
 * (https://github.com/KubeDeckio/KubeBuddy, headlamp-plugin, checks from v0.0.38).
 *
 * MIT License. Copyright (c) 2025 Richard Hooper.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export function isBuiltInNamespace(name: string): boolean {
  return ['default', 'kube-system', 'kube-public', 'kube-node-lease'].includes(name);
}

export function podContainers<T>(spec: {
  containers?: T[];
  initContainers?: T[];
  ephemeralContainers?: T[];
}): T[] {
  return [
    ...(spec.containers || []),
    ...(spec.initContainers || []),
    ...(spec.ephemeralContainers || []),
  ];
}

export function isSystemIsolationTaint(
  taint: { key?: string; value?: string; effect?: string },
  labels: Record<string, unknown>
): boolean {
  const mode = labels['kubernetes.azure.com/mode'];
  return (
    typeof mode === 'string' &&
    mode.toLowerCase() === 'system' &&
    taint.key === 'CriticalAddonsOnly' &&
    taint.value === 'true' &&
    taint.effect === 'NoSchedule'
  );
}

type SecurityContext = { runAsUser?: unknown; runAsNonRoot?: boolean };

export function rootUserIssue(
  container: SecurityContext = {},
  pod: SecurityContext = {}
): string | null {
  const user = container.runAsUser ?? pod.runAsUser;
  if (user !== undefined && user !== null) {
    return Number(user) === 0 ? 'runs as UID 0' : null;
  }
  if ((container.runAsNonRoot ?? pod.runAsNonRoot) === true) {
    return null;
  }
  return 'has no explicit runAsUser or runAsNonRoot guarantee; verify the image user';
}
