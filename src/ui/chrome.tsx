/**
 * Shared page chrome for the EvoCloud pages.
 *
 * The App Endpoints catalog was the first page built, and its design set the
 * house style: the header band with breadcrumb and live badge, the dashed
 * notice block, the folder-headed sections, the mono chips and the source
 * footer. Everything here is that vocabulary lifted out so the GitOps,
 * Compliance, Networking and Overview pages are the same page furniture with
 * different data in it, rather than four near-copies that drift apart.
 *
 * Colour comes from palette.ts only — nothing here hard-codes a hex.
 */
import { Router } from '@kinvolk/headlamp-plugin/lib';
import { useCluster } from '@kinvolk/headlamp-plugin/lib/k8s';
import { useTheme } from '@mui/material/styles';
import React from 'react';
import { createPortal } from 'react-dom';
import { Link as RouterLink } from 'react-router-dom';
import { EVOCLOUD_LOGO_PNG } from '../icons/evocloudLogo';
import { EVOCLOUD_DARK, EVOCLOUD_LIGHT, EvoCloudPalette } from '../palette';
import { derivePalette, evoCloudThemeActive } from './themePalette';

/**
 * Reached through the `Router` namespace rather than imported from
 * `lib/lib/router` directly.
 *
 * The plugin build externalises anything under `@kinvolk/headlamp-plugin/lib`
 * by flattening the rest of the path into a property name — `lib/router` becomes
 * `pluginLib.librouter`, which does not exist. The failure is silent until the
 * import is actually called, so it survives a clean build, a clean typecheck and
 * every page that does not happen to use it.
 */
const { createRouteURL } = Router;

/**
 * The face for code, identifiers and numbers. A role, not a brand: it names no
 * downloaded family, so it resolves to whatever monospace the platform already
 * has — the same thing Headlamp itself falls back to.
 */
export const MONO = 'monospace';

/** Digits that sit in pills or columns must not reflow as counts grow. */
export const NUMERIC: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

/** One line of text, clipped rather than wrapped. */
export const CLIP: React.CSSProperties = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

/**
 * The palette matching the active app theme.
 *
 * On an EvoCloud theme this is the hand-tuned set, unchanged. On anything else
 * the neutrals are derived from that theme so the page sits flush with the
 * chrome around it, and only the accents stay EvoCloud — see ui/themePalette.ts
 * for why that is the line.
 */
export function usePalette(): EvoCloudPalette {
  const theme = useTheme();
  if (evoCloudThemeActive()) {
    return theme.palette.mode === 'dark' ? EVOCLOUD_DARK : EVOCLOUD_LIGHT;
  }
  return derivePalette(theme);
}

/**
 * The body face for the pages.
 *
 * Always the theme's own face, EvoCloud theme or not. The plugin ships no font:
 * a page in a family nothing else on screen uses reads as a foreign panel
 * however well the colours match. The fallback mirrors Headlamp's own default
 * (see `frontend/src/lib/themes.ts`) for the case where a theme leaves
 * typography unset.
 */
export function usePageFont(): string {
  const theme = useTheme();
  return theme.typography.fontFamily ?? 'Overpass, sans-serif';
}

/**
 * Rules that inline styles cannot express — pseudo-classes, keyframes and
 * media queries. Scoped under `.evo-root` so nothing leaks into the rest of
 * Headlamp.
 */
export const evoCss = (C: EvoCloudPalette) => `
.evo-root * { box-sizing: border-box; }
.evo-root a { color: ${C.link}; text-decoration: none; }
.evo-root a:hover { color: ${C.linkHover}; text-decoration: underline; }
.evo-root input { font-family: inherit; }
.evo-root ::placeholder { color: ${C.textDimmer}; }
.evo-search:focus-within { border-color: ${C.gold}; }
.evo-select-wrap:hover { border-color: ${C.borderHover}; }
.evo-card:hover { border-color: ${C.brandBorder}; background: ${C.surfaceHover}; }
.evo-row:hover { background: ${C.rowHover}; }
.evo-iconbtn:hover { background: ${C.controlActive}; color: ${C.text}; }
.evo-openlink:hover { background: ${C.controlActive}; color: ${C.gold}; }
.evo-navcard:hover { border-color: ${C.brandBorder}; background: ${C.surfaceHover}; }
.evo-navcard:hover .evo-navcard-title { color: ${C.brand}; }
.evo-navcard, .evo-navcard:hover { text-decoration: none; color: inherit; }
.evo-root :focus-visible { outline: 2px solid ${C.brand}; outline-offset: 2px; }
@keyframes evo-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .35 } }
@keyframes evo-spin { to { transform: rotate(360deg) } }
.evo-spinner { animation: evo-spin 720ms linear infinite; }
/* A spinner that cannot spin says nothing, so it slows rather than stops. */
@media (prefers-reduced-motion: reduce) { .evo-spinner { animation-duration: 2.4s; } }
.evo-syncing { animation: evo-pulse 1.1s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .evo-syncing { animation: none } }
`;

