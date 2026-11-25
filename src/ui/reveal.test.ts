import { describe, expect, it } from 'vitest';
import { needsReveal } from './reveal';

describe('needsReveal', () => {
  // A scroll area 1000px tall whose visible part starts 64px down (under the app bar).
  const viewTop = 64;
  const height = 1000;

  it('leaves a section alone when its top is in the upper part of the view', () => {
    expect(needsReveal(64, viewTop, height)).toBe(false);
    expect(needsReveal(300, viewTop, height)).toBe(false);
  });

  it('scrolls to a section that starts low in the view or below it', () => {
    expect(needsReveal(700, viewTop, height)).toBe(true);
    expect(needsReveal(2400, viewTop, height)).toBe(true);
  });

  it('scrolls to a section whose top has scrolled away above', () => {
    expect(needsReveal(-200, viewTop, height)).toBe(true);
  });
});
