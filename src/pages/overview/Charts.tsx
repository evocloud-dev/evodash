/**
 * The Overview's two charts.
 *
 * Both are hand-drawn from divs rather than pulled from a charting library: the
 * plugin ships as a single bundle Headlamp loads, and a chart library would be
 * the largest thing in it by far for two figures this simple.
 *
 * Colour is assigned by the job it does, not by taste. The bar chart plots one
 * measure across categories — a single series, so every bar is one colour and
 * there is no legend to draw; identity comes from the row labels. The source bar
 * plots composition across three categories, so it takes the first three slots
 * of a categorical palette, in fixed order, never cycled.
 *
 * Those three slots were validated against the surfaces they actually sit on
 * (#ffffff light, #111624 dark) rather than assumed: all-pairs CVD ΔE 9.2 light
 * / 9.4 dark, normal-vision ΔE 24.0 / 20.9. One caveat rides on that result —
 * aqua is 2.82:1 against the light surface, under the 3:1 bar, which obliges
 * visible labels rather than colour alone. That is why the legend below the
 * source bar always spells out every count, and why the chart is not allowed to
 * be the only place a number appears.
 */
import { useTheme } from '@mui/material/styles';
import React from 'react';
import { EvoCloudPalette } from '../../palette';
import { CLIP, MONO, NUMERIC } from '../../ui/chrome';

/**
 * Categorical slots 1-3, stepped per mode for the surface they sit on.
 *
 * The dark row is the same three hues re-stepped for a dark ground, not an
 * automatic lightening of the light row.
 */
const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a'];
const SERIES_DARK = ['#3987e5', '#d95926', '#199e70'];

/** Single-series marks use slot 1 — one measure, one colour. */
export function useSeries(): string[] {
  const theme = useTheme();
  return theme.palette.mode === 'dark' ? SERIES_DARK : SERIES_LIGHT;
}

export interface Slice {
  label: string;
  value: number;
}

/* --------------------------------------------------------------- tooltip */

function useTooltip() {
  const [tip, setTip] = React.useState<{ x: number; y: number; text: string } | null>(null);

  const bind = (text: string) => ({
    onMouseEnter: (e: React.MouseEvent) => setTip({ x: e.clientX, y: e.clientY, text }),
    onMouseMove: (e: React.MouseEvent) => setTip({ x: e.clientX, y: e.clientY, text }),
    onMouseLeave: () => setTip(null),
  });

  return { tip, bind, clear: () => setTip(null) };
}

function Tooltip({ C, tip }: { C: EvoCloudPalette; tip: { x: number; y: number; text: string } }) {
  return (
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: tip.x + 12,
        top: tip.y + 14,
        zIndex: 1300,
        pointerEvents: 'none',
        padding: '5px 8px',
        borderRadius: '6px',
        background: C.surface,
        border: `1px solid ${C.border}`,
        boxShadow: '0 4px 14px rgba(0,0,0,0.28)',
        fontSize: '11.5px',
        color: C.text,
        whiteSpace: 'nowrap',
      }}
    >
      {tip.text}
    </div>
  );
}

/* ------------------------------------------------------------- bar chart */

/**
 * One measure across categories, largest first.
 *
 * Every bar carries its value at the tip, which is what lets the chart do
 * without an axis and without gridlines — direct labels before gridlines. A
 * chart of one bar is a stat tile with extra ink, so the caller is expected to
 * drop this below two rows.
 */
export function BarChart({
  C,
  rows,
  unit,
  max: maxProp,
}: {
  C: EvoCloudPalette;
  rows: Slice[];
  /** Singular noun for the tooltip: "schema" → "3 schemas". */
  unit: string;
  max?: number;
}) {
  const series = useSeries()[0];
  const { tip, bind } = useTooltip();
  const max = maxProp ?? Math.max(...rows.map(r => r.value), 1);
  const total = rows.reduce((n, r) => n + r.value, 0);

  return (
    <div>
      {rows.map(row => {
        const share = total > 0 ? Math.round((row.value / total) * 100) : 0;
        return (
          <div
            key={row.label}
            {...bind(`${row.label} — ${row.value} ${unit}${row.value === 1 ? '' : 's'} · ${share}%`)}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 150px) 1fr auto',
              alignItems: 'center',
              gap: '10px',
              padding: '4px 0',
              cursor: 'default',
            }}
          >
            <span style={{ ...CLIP, fontSize: '12px', color: C.textMuted }} title={row.label}>
              {row.label}
            </span>

            {/* The track is not a gridline — it is the slot the bar grows in,
                one step off the surface so the empty remainder stays legible. */}
            <span style={{ display: 'block', height: '14px', background: C.surfaceSunken, borderRadius: '2px' }}>
              <span
                style={{
                  display: 'block',
                  height: '100%',
                  width: `${Math.max((row.value / max) * 100, row.value > 0 ? 2 : 0)}%`,
                  background: series,
                  // Square at the baseline, rounded at the data end.
                  borderRadius: '2px 4px 4px 2px',
                }}
              />
            </span>

            <span style={{ ...NUMERIC, fontSize: '12px', fontWeight: 600, color: C.textValue, minWidth: '26px', textAlign: 'right' }}>
              {row.value}
            </span>
          </div>
        );
      })}
      {tip && <Tooltip C={C} tip={tip} />}
    </div>
  );
}

/* ---------------------------------------------------------- stacked bar */

/**
 * Composition of one whole across a few categories.
 *
 * The segments are separated by a 2px gap in the surface colour rather than by
 * a stroke — no border is drawn around a mark. Segment labels are deliberately
 * absent: at these counts a segment is routinely too narrow to hold text, and a
 * clipped label is worse than none, so the legend underneath carries every
 * value in full.
 */
export function StackedBar({ C, slices, unit }: { C: EvoCloudPalette; slices: Slice[]; unit: string }) {
  const series = useSeries();
  const { tip, bind } = useTooltip();
  const total = slices.reduce((n, s) => n + s.value, 0);
  const shown = slices.filter(s => s.value > 0);

  if (total === 0) {
    return null;
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '2px', height: '14px', marginBottom: '12px' }}>
        {shown.map(slice => {
          const i = slices.indexOf(slice);
          const share = Math.round((slice.value / total) * 100);
          return (
            <div
              key={slice.label}
              {...bind(`${slice.label} — ${slice.value} ${unit}${slice.value === 1 ? '' : 's'} · ${share}%`)}
              style={{
                flex: `${slice.value} 0 0`,
                background: series[i % series.length],
                borderRadius: '3px',
                cursor: 'default',
              }}
            />
          );
        })}
      </div>

      {/* Always present, and always with the number spelled out: identity never
          rests on colour alone, and one of these hues sits under 3:1 on the
          light surface, which obliges a visible label. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
        {slices.map((slice, i) => (
          <span key={slice.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <span
              style={{
                width: '9px',
                height: '9px',
                flex: 'none',
                borderRadius: '2px',
                background: series[i % series.length],
                opacity: slice.value > 0 ? 1 : 0.35,
              }}
            />
            <span style={{ ...CLIP, fontSize: '11.5px', color: C.textMuted }}>{slice.label}</span>
            <span style={{ ...NUMERIC, fontSize: '11.5px', fontWeight: 600, fontFamily: MONO, color: C.textValue }}>
              {slice.value}
            </span>
          </span>
        ))}
      </div>
      {tip && <Tooltip C={C} tip={tip} />}
    </div>
  );
}