/* ------------------------------------------------------------------ icons */

export const FolderIcon = ({ size, stroke }: { size: number; stroke: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.9" strokeLinejoin="round">
    <path d="M3 7.5a2 2 0 0 1 2-2h3.6l1.8 2.2H19a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

export const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M15 5.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h.5" />
  </svg>
);

export const OpenIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 4h6v6" />
    <path d="M20 4 11 13" />
    <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </svg>
);

export const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 12.5 9.5 18 20 6.5" />
  </svg>
);

export const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 140ms ease' }}
  >
    <polyline points="6 9.5 12 15.5 18 9.5" />
  </svg>
);

/* ----------------------------------------------------------------- actions */

/** Square 26px icon button, the size the card and row action clusters use. */
export const ICON_BUTTON: React.CSSProperties = {
  width: '26px',
  height: '26px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 0,
  borderRadius: '6px',
  cursor: 'pointer',
};

/**
 * Copy text, reporting whether it actually landed.
 *
 * `navigator.clipboard` is undefined outside a secure context, and its
 * `writeText` rejects asynchronously — a plain try/catch around it catches
 * neither case, so a failed copy is invisible. Falls back to the textarea and
 * `execCommand` route, which still works where the async API is unavailable.
 *
 * Chrome also requires transient user activation for a clipboard write, so this
 * only succeeds when called from a real click.
 */
export async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    /* blocked or unavailable — try the fallback below */
  }
  try {
    const scratch = document.createElement('textarea');
    scratch.value = text;
    scratch.setAttribute('readonly', '');
    scratch.style.position = 'fixed';
    scratch.style.top = '-1000px';
    scratch.style.opacity = '0';
    document.body.appendChild(scratch);
    scratch.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(scratch);
    return ok;
  } catch (e) {
    return false;
  }
}

/**
 * Copy-to-clipboard button that acknowledges what happened.
 *
 * Feedback is the point: without it a successful copy and a blocked one look
 * identical, which is the whole reason a silent copy reads as broken. Turns
 * green with a check on success, red on failure, and resets after a moment.
 */
