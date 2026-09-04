// Disabled along with the theme registrations below. Both imports would be
// unused while those are commented out.
// import { registerAppTheme } from '@kinvolk/headlamp-plugin/lib';
// import { EVOCLOUD_DARK, EVOCLOUD_LIGHT } from './palette';

/**
 * EvoCloud Headlamp app themes — CURRENTLY DISABLED.
 *
 * Both registrations are commented out, so neither theme is offered in
 * Settings > General. Uncomment the two blocks below and the imports above to
 * bring them back; nothing else needs changing.
 *
 * Two knock-on effects while they are off, both already handled:
 *   - `evoCloudThemeActive()` always returns false, so `usePalette()` derives
 *     the plugin's colours from whichever Headlamp theme is active. That path
 *     exists for exactly this case; the pages stay readable on every theme.
 *   - The navbar wordmark reads "Headlamp" on every theme, since it changes to
 *     "EvoCloud" only while an EvoCloud theme is selected. See ui/AppLogo.tsx.
 *
 * Both themes are built from the shared palette in palette.ts, whose dark set is
 * the App Endpoints catalog palette verbatim — so Headlamp's own chrome and the
 * plugin's pages resolve to the same values rather than two hand-kept lists.
 *
 * - Brand blue: #204CEB (evocloud.dev/branding primary) on light grounds,
 *   #3B68FF on dark
 * - Brand gold: #F7B500 (branding secondary) as a fill in both themes;
 *   deepened to #B8860B for text and icons on light
 * - Typography: none of its own. Neither theme sets `fontFamily`, so both fall
 *   back to Headlamp's default face (Overpass, which Headlamp bundles and
 *   self-hosts) and the plugin's pages read as part of the app rather than as a
 *   panel in someone else's font.
 */

/*
// 1. EvoCloud Light Theme (Clean, executive daytime workspace & documentation views)
registerAppTheme({
  name: 'EvoCloud Light',
  base: 'light',
  primary: EVOCLOUD_LIGHT.brand,
  secondary: EVOCLOUD_LIGHT.goldFill,
  text: {
    primary: EVOCLOUD_LIGHT.text,
  },
  link: {
    color: EVOCLOUD_LIGHT.link,
  },
  background: {
    default: EVOCLOUD_LIGHT.bg,
    surface: EVOCLOUD_LIGHT.surface,
    muted: EVOCLOUD_LIGHT.chip,
  },
  sidebar: {
    // Sidebar, navbar and page all sit on the same ground as the App
    // Endpoints catalog, so the chrome reads as one continuous surface with cards
    // floating on it rather than as three abutting panels.
    background: EVOCLOUD_LIGHT.bg,
    color: EVOCLOUD_LIGHT.textMuted,
    selectedBackground: EVOCLOUD_LIGHT.brandSelected,
    selectedColor: EVOCLOUD_LIGHT.brand,
    actionBackground: EVOCLOUD_LIGHT.goldFill,
  },
  navbar: {
    background: EVOCLOUD_LIGHT.bg,
    color: EVOCLOUD_LIGHT.text,
  },
  buttonTextTransform: 'none',
  radius: 8,
});

// 2. EvoCloud Dark Theme (Immersive OLED developer workspace & terminal operations)
registerAppTheme({
  name: 'EvoCloud Dark',
  base: 'dark',
  primary: EVOCLOUD_DARK.brand,
  secondary: EVOCLOUD_DARK.goldFill,
  text: {
    primary: EVOCLOUD_DARK.text,
  },
  link: {
    color: EVOCLOUD_DARK.link,
  },
  background: {
    default: EVOCLOUD_DARK.bg,
    surface: EVOCLOUD_DARK.surface,
    muted: EVOCLOUD_DARK.chip,
  },
  sidebar: {
    // Same ground as the page and the App Endpoints catalog — see the light theme.
    background: EVOCLOUD_DARK.bg,
    color: EVOCLOUD_DARK.textMuted,
    selectedBackground: EVOCLOUD_DARK.brandSelected,
    selectedColor: EVOCLOUD_DARK.link,
    actionBackground: EVOCLOUD_DARK.goldFill,
  },
  navbar: {
    background: EVOCLOUD_DARK.bg,
    color: EVOCLOUD_DARK.text,
  },
  buttonTextTransform: 'none',
  radius: 8,
});
*/
