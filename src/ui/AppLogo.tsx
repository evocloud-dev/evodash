/**
 * Navbar logo, EvoCloud-branded while an EvoCloud theme is active.
 *
 * Headlamp passes `themeName` as whatever is in `headlampThemePreference`,
 * which for a theme registered via `registerAppTheme` is that theme's name —
 * so 'EvoCloud Dark' / 'EvoCloud Light' here, and 'light' / 'dark' for the
 * built-ins.
 *
 * The fallback matters. Once a plugin registers a logo, Headlamp stops
 * rendering its own for good: the check in AppLogo.tsx is
 * `PluginAppLogoComponent ? ... : <OriginalAppLogo/>`, which tests whether a
 * logo was registered, not what it returned. Returning null on other themes
 * would leave the navbar empty rather than falling back, so this draws a plain
 * wordmark instead — the product name as text, not a copy of their artwork.
 */
import React from 'react';
import { EVOCLOUD_LOGO_PNG } from '../icons/evocloudLogo';

export interface AppLogoProps {
  logoType?: 'small' | 'large';
  themeName?: string;
  className?: string;
  [key: string]: any;
}

/** True for any theme this plugin registered. */
function isEvoCloudTheme(themeName?: string): boolean {
  return (themeName ?? '').startsWith('EvoCloud');
}

export function EvoCloudAppLogo({ logoType = 'large', themeName, className }: AppLogoProps) {
  if (!isEvoCloudTheme(themeName)) {
    return (
      <span
        className={className}
        style={{ fontSize: '19px', fontWeight: 600, letterSpacing: '-0.01em', color: 'currentColor' }}
      >
        Headlamp
      </span>
    );
  }

  // Collapsed navbar gets the mark alone; there is no room for the wordmark.
  if (logoType === 'small') {
    return <img className={className} src={EVOCLOUD_LOGO_PNG} alt="EvoCloud" width={32} height={32} />;
  }

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
      <img src={EVOCLOUD_LOGO_PNG} alt="" width={32} height={32} style={{ flex: 'none' }} />
      <span
        style={{
          fontFamily: "'Exo 2', 'Inter', system-ui, sans-serif",
          fontSize: '20px',
          fontWeight: 700,
          letterSpacing: '-0.015em',
          // Follows navbar.color, so it works on both EvoCloud themes.
          color: 'currentColor',
          whiteSpace: 'nowrap',
        }}
      >
        EvoCloud
      </span>
    </span>
  );
}