export function CopyButton({
  C,
  value,
  label,
}: {
  C: EvoCloudPalette;
  value: string;
  /** Names the thing being copied, for the accessible label. */
  label: string;
}) {
  const [state, setState] = React.useState<'idle' | 'ok' | 'fail'>('idle');

  React.useEffect(() => {
    if (state === 'idle') {
      return undefined;
    }
    const t = setTimeout(() => setState('idle'), 1600);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <button
      type="button"
      className="evo-iconbtn"
      onClick={async () => setState((await writeClipboard(value)) ? 'ok' : 'fail')}
      title={state === 'ok' ? 'Copied' : state === 'fail' ? 'Copy blocked by the browser' : 'Copy URL'}
      aria-label={`Copy URL for ${label}`}
      style={{
        ...ICON_BUTTON,
        color: state === 'ok' ? C.healthy : state === 'fail' ? C.danger : C.textDim,
      }}
    >
      {state === 'ok' ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

/** Open-in-new-tab link, styled to match {@link CopyButton}. */
export function OpenButton({ C, href, label }: { C: EvoCloudPalette; href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="evo-openlink"
      title="Open application"
      aria-label={`Open ${label}`}
      style={{ ...ICON_BUTTON, color: C.textDim }}
    >
      <OpenIcon />
    </a>
  );
}

/**
 * Remote image with a monogram fallback.
 *
 * Icon URLs come from whatever the resource points at — favicons, wordmarks,
 * any aspect ratio, and plenty of them 404. Contain-fit inside a padded tile so
 * a wide logo neither stretches nor crops, and fall back to the first letter
 * when the image will not load.
 */
export function RemoteIcon({
  C,
  src,
  name,
  size,
}: {
  C: EvoCloudPalette;
  src?: string;
  name: string;
  size: number;
}) {
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => setBroken(false), [src]);
  const failed = !src || broken;

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        flex: 'none',
        borderRadius: size > 30 ? '8px' : '6px',
        background: C.tile,
        border: `1px solid ${C.tileBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {failed ? (
        <span style={{ fontSize: `${Math.round(size * 0.4)}px`, fontWeight: 700, color: C.gold }}>
          {name.charAt(0).toUpperCase()}
        </span>
      ) : (
        <img
          src={src}
          alt=""
          style={{ maxWidth: `${size - 12}px`, maxHeight: `${size - 12}px`, objectFit: 'contain' }}
          onError={() => setBroken(true)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ search */

/**
 * Subsequence match: every character of the query appears in the text, in
 * order, but not necessarily adjacent.
 *
 * So "graf" finds Grafana, and "argwf" finds Argo Workflows — which a substring
 * match would miss. Case-insensitive, and whitespace in the query is ignored so
 * "argo wf" behaves the same as "argowf".
 *
 * Deliberately not a ranked fuzzy library: results here are grouped by their
 * own headings rather than shown as one ordered list, so a relevance score
 * would have nowhere to apply. This only decides in or out.
 */
export function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase().replace(/\s+/g, '');
  if (!q) {
    return true;
  }
  const haystack = text.toLowerCase();
  let at = 0;
  for (const ch of q) {
    at = haystack.indexOf(ch, at);
    if (at === -1) {
      return false;
    }
    at += 1;
  }
  return true;
}

/** True when any of the fields matches — the usual "search across columns". */
export function fuzzyMatchAny(query: string, fields: (string | null | undefined)[]): boolean {
  if (!query.trim()) {
    return true;
  }
  return fields.some(f => !!f && fuzzyMatch(query, f));
}

/* ----------------------------------------------------------------- sources */

/** The bits of a Headlamp resource class needed to name it in the footer. */
export interface ResourceClassLike {
  /** `makeCustomResourceClass` sets this to an array of `group/version`. */
  apiVersion: string | string[];
  kind: string;
}

/**
 * "group/version · Kind" for a page's source footer.
 *
 * Read off the classes the page actually queries rather than written out by
 * hand, so the footer cannot end up claiming a group or version the queries no
 * longer use. Several classes sharing an apiVersion collapse to one entry.
 */
export function sourceOf(...classes: ResourceClassLike[]): string {
  const byVersion = new Map<string, string[]>();

  for (const cls of classes) {
    const version = Array.isArray(cls.apiVersion) ? cls.apiVersion[0] : cls.apiVersion;
    const kinds = byVersion.get(version) ?? [];
    if (!kinds.includes(cls.kind)) {
      kinds.push(cls.kind);
    }
    byVersion.set(version, kinds);
  }

  return Array.from(byVersion, ([version, kinds]) => `${version} · ${kinds.join(', ')}`).join('  |  ');
}

/* ------------------------------------------------------------ list queries */

/**
 * The shape of a Headlamp `useList()` result, loosened so one helper can take
 * queries for unrelated resource classes.
 *
 * `useList` returns an array-like object that is also a react-query result;
 * only the fields below are used here.
 */
export interface ListQuery {
  items: any[] | null;
  isLoading: boolean;
  isFetching: boolean;
  error: any;
  errors?: any[] | null;
}

/** First error a query carries, whether reported singly or per cluster. */
export function queryError(q: ListQuery): any {
  return q.error ?? q.errors?.find(Boolean) ?? null;
}

/**
 * True when the API said the resource type does not exist.
 *
 * This is how an uninstalled operator reads from the browser: the CRD is
 * absent, so the collection 404s. Headlamp reports the status on the error and
 * some paths only put it in the message, so both are checked.
 */
export function isNotFound(err: any): boolean {
  if (!err) {
    return false;
  }
  if (err.status === 404) {
    return true;
  }
  return /404|not found|could not find/i.test(String(err.message ?? ''));
}

/**
 * True when the API refused the request rather than failing it.
 *
 * Worth separating from a general error: a 403 is not something wrong with the
 * cluster or the page, it is this user not being allowed to read this resource,
 * and the only useful thing to say about it is exactly that.
 */
export function isForbidden(err: any): boolean {
  if (!err) {
    return false;
  }
  if (err.status === 403) {
    return true;
  }
  return /403|forbidden/i.test(String(err.message ?? ''));
}

/** True when every query failed because its resource type is not installed. */
export function allNotFound(queries: ListQuery[]): boolean {
  const errors = queries.map(queryError);
  return errors.length > 0 && errors.every(isNotFound);
}

/** First error across the queries that is not a plain "not installed". */
export function firstRealError(queries: ListQuery[]): any {
  return queries.map(queryError).find(e => e && !isNotFound(e)) ?? null;
}

/** Items from queries whose resource type exists, with 404s treated as empty. */
export function itemsOf(q: ListQuery): any[] {
  return q.items ?? [];
}

/**
 * A string that changes whenever any watched list delivers a different set of
 * objects, so the live badge can reset its elapsed counter on real changes and
 * ignore the websocket's keepalive traffic.
 */
export function useRevision(queries: ListQuery[]): string {
  const parts = queries
    .flatMap(q => q.items ?? [])
    .map((i: any) => `${i?.metadata?.uid}@${i?.metadata?.resourceVersion}`)
    .sort()
    .join('|');
  return parts;
}

/* --------------------------------------------------------------- live badge */

export interface LiveBadgeProps {
  C: EvoCloudPalette;
  /** True while any watched list is in flight. */
  fetching: boolean;
  /** Non-null when the watch cannot be established. */
  error: any;
  /** From {@link useRevision} — resets the elapsed counter when it changes. */
  revision: string;
  /** What is being watched, for the tooltip. */
  what: string;
}

/**
 * Connection state of the resource watches behind a page.
 *
 * The designs had a refresh button here. Headlamp watches these lists over a
 * websocket and exposes no refetch, so a button would be a control that cannot
 * do anything. This reports the watch instead: green and "live" while
 * connected, with time since the last change received.
 */
export function LiveBadge({ C, fetching, error, revision, what }: LiveBadgeProps) {
  const [now, setNow] = React.useState(() => Date.now());
  const [lastChange, setLastChange] = React.useState(() => Date.now());

  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  React.useEffect(() => setLastChange(Date.now()), [revision]);

  const elapsed = Math.max(0, Math.round((now - lastChange) / 1000));
  const ago = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m`;

  return (
    <div
      title={`Watching ${what} over the cluster websocket. Last change ${ago} ago.`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        height: '34px',
        padding: '0 12px',
        background: C.control,
        border: `1px solid ${C.border}`,
        borderRadius: '8px',
        color: C.textMuted,
        fontSize: '12.5px',
        fontWeight: 500,
      }}
    >
      <span
        className={fetching ? 'evo-syncing' : undefined}
        style={{
          width: '7px',
          height: '7px',
          flex: 'none',
          borderRadius: '50%',
          background: error ? C.danger : C.healthy,
        }}
      />
      <span>{error ? 'disconnected' : fetching ? 'syncing' : 'live'}</span>
      {!error && !fetching && (
        <span style={{ ...NUMERIC, fontFamily: MONO, fontSize: '11px', color: C.textFaint }}>{ago}</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ notice */

/** The dashed empty / error / loading block. */
/**
 * Work in progress, as a ring rather than a bar.
 *
 * Deliberately not MUI's CircularProgress: the pages are built on the EvoCloud
 * palette and inline styles, and pulling in a themed MUI component here would
 * put a control coloured by Headlamp's theme in the middle of one that is not.
 * The keyframes live in `evoCss`, which every page already injects.
 */
export function Spinner({ C, size = 20 }: { C: EvoCloudPalette; size?: number }) {
  return (
    <span
      className="evo-spinner"
      role="status"
      aria-label="Loading"
      style={{
        display: 'inline-block',
        flex: 'none',
        width: size,
        height: size,
        borderRadius: '50%',
        border: `${Math.max(2, Math.round(size / 10))}px solid ${C.border}`,
        borderTopColor: C.brand,
      }}
    />
  );
}

export function Notice({
  C,
  title,
  children,
  busy = false,
}: {
  C: EvoCloudPalette;
  title: string;
  children?: React.ReactNode;
  /** Show a spinner above the title, for a notice that is waiting on data. */
  busy?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        padding: '64px 20px',
        border: `1px dashed ${C.border}`,
        borderRadius: '12px',
        background: C.surfaceSunken,
        textAlign: 'center',
      }}
    >
      {busy && <Spinner C={C} size={24} />}
      <div style={{ fontSize: '15px', fontWeight: 600 }}>{title}</div>
      {children && (
        <div style={{ fontSize: '13px', color: C.textMuted, maxWidth: '52ch', lineHeight: 1.6 }}>
          {children}
        </div>
      )}
    </div>
  );
}

/** `code` in the page's mono face, for API groups and resource kinds in prose. */
export const Code = ({ children }: { children: React.ReactNode }) => (
  <code style={{ fontFamily: MONO }}>{children}</code>
);

/* -------------------------------------------------------------- page shell */

export interface EvoPageProps {
  /** Second breadcrumb segment — the first is always EvoCloud. */
  section: string;
  /**
   * Route name behind the section segment, making it the way back.
   *
   * Set by pages that sit under another one, so a detail view's breadcrumb is
   * also its back link rather than needing a second control that says the same
   * thing. Left unset on a page that is its own section.
   */
  sectionRoute?: string;
  title: string;
  /** The line under the title: counts, or what the page is reading. */
  summary: React.ReactNode;
  /** Controls in the header's right-hand cluster. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Root wrapper, header band and source footer.
 *
 * The page paints its own ground rather than sitting on Headlamp's, so the
 * catalog's dark navy carries edge to edge; the app themes in themes.ts use the
 * same value, so the two meet without a seam.
 */
export function EvoPage({
  section,
  sectionRoute,
  title,
  summary,
  actions,
  children,
}: EvoPageProps) {
  const C = usePalette();
  const font = usePageFont();
  const css = React.useMemo(() => evoCss(C), [C]);
  const cluster = useCluster();

  return (
    <>
      <style>{css}</style>
      <div
        className="evo-root"
        style={{
          minHeight: '100%',
          background: C.bg,
          color: C.text,
          fontFamily: font,
          padding: '28px 36px 56px',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '24px',
            flexWrap: 'wrap',
            paddingBottom: '18px',
            borderBottom: `1px solid ${C.border}`,
            marginBottom: '22px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Decorative — the breadcrumb beside it already reads "EvoCloud". */}
            <img src={EVOCLOUD_LOGO_PNG} width={52} height={52} alt="" style={{ flex: 'none' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: C.textDim,
                }}
              >
                <span>EvoCloud</span>
                <span style={{ color: C.border }}>/</span>
                {sectionRoute ? (
                  <RouterLink
                    to={createRouteURL(sectionRoute)}
                    style={{ color: C.gold, letterSpacing: 'inherit' }}
                  >
                    {section}
                  </RouterLink>
                ) : (
                  <span style={{ color: C.gold }}>{section}</span>
                )}
              </div>
              <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 700, letterSpacing: '-0.015em', lineHeight: 1.15 }}>
                {title}
              </h1>
              <div style={{ ...NUMERIC, fontSize: '13px', color: C.textMuted }}>{summary}</div>
            </div>
          </div>

          {actions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>{actions}</div>
          )}
        </div>

        {children}

        {/* Just the cluster, centred. The API groups a page reads are a
            developer detail and were only ever noise to someone using it. */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: '30px',
            paddingTop: '14px',
            borderTop: `1px solid ${C.divider}`,
            fontSize: '11.5px',
            fontFamily: MONO,
            color: C.textFaint,
          }}
        >
          <span>cluster {cluster ?? 'unknown'}</span>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- controls */

export function SearchBox({
  C,
  value,
  onChange,
  placeholder,
  width = '250px',
}: {
  C: EvoCloudPalette;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  width?: string;
}) {
  return (
    <div
      className="evo-search"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        height: '34px',
        padding: '0 11px',
        background: C.control,
        border: `1px solid ${C.border}`,
        borderRadius: '8px',
        minWidth: width,
        transition: 'border-color 140ms ease',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2.2" strokeLinecap="round">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <line x1="15.5" y1="15.5" x2="21" y2="21" />
      </svg>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 0, color: C.text, fontSize: '13px' }}
      />
      {/*
        The design showed a "/" shortcut hint here. Nothing bound it, and
        Headlamp's own navbar already owns "/" for its global search, so it
        advertised a key that would have gone to the wrong place.
      */}
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export function FilterSelect({
  C,
  value,
  onChange,
  options,
  label,
  icon,
}: {
  C: EvoCloudPalette;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className="evo-select-wrap"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        height: '34px',
        background: C.control,
        border: `1px solid ${C.border}`,
        borderRadius: '8px',
      }}
    >
      {icon && (
        <span style={{ position: 'absolute', left: '10px', pointerEvents: 'none', display: 'flex' }}>{icon}</span>
      )}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={label}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          height: '100%',
          padding: icon ? '0 28px 0 31px' : '0 28px 0 12px',
          background: 'transparent',
          border: 0,
          outline: 0,
          color: C.text,
          fontFamily: 'inherit',
          fontSize: '12.5px',
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ background: C.control, color: C.text }}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke={C.textDim}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ position: 'absolute', right: '9px', pointerEvents: 'none' }}
      >
        <polyline points="6 9.5 12 15.5 18 9.5" />
      </svg>
    </div>
  );
}

