/**
 * Navbar logo: Headlamp's own mark, with the wordmark reading EvoCloud while an
 * EvoCloud theme is selected.
 *
 * Only the text changes. The mark is Headlamp's own artwork, taken from the
 * asset their plugin package ships rather than redrawn — see icons/headlampMark
 * for why it is embedded there instead of imported.
 *
 * Headlamp's large logo is a single SVG with the mark and the word "Headlamp"
 * baked into one path set, so there is no way to swap the text inside it. The
 * small variant is the mark alone, which is why that is the one used here and
 * the word is set as text beside it.
 *
 * The fallback matters. Once a plugin registers a logo, Headlamp stops
 * rendering its own for good: the check in its AppLogo.tsx is
 * `PluginAppLogoComponent ? ... : <OriginalAppLogo/>`, which tests whether a
 * logo was registered, not what it returned. Returning null on other themes
 * would leave the navbar empty, so every branch here renders something — on a
 * non-EvoCloud theme, the mark and the word "Headlamp", which is what it
 * replaces.
 */
import React from 'react';
import { HEADLAMP_MARK_DARK, HEADLAMP_MARK_LIGHT } from '../icons/headlampMark';
import { evoCloudThemeActive } from './themePalette';

export interface AppLogoProps {
  logoType?: 'small' | 'large';
  themeName?: string;
  className?: string;
  [key: string]: any;
}

export function EvoCloudAppLogo({ logoType = 'large', themeName, className }: AppLogoProps) {
  // `themeName` is NOT the theme's name. Headlamp fills it from `useNavBarMode()`,
  // which returns only 'dark' or 'light' by measuring the navbar's contrast — so
  // it says which mark to use and nothing about which theme is selected. Testing
  // it for "EvoCloud" silently never matches.
  const icon = themeName === 'dark' ? HEADLAMP_MARK_LIGHT : HEADLAMP_MARK_DARK;

  // Which theme is selected has to come from where Headlamp records it, the same
  // source the page palette reads.
  const evo = evoCloudThemeActive();
  const mark = <img src={icon} alt="" width={26} height={32} style={{ flex: 'none' }} />;

  // Collapsed navbar: the mark alone, exactly as Headlamp shows it. There is no
  // room for a wordmark, so there is no text to change.
  if (logoType === 'small') {
    return (
      <span className={className} style={{ display: 'inline-flex', alignItems: 'center' }}>
        {mark}
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}
    >
      {mark}
      <span
        style={{
          fontSize: '19px',
          fontWeight: 600,
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
          // Follows the navbar's own text colour, so it works on every theme.
          color: 'currentColor',
        }}
      >
        {evo ? 'EvoCloud' : 'Headlamp'}
      </span>
    </span>
  );
}
