/**
 * The page palette for whatever theme the user actually selected.
 *
 * The pages were built against the EvoCloud palette directly, which is right
 * while an EvoCloud theme is active and wrong the moment it is not: Headlamp's
 * chrome follows the selected theme, the page did not, and the two met at the
 * sidebar edge as two different products.
 *
 * So the neutrals — grounds, surfaces, borders, the text ramp — are derived from
 * the live MUI theme, and the accents are not. Brand blue, brand gold, the
 * healthy green and the danger red stay EvoCloud under every theme. They are
 * what the page means by "this is a link", "this is required", "this resolves",
 * and they are the part that is ours; the surfaces they sit on belong to
 * whatever theme is on.
 *
 * An EvoCloud theme still gets the hand-tuned set verbatim — see
 * {@link evoCloudThemeActive}. Nothing about those two themes is derived, so
 * nothing about them can drift.
 */
import type { Theme } from '@mui/material/styles';
import { alpha, darken, lighten } from '@mui/material/styles';
import { EVOCLOUD_DARK, EVOCLOUD_LIGHT, EvoCloudPalette } from '../palette';

/** Where Headlamp keeps the selected theme's name. */
const THEME_PREFERENCE_KEY = 'headlampThemePreference';

/**
 * True when one of this plugin's own themes is selected.
 *
 * Read from storage because the MUI theme does not carry its Headlamp name —
 * `createMuiTheme` builds a palette and drops the name on the floor, so there is
 * nowhere else to ask.
 *
 * Not reactive on its own. It does not need to be: every caller also reads the
 * MUI theme, so a theme change re-renders them and this is read again.
 */
export function evoCloudThemeActive(): boolean {
  try {
    return (window.localStorage.getItem(THEME_PREFERENCE_KEY) ?? '').startsWith('EvoCloud');
  } catch (e) {
    // Storage can be unavailable or blocked; the derived palette is the safe
    // answer, since it works on any theme including ours.
    return false;
  }
}

/**
 * Nudge a colour, in whichever direction reads as "raised" on this theme.
 *
 * Dark themes lift a hovered surface toward the light. Light themes have no
 * headroom above white, so they settle it instead — the same intent in the
 * opposite direction, which is the rule the hand-tuned light palette already
 * follows.
 *
 * Guarded because these throw on a colour format they cannot parse, and a theme
 * is free to hand us one. A hover state that fails to differ is a blemish; one
 * that throws takes the page down.
 */
function raise(theme: Theme, color: string, amount: number): string {
  try {
    return theme.palette.mode === 'dark' ? lighten(color, amount) : darken(color, amount);
  } catch (e) {
    return color;
  }
}

/** Push a colour back, away from the viewer. Darker on both light and dark. */
function sink(color: string, amount: number): string {
  try {
    return darken(color, amount);
  } catch (e) {
    return color;
  }
}

/** Text at a given opacity — borders and the muted ramp, on any ground. */
function inkOf(text: string, opacity: number): string {
  try {
    return alpha(text, opacity);
  } catch (e) {
    return text;
  }
}

/**
 * An EvoCloud palette whose neutrals come from `theme` and whose accents do not.
 *
 * Borders and dimmed text are alpha over the theme's own text colour rather than
 * fixed greys, so they hold their weight on a ground this plugin has never seen.
 */
export function derivePalette(theme: Theme): EvoCloudPalette {
  const mode = theme.palette.mode;
  // Accents are still picked per mode: EvoCloud gold is deepened on light
  // grounds and the brand blue differs between the two. Taking them from the
  // matching set keeps that intact under a foreign theme.
  const accent = mode === 'dark' ? EVOCLOUD_DARK : EVOCLOUD_LIGHT;

  const bg = theme.palette.background.default;
  const surface = theme.palette.background.paper;
  // Headlamp adds `muted` for exactly this: the shaded band behind a table
  // header or a card footer. Falls back for a theme that omits it.
  const muted = (theme.palette.background as { muted?: string }).muted ?? sink(surface, 0.04);
  const text = theme.palette.text.primary;
  const ink = (opacity: number) => inkOf(text, opacity);

  return {
    bg,
    surface,
    surfaceHover: raise(theme, surface, 0.05),
    rowHover: raise(theme, surface, 0.035),
    surfaceSunken: muted,
    surfaceDeep: sink(muted, 0.03),
    control: surface,
    controlActive: raise(theme, surface, 0.09),
    chip: muted,
    tile: muted,
    tileBorder: ink(0.14),
    segActive: accent.segActive,
    border: ink(0.14),
    borderHover: ink(0.3),
    divider: ink(0.1),
    dividerSoft: ink(0.06),
    text,
    textValue: ink(0.86),
    textMuted: theme.palette.text.secondary || ink(0.62),
    textDim: ink(0.55),
    textDimmer: ink(0.46),
    textFaint: ink(0.38),

    /* Accents below this line are EvoCloud's on every theme. */
    brand: accent.brand,
    brandSoft: accent.brandSoft,
    brandBorder: accent.brandBorder,
    brandSelected: accent.brandSelected,
    // Follows the same rule under a foreign theme: gold on a dark ground, blue
    // on a light one, since it is picked from the mode-matched set above.
    accent: accent.accent,
    accentSoft: accent.accentSoft,
    accentBorder: accent.accentBorder,
    link: accent.link,
    linkHover: accent.linkHover,
    gold: accent.gold,
    goldFill: accent.goldFill,
    goldSoft: accent.goldSoft,
    goldBorder: accent.goldBorder,
    healthy: accent.healthy,
    healthySoft: accent.healthySoft,
    healthyBorder: accent.healthyBorder,
    danger: accent.danger,
  };
}
