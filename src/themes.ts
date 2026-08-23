import { registerAppTheme } from '@kinvolk/headlamp-plugin/lib';
import { EVOCLOUD_DARK, EVOCLOUD_LIGHT } from './palette';

/**
 * EvoCloud Headlamp app themes.
 *
 * Both themes are built from the shared palette in palette.ts, whose dark set is
 * the Forecastle catalog palette verbatim — so Headlamp's own chrome and the
 * plugin's pages resolve to the same values rather than two hand-kept lists.
 *
 * - Brand blue: #204CEB (evocloud.dev/branding primary) on light grounds,
 *   #3B68FF on dark
 * - Brand gold: #F7B500 (branding secondary) as a fill in both themes;
 *   deepened to #B8860B for text and icons on light
 * - Typography: Exo 2 and Inter, with Overpass and IBM Plex Mono for the
 *   Forecastle catalog
 */

// Inject official EvoCloud brand font family (Exo 2 and Inter) directly into the Headlamp UI
if (typeof document !== 'undefined' && !document.getElementById('evocloud-brand-fonts')) {
  // Warm up the font CDN connections before the stylesheet request resolves
  for (const [origin, crossOrigin] of [
    ['https://fonts.googleapis.com', false],
    ['https://fonts.gstatic.com', true],
  ] as const) {
    const preconnect = document.createElement('link');
    preconnect.rel = 'preconnect';
    preconnect.href = origin;
    if (crossOrigin) {
      preconnect.crossOrigin = 'anonymous';
    }
    document.head.appendChild(preconnect);
  }

  // Exo 2 and Inter are the brand stack; Overpass and IBM Plex Mono are what the
  // Forecastle catalog page is designed in. Requested as one stylesheet so the
  // whole plugin costs a single font round-trip.
  const link = document.createElement('link');
  link.id = 'evocloud-brand-fonts';
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Exo+2:ital,wght@0,300..800;1,300..800' +
    '&family=Inter:wght@300..700' +
    '&family=Overpass:wght@400;500;600;700' +
    '&family=IBM+Plex+Mono:wght@400;500' +
    '&display=swap';
  document.head.appendChild(link);
}

/**
 * Headlamp joins this array straight into a CSS `font-family` declaration
 * (see headlamp-plugin `lib/lib/themes.js`), so any family whose name is not a
 * bare CSS identifier — `Exo 2` contains a space and a digit — must ship its own
 * quotes. Unquoted, the whole declaration is invalid and the browser drops it,
 * silently falling back to the default Headlamp font.
 */
const EVOCLOUD_FONT_STACK = ["'Exo 2'", "'Inter'", 'system-ui', 'sans-serif'];

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
    // Sidebar, navbar and page all sit on the same ground as the Forecastle
    // catalog, so the chrome reads as one continuous surface with cards
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
  fontFamily: EVOCLOUD_FONT_STACK,
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
    // Same ground as the page and the Forecastle catalog — see the light theme.
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
  fontFamily: EVOCLOUD_FONT_STACK,
});