/**
 * A plain button at the height of the search box and the selects.
 *
 * The header's control cluster is a row of 34px pills; a button dropped into it
 * has to be one too or the row stops lining up. `active` gives it the same gold
 * wash the selected segment of {@link ViewToggle} uses, for controls that are on
 * or off rather than momentary.
 */
export function GhostButton({
  C,
  onClick,
  children,
  title,
  active = false,
}: {
  C: EvoCloudPalette;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        height: '34px',
        padding: '0 12px',
        background: active ? C.segActive : C.control,
        border: `1px solid ${active ? C.goldBorder : C.border}`,
        borderRadius: '8px',
        color: active ? C.gold : C.textMuted,
        fontFamily: 'inherit',
        fontSize: '12.5px',
        fontWeight: 500,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------ section head */

/**
 * The folder-headed band that opens a group: label, count pill, rule.
 *
 * Collapsible when `onToggle` is given, static otherwise.
 */
/**
 * Grid / list segmented control.
 *
 * The active segment sits on a gold wash because the icon on it is gold — the
 * same content-on-tint pairing the restricted and Internal marks use, rather
 * than gold on a neutral.
 */
export function ViewToggle({
  C,
  value,
  onChange,
}: {
  C: EvoCloudPalette;
  value: 'grid' | 'list';
  onChange: (v: 'grid' | 'list') => void;
}) {
  const seg = (active: boolean): React.CSSProperties => ({
    width: '30px',
    height: '26px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 0,
    borderRadius: '6px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    background: active ? C.segActive : 'transparent',
    color: active ? C.gold : C.textDim,
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '34px',
        background: C.control,
        border: `1px solid ${C.border}`,
        borderRadius: '8px',
        padding: '3px',
      }}
    >
      <button type="button" onClick={() => onChange('grid')} title="Grid view" aria-label="Grid view" style={seg(value === 'grid')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <rect x="3" y="3" width="8" height="8" rx="1.6" />
          <rect x="13" y="3" width="8" height="8" rx="1.6" />
          <rect x="3" y="13" width="8" height="8" rx="1.6" />
          <rect x="13" y="13" width="8" height="8" rx="1.6" />
        </svg>
      </button>
      <button type="button" onClick={() => onChange('list')} title="List view" aria-label="List view" style={seg(value === 'list')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <rect x="3" y="4" width="18" height="3" rx="1.4" />
          <rect x="3" y="10.5" width="18" height="3" rx="1.4" />
          <rect x="3" y="17" width="18" height="3" rx="1.4" />
        </svg>
      </button>
    </div>
  );
}

export function SectionHeading({
  C,
  label,
  count,
  open = true,
  onToggle,
  right,
}: {
  C: EvoCloudPalette;
  label: string;
  count?: number;
  open?: boolean;
  onToggle?: () => void;
  right?: React.ReactNode;
}) {
  const inner = (
    <>
      <FolderIcon size={15} stroke={C.gold} />
      <span
        style={{
          fontSize: '12px',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: C.text,
        }}
      >
        {label}
      </span>
      {count !== undefined && (
        <span
          style={{
            ...NUMERIC,
            // Fixed floor so a single digit still reads as a pill rather than a
            // dot; wider counts grow into the padding.
            minWidth: '24px',
            textAlign: 'center',
            fontSize: '11px',
            fontWeight: 600,
            fontFamily: MONO,
            color: C.accent,
            background: C.accentSoft,
            border: `1px solid ${C.accentBorder}`,
            borderRadius: '999px',
            padding: '1.5px 7px',
          }}
        >
          {count}
        </span>
      )}
      <span style={{ flex: 1, height: '1px', background: C.divider }} />
      {right ?? (
        <span style={{ fontSize: '11px', color: C.textDimmer, fontFamily: MONO }}>
          {onToggle && !open ? 'collapsed' : ''}
        </span>
      )}
    </>
  );

  const style: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 0 12px',
    userSelect: 'none',
  };

  if (!onToggle) {
    return <div style={style}>{inner}</div>;
  }

  return (
    <div
      onClick={onToggle}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      role="button"
      tabIndex={0}
      aria-expanded={open}
      style={{ ...style, cursor: 'pointer' }}
    >
      {inner}
    </div>
  );
}

/* ------------------------------------------------------------------- atoms */

/** The 6px status dot. `title` carries the reason it is that colour. */
export function Dot({ color, title, size = 6 }: { color: string; title?: string; size?: number }) {
  return (
    <span
      title={title}
      style={{ width: `${size}px`, height: `${size}px`, flex: 'none', borderRadius: '50%', background: color }}
    />
  );
}

/** Tinted capsule: a coloured mark on a wash of the same hue. */
export function Pill({
  fg,
  bg,
  border,
  children,
  title,
}: {
  fg: string;
  bg: string;
  border: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        justifySelf: 'start',
        height: '20px',
        padding: '0 7px',
        borderRadius: '5px',
        fontSize: '10.5px',
        fontWeight: 600,
        letterSpacing: '0.03em',
        whiteSpace: 'nowrap',
        background: bg,
        border: `1px solid ${border}`,
        color: fg,
      }}
    >
      {children}
    </span>
  );
}

