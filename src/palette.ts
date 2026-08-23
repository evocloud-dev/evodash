/**
 * EvoCloud palette.
 *
 * Single source of truth for both the Headlamp app themes (themes.ts) and the
 * plugin's own pages (pages/AppEndpoints.tsx), so the two cannot drift.
 *
 * The dark set is the palette from the Forecastle catalog design, unchanged.
 * The light set is its counterpart, built role-for-role rather than by
 * inverting: the neutrals keep the same blue bias toward the brand's midnight
 * navy, and the accents are re-picked for a light ground instead of reused.
 */

export interface EvoCloudPalette {
  /** Page ground. */
  bg: string;
  /** Cards, panels, raised surfaces. */
  surface: string;
  /** A card under the pointer. */
  surfaceHover: string;
  /** A table row under the pointer. */
  rowHover: string;
  /** Card footers and table headers — one step back from `surface`. */
  surfaceSunken: string;
  /** Expanded detail panels — the furthest back. */
  surfaceDeep: string;
  /** Inputs, selects, buttons at rest. */
  control: string;
  /** Those same controls, hovered or pressed. */
  controlActive: string;
  /** Small inline labels: namespaces, counts. */
  chip: string;
  /** Avatar and monogram tiles. */
  tile: string;
  tileBorder: string;
  /**
   * Selected segment in a segmented control. A gold wash, because the icon on
   * it is gold — same content-on-tint pairing as the restricted badge and the
   * Internal pill, rather than gold sitting on a neutral or on blue.
   */
  segActive: string;
  border: string;
  borderHover: string;
  divider: string;
  dividerSoft: string;
  text: string;
  /** Values in key/value pairs — a touch softer than `text`. */
  textValue: string;
  textMuted: string;
  textDim: string;
  textDimmer: string;
  textFaint: string;
  /** Brand blue, tuned to the ground it sits on. */
  brand: string;
  brandSoft: string;
  brandBorder: string;
  /** Solid brand-blue wash for selected navigation rows. */
  brandSelected: string;
  /**
   * The tone for pills that classify rather than warn — a scope, a field type,
   * a count, a required marker.
   *
   * Gold on dark and blue on light, which is the brand accent that carries on
   * each ground rather than a fixed hue. These labels already say what they
   * mean in words, so the colour is not doing semantic work and is free to be
   * the theme's own; the pills that genuinely signal state (healthy, danger,
   * restricted, warn) keep their fixed meaning and do not use this.
   */
  accent: string;
  accentSoft: string;
  accentBorder: string;
  link: string;
  linkHover: string;
  /**
   * Brand gold as text, an icon stroke, or a status dot.
   *
   * On dark this is the brand value. On light it is deepened to #B8860B: the
   * brand #F7B500 sits at about 1.9:1 on a white ground, so a 6px status dot or
   * a 1.9px icon stroke in it is close to invisible. #B8860B holds ~3.3:1 — the
   * WCAG floor for graphics — while still reading as gold rather than brown.
   */
  gold: string;
  /**
   * The brand gold itself, for solid fills and tinted areas where the gold is
   * the surface rather than the mark on it. Never darkened.
   */
  goldFill: string;
  goldSoft: string;
  goldBorder: string;
  healthy: string;
  healthySoft: string;
  healthyBorder: string;
  danger: string;
}

/** Lifted verbatim from the Forecastle catalog design. */
export const EVOCLOUD_DARK: EvoCloudPalette = {
  bg: '#0a0d16',
  surface: '#111624',
  surfaceHover: '#141a2c',
  rowHover: '#141a2b',
  surfaceSunken: '#0d1120',
  surfaceDeep: '#0b0f1c',
  control: '#121728',
  controlActive: '#1c2540',
  chip: '#141a2b',
  tile: '#1e2433',
  tileBorder: '#28314a',
  segActive: 'rgba(247,181,0,0.18)',
  border: '#1e2740',
  borderHover: '#33436e',
  divider: '#192034',
  dividerSoft: '#151b2c',
  text: '#e8ecf5',
  textValue: '#d5dae6',
  textMuted: '#8a94ab',
  textDim: '#7b859c',
  textDimmer: '#6a7488',
  textFaint: '#5b6479',
  brand: '#3B68FF',
  brandSoft: 'rgba(59,104,255,0.12)',
  brandBorder: 'rgba(59,104,255,0.34)',
  brandSelected: '#1b2a55',
  // Gold on the dark ground.
  accent: '#F7B500',
  accentSoft: 'rgba(247,181,0,0.12)',
  accentBorder: 'rgba(247,181,0,0.32)',
  link: '#7FB2FF',
  linkHover: '#A6CBFF',
  gold: '#F7B500',
  goldFill: '#F7B500',
  goldSoft: 'rgba(247,181,0,0.12)',
  goldBorder: 'rgba(247,181,0,0.32)',
  healthy: '#3fbf80',
  healthySoft: 'rgba(63,191,128,0.1)',
  healthyBorder: 'rgba(63,191,128,0.26)',
  danger: '#ef5f5f',
};

export const EVOCLOUD_LIGHT: EvoCloudPalette = {
  bg: '#f4f6fc',
  surface: '#ffffff',
  // Dark lifts a hovered card toward the light; light has no headroom above
  // white, so it settles very slightly instead. Same intent, opposite direction.
  surfaceHover: '#f8faff',
  rowHover: '#f2f5fc',
  surfaceSunken: '#eef1f9',
  surfaceDeep: '#e9edf7',
  control: '#ffffff',
  controlActive: '#e4e9f6',
  chip: '#eef1f9',
  tile: '#eaeef8',
  tileBorder: '#d3dbee',
  segActive: 'rgba(247,181,0,0.3)',
  border: '#dce1ee',
  borderHover: '#b9c3dd',
  divider: '#e4e8f2',
  dividerSoft: '#edf0f7',
  // The ramp mirrors the dark set's contrast ratios against its own ground
  // rather than its hex distances — roughly 16:1, 6.4:1, 5:1, 3.9:1, 3:1 — so
  // the two themes recede at the same rate.
  text: '#10162b',
  textValue: '#2b3448',
  textMuted: '#55607a',
  textDim: '#647089',
  textDimmer: '#757f97',
  textFaint: '#8a93a8',
  // The primary brand blue, not the dark-ground #3B68FF, which washes out here.
  brand: '#204CEB',
  brandSoft: 'rgba(32,76,235,0.09)',
  brandBorder: 'rgba(32,76,235,0.28)',
  brandSelected: '#e6ecfd',
  // Blue on the light ground — the same brand values the rest of this set uses,
  // not a lightened gold, which is where a shared hue would have gone muddy.
  accent: '#204CEB',
  accentSoft: 'rgba(32,76,235,0.09)',
  accentBorder: 'rgba(32,76,235,0.28)',
  link: '#1B45D8',
  linkHover: '#0f31a8',
  gold: '#B8860B',
  goldFill: '#F7B500',
  // Carried at roughly double the dark theme's opacity. A gold wash has to work
  // against white rather than against near-black, so the same alpha that reads
  // as a clear tint on dark all but disappears here.
  goldSoft: 'rgba(247,181,0,0.22)',
  goldBorder: 'rgba(198,150,0,0.5)',
  healthy: '#1c7f50',
  healthySoft: 'rgba(28,127,80,0.1)',
  healthyBorder: 'rgba(28,127,80,0.26)',
  danger: '#c33636',
};
