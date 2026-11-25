/**
 * Bring a section into view after a click swaps what it shows.
 *
 * Several pages pick what a list below them shows from cards or tabs above
 * it: a framework on Security Benchmark, a section on Cluster Health, by
 * policy or by resource on Kyverno Policies. The cards sit above the fold and
 * the list below it, so without this the click changes something off screen
 * and appears to do nothing.
 *
 * It only scrolls when the section's top is out of comfortable reach. A
 * section whose heading already sits in the upper part of the view stays put,
 * so a tab beside the heading does not jolt the page under the pointer.
 */
import React from 'react';

/** How far down the view a section's top may sit and still count as in view. */
const COMFORT = 0.35;

/**
 * Whether a section whose top is at `top` needs scrolling to, in a scroll
 * area whose visible part runs from `viewTop` for `viewHeight` pixels.
 */
export function needsReveal(top: number, viewTop: number, viewHeight: number): boolean {
  return top < viewTop || top > viewTop + viewHeight * COMFORT;
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = window.getComputedStyle(p);
    if ((overflowY === 'auto' || overflowY === 'scroll') && p.scrollHeight > p.clientHeight) {
      return p;
    }
  }
  return null;
}

export function revealSection(el: HTMLElement | null) {
  if (!el) return;
  // Two frames: the first lets React commit the swapped content, the second
  // measures the layout it produced.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const parent = scrollParent(el);
      const view = parent ? parent.getBoundingClientRect() : { top: 0, height: window.innerHeight };
      if (!needsReveal(el.getBoundingClientRect().top, view.top, view.height)) return;
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    })
  );
}

/**
 * A ref for the section and a function to bring it into view. Give the
 * section `scrollMarginTop` so its heading does not land flush against the
 * edge.
 */
export function useRevealSection<T extends HTMLElement = HTMLDivElement>() {
  const ref = React.useRef<T>(null);
  const reveal = React.useCallback(() => revealSection(ref.current), []);
  return [ref, reveal] as const;
}

/** The margin every revealed section keeps above it. */
export const REVEAL_MARGIN: React.CSSProperties = { scrollMarginTop: '16px' };