/** Muted mono text for namespaces, revisions and other machine values. */
export function Mono({
  C,
  children,
  title,
  color,
}: {
  C: EvoCloudPalette;
  children: React.ReactNode;
  title?: string;
  color?: string;
}) {
  return (
    <span
      title={title}
      style={{ ...CLIP, fontSize: '11.5px', fontFamily: MONO, color: color ?? C.textMuted, minWidth: 0 }}
    >
      {children}
    </span>
  );
}

/** Bordered mono chip — namespaces in card footers and table cells. */
export function Chip({ C, children, title }: { C: EvoCloudPalette; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      style={{
        ...CLIP,
        fontSize: '10.5px',
        fontFamily: MONO,
        color: C.textMuted,
        background: C.chip,
        border: `1px solid ${C.border}`,
        borderRadius: '4px',
        padding: '2px 6px',
        justifySelf: 'start',
        maxWidth: '100%',
      }}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------- stats */

export interface Stat {
  label: string;
  value: React.ReactNode;
  /** Small line under the value: a denominator, a version, a qualifier. */
  sub?: React.ReactNode;
  /** Colour of the value. Defaults to the body text colour. */
  tone?: string;
  /** Route name to link the whole tile to, e.g. `evocloud-gitops`. */
  route?: string;
}

export function StatGrid({ C, stats, min = '168px' }: { C: EvoCloudPalette; stats: Stat[]; min?: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(${min}, 1fr))`,
        gap: '12px',
        marginBottom: '26px',
      }}
    >
      {stats.map(s => {
        const inner = (
          <>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.11em',
                textTransform: 'uppercase',
                color: C.textFaint,
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                ...NUMERIC,
                fontSize: '24px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                color: s.tone ?? C.text,
              }}
            >
              {s.value}
            </div>
            {s.sub !== undefined && (
              <div style={{ ...NUMERIC, ...CLIP, fontSize: '11.5px', fontFamily: MONO, color: C.textDimmer }}>
                {s.sub}
              </div>
            )}
          </>
        );

        const style: React.CSSProperties = {
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          minWidth: 0,
          padding: '13px 14px 14px',
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: '10px',
          transition: 'border-color 140ms ease, background 140ms ease',
        };

        const href = s.route ? createRouteURL(s.route) : '';
        return href ? (
          <RouterLink key={s.label} to={href} className="evo-card evo-navcard" style={style}>
            {inner}
          </RouterLink>
        ) : (
          <div key={s.label} style={style}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------- table */

export interface Column<R> {
  key: string;
  label: string;
  /** A CSS grid track, e.g. `minmax(140px, 1.4fr)` or `96px`. */
  width: string;
  align?: 'left' | 'right';
  render: (row: R) => React.ReactNode;
}

/**
 * The list-view table from the catalog design, generalised.
 *
 * A CSS grid rather than a `<table>`: the header and every row share one track
 * list, so columns line up without the browser measuring content, and a long
 * URL clips instead of widening its column.
 */
export function DataTable<R>({
  C,
  columns,
  rows,
  rowKey,
}: {
  C: EvoCloudPalette;
  columns: Column<R>[];
  rows: R[];
  rowKey: (row: R, index: number) => string;
}) {
  const template = columns.map(c => c.width).join(' ');

  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: '10px',
        overflow: 'hidden',
        overflowX: 'auto',
        background: C.surface,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: template,
          gap: '10px',
          alignItems: 'center',
          padding: '9px 14px',
          background: C.surfaceSunken,
          borderBottom: `1px solid ${C.divider}`,
          fontSize: '10.5px',
          fontWeight: 700,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: C.textDimmer,
        }}
      >
        {columns.map(c => (
          <span key={c.key} style={{ textAlign: c.align ?? 'left' }}>
            {c.label}
          </span>
        ))}
      </div>
      {rows.map((row, i) => (
        <div
          key={rowKey(row, i)}
          className="evo-row"
          style={{
            display: 'grid',
            gridTemplateColumns: template,
            gap: '10px',
            alignItems: 'center',
            padding: '9px 14px',
            borderBottom: `1px solid ${C.dividerSoft}`,
            transition: 'background 120ms ease',
          }}
        >
          {columns.map(c => (
            <div
              key={c.key}
              style={{
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                justifyContent: c.align === 'right' ? 'flex-end' : 'flex-start',
              }}
            >
              {c.render(row)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- panel + kv */

/** A bordered panel with a small uppercase caption. */
export function Panel({
  C,
  caption,
  right,
  children,
}: {
  C: EvoCloudPalette;
  caption?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: '10px',
        overflow: 'hidden',
      }}
    >
      {caption && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '9px 14px',
            background: C.surfaceSunken,
            borderBottom: `1px solid ${C.divider}`,
            fontSize: '10.5px',
            fontWeight: 700,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: C.textDimmer,
          }}
        >
          <span>{caption}</span>
          <span style={{ flex: 1 }} />
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export interface KeyValue {
  k: string;
  v: React.ReactNode;
  color?: string;
}

export function KeyValues({ C, rows }: { C: EvoCloudPalette; rows: KeyValue[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', alignItems: 'baseline' }}>
      {rows.map(row => (
        <React.Fragment key={row.k}>
          <span style={{ fontSize: '11px', fontFamily: MONO, color: C.textDim, whiteSpace: 'nowrap' }}>{row.k}</span>
          <span
            style={{
              fontSize: '12px',
              color: row.color ?? C.textValue,
              fontFamily: row.color ? MONO : undefined,
              fontWeight: row.color ? 500 : undefined,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {row.v}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ format */

/** "4m", "3h", "6d" — how Kubernetes tooling reports ages. */
export function age(iso?: string | null): string {
  if (!iso) {
    return '—';
  }
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return '—';
  }
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 60) {
    return `${s}s`;
  }
  const m = Math.floor(s / 60);
  if (m < 60) {
    return `${m}m`;
  }
  const h = Math.floor(m / 60);
  if (h < 24) {
    return `${h}h`;
  }
  return `${Math.floor(h / 24)}d`;
}

/**
 * Shorten a digest-bearing revision for a table cell.
 *
 * Flux revisions look like `2.0.1@sha256:d1c1a200…` or `main@sha1:9f8c…`. The
 * tag is the part an operator reads; the digest is kept to seven characters so
 * two builds of the same tag stay distinguishable, and the whole value is on
 * the cell's `title` for copying.
 */
export function shortRevision(revision?: string | null): string {
  if (!revision) {
    return '—';
  }
  const at = revision.lastIndexOf('@');
  if (at === -1) {
    return revision;
  }
  const tag = revision.slice(0, at);
  const digest = revision.slice(at + 1).replace(/^[a-z0-9]+:/i, '');
  return `${tag}@${digest.slice(0, 7)}`;
}


/* -------------------------------------------------------------- side panel */

/** Below this the panel would leave no room for the page; navigate instead. */
const SIDE_PANEL_MIN_WIDTH = 900;

/**
 * True while the viewport is wide enough for a side panel to make sense.
 *
 * Headlamp drops its own drawer on small screens and falls back to a full page,
 * and the pages here do the same: below the breakpoint the detail link stays a
 * link. So the panel never becomes the only way to reach something.
 */
export function useSidePanelViable(): boolean {
  const [viable, setViable] = React.useState(
    () => typeof window === 'undefined' || window.innerWidth >= SIDE_PANEL_MIN_WIDTH
  );

  React.useEffect(() => {
    const onResize = () => setViable(window.innerWidth >= SIDE_PANEL_MIN_WIDTH);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return viable;
}

/** Top edge of Headlamp's content area, so the panel does not cover its header. */
function useMainTop(active: boolean): number {
  const read = () => document.getElementById('main')?.getBoundingClientRect().top ?? 0;
  const [top, setTop] = React.useState(read);

  React.useEffect(() => {
    if (!active) {
      return undefined;
    }
    const sync = () => setTop(read());
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [active]);

  return top;
}

/**
 * A detail view that slides in beside the list instead of replacing it.
 *
 * Headlamp shows resource details this way, but its own drawer renders
 * `KubeObjectDetails` for a Kubernetes object and nothing else — `Link.tsx`
 * explicitly skips it for anything with a plugin's own details route, because
 * its component map has no entry for one. So the behaviour is reproduced here
 * rather than reused: same shape, same place on screen, and the same two
 * accessibility details that make it a dialog rather than a floating div —
 * focus moves into it, and the page behind it goes `inert` so neither the
 * keyboard nor a screen reader wanders back out into content that is covered.
 *
 * Rendered through a portal so a card deep inside a `transform`ed or
 * `overflow: hidden` ancestor cannot clip it, and positioned from the top of
 * `#main` so it sits over the page without covering Headlamp's own header.
 */
export function SidePanel({
  C,
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  C: EvoCloudPalette;
  open: boolean;
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const top = useMainTop(open);

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);

    const main = document.getElementById('main');
    main?.setAttribute('inert', '');
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      main?.removeAttribute('inert');
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <>
      {/* Clicking away closes, the same as Escape. Deliberately unpainted:
          Headlamp's drawer dims nothing, and a scrim here would darken a page
          the panel is meant to be read alongside. */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: `${top}px 0 0 0`, zIndex: 1200 }}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: 'fixed',
          top,
          right: 0,
          bottom: 0,
          width: 'min(60vw, 760px)',
          zIndex: 1201,
          display: 'flex',
          flexDirection: 'column',
          background: C.bg,
          color: C.text,
          border: `1px solid ${C.border}`,
          borderRight: 0,
          borderRadius: '10px 0 0 10px',
          boxShadow: '-5px 0 20px rgba(0,0,0,0.28)',
          outline: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '14px 16px',
            borderBottom: `1px solid ${C.divider}`,
            background: C.surfaceSunken,
            borderRadius: '10px 0 0 0',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ ...CLIP, fontSize: '15px', fontWeight: 600 }}>{title}</div>
            {subtitle && (
              <div style={{ ...CLIP, marginTop: '3px', fontSize: '12px', color: C.textDim }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            className="evo-iconbtn"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close"
            style={{
              flex: 'none',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 0,
              borderRadius: '6px',
              color: C.textDim,
              cursor: 'pointer',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{children}</div>
      </div>
    </>,
    document.body
  );
}

/**
 * Intercept a plain left-click, leave every other click alone.
 *
 * The target stays a real `<a href>`: ctrl/cmd-click, middle-click and "open in
 * new tab" must still reach the full page, and a link that is not a link reads
 * as a button to a screen reader. Only the ordinary click becomes a panel.
 */
export function openInPanel(onOpen?: () => void) {
  return (e: React.MouseEvent) => {
    if (!onOpen || e.defaultPrevented || e.button !== 0) {
      return;
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    e.preventDefault();
    onOpen();
  };
}
