import { Path, Svg, Text, View } from "@react-pdf/renderer";
import { fmtDecimal, fmtInt, fmtPercent } from "@/lib/reports/format";
import type { LabeledValue, Segment, TimeChart } from "@/lib/reports/types";
import { COLORS, SERIES_COLORS } from "./pdf-theme";
import { Empty } from "./pdf-primitives";

/*
 * Static charts: a PDF has no hover, so every value a reader needs is
 * printed as a label, a legend figure or a table next to the chart.
 * Marks follow the dashboard's dataviz rules: one hue per magnitude,
 * rounded data end with a square baseline, a surface-colored gap
 * between touching fills, text always in ink tokens.
 */

function formatValue(value: number, unit?: string): string {
  const text = Math.abs(value) > 0 && Math.abs(value) < 10 && !Number.isInteger(value) ? fmtDecimal(value, 1) : fmtInt(value);
  return unit ? `${text} ${unit}` : text;
}

export function HorizontalBars({
  rows,
  unit,
  color = SERIES_COLORS.magnitude,
  emptyText = "Sin datos en el periodo.",
}: {
  rows: LabeledValue[];
  unit?: string;
  color?: string;
  emptyText?: string;
}) {
  if (rows.length === 0 || rows.every((row) => row.value <= 0)) {
    return <Empty>{emptyText}</Empty>;
  }

  const max = Math.max(...rows.map((row) => row.value));

  return (
    <View>
      {rows.map((row, i) => (
        <View key={`${row.label}-${i}`} style={{ marginTop: i === 0 ? 0 : 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 8, color: COLORS.ink, flex: 1, paddingRight: 6 }}>{row.label}</Text>
            <Text style={{ fontSize: 8, color: COLORS.ink2 }}>{formatValue(row.value, unit)}</Text>
          </View>
          <View style={{ marginTop: 2, height: 5, backgroundColor: COLORS.surface2, borderRadius: 2.5 }}>
            <View
              style={{
                width: `${Math.max(1.5, (row.value / max) * 100)}%`,
                height: 5,
                backgroundColor: color,
                borderTopRightRadius: 2.5,
                borderBottomRightRadius: 2.5,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function Swatch({ color }: { color: string }) {
  return <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color, marginRight: 4, marginTop: 1 }} />;
}

export function StackedBar({ segments, unit }: { segments: Segment[]; unit?: string }) {
  const total = segments.reduce((acc, segment) => acc + Math.max(0, segment.value), 0);
  if (total <= 0) return <Empty>Sin datos en el periodo.</Empty>;

  const visible = segments.filter((segment) => segment.value > 0);

  return (
    <View>
      <View style={{ flexDirection: "row", height: 14, borderRadius: 3, overflow: "hidden" }}>
        {visible.map((segment, i) => (
          <View
            key={segment.label}
            style={{
              width: `${(segment.value / total) * 100}%`,
              height: 14,
              backgroundColor: SERIES_COLORS[segment.color],
              borderLeftWidth: i === 0 ? 0 : 2,
              borderLeftColor: COLORS.surface,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: "row", marginTop: 7 }}>
        {segments.map((segment, i) => (
          <View key={segment.label} style={{ flex: 1, marginLeft: i === 0 ? 0 : 8 }}>
            <View style={{ flexDirection: "row" }}>
              <Swatch color={SERIES_COLORS[segment.color]} />
              <Text style={{ fontSize: 7.5, color: COLORS.muted }}>{segment.label}</Text>
            </View>
            <Text style={{ fontSize: 9, fontWeight: 700, color: COLORS.ink, marginTop: 1 }}>
              {formatValue(segment.value, unit)}{" "}
              <Text style={{ fontWeight: 400, color: COLORS.muted }}>({fmtPercent(Math.max(0, segment.value), total)})</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = { x: cx + r * Math.cos(startAngle), y: cy + r * Math.sin(startAngle) };
  const end = { x: cx + r * Math.cos(endAngle), y: cy + r * Math.sin(endAngle) };
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
}

export function Donut({
  segments,
  centerLabel,
  extra,
}: {
  segments: Segment[];
  centerLabel: string;
  extra?: (segment: Segment) => string | null;
}) {
  const total = segments.reduce((acc, segment) => acc + Math.max(0, segment.value), 0);
  if (total <= 0) return <Empty>Sin datos en el periodo.</Empty>;

  const size = 92;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const gapAngle = segments.filter((s) => s.value > 0).length > 1 ? 2.5 / radius : 0;

  const positive = segments.filter((segment) => segment.value > 0);
  const arcs = positive.map((segment, i) => {
    const before = positive.slice(0, i).reduce((acc, s) => acc + s.value, 0);
    const start = -Math.PI / 2 + (before / total) * Math.PI * 2;
    const sweep = (segment.value / total) * Math.PI * 2;
    const end = Math.max(start + 0.001, start + sweep - gapAngle);
    return { segment, start, end, full: sweep >= Math.PI * 2 - 0.0001 };
  });

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {arcs.flatMap(({ segment, start, end, full }) =>
            // An SVG arc cannot close on itself, so a single 100% segment
            // is drawn as two half circles.
            (full ? [[0, Math.PI], [Math.PI, Math.PI * 2]] : [[start, end]]).map(([from, to], i) => (
              <Path
                key={`${segment.label}-${i}`}
                d={arcPath(center, center, radius, from, to)}
                stroke={SERIES_COLORS[segment.color]}
                strokeWidth={stroke}
                fill="none"
              />
            ))
          )}
        </Svg>
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: size,
            height: size,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: 900, color: COLORS.ink }}>{fmtInt(total)}</Text>
          <Text style={{ fontSize: 6.5, color: COLORS.muted }}>{centerLabel}</Text>
        </View>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        {segments.map((segment, i) => {
          const detail = extra?.(segment);
          return (
            <View
              key={segment.label}
              style={{ flexDirection: "row", justifyContent: "space-between", marginTop: i === 0 ? 0 : 4 }}
            >
              <View style={{ flexDirection: "row" }}>
                <Swatch color={SERIES_COLORS[segment.color]} />
                <Text style={{ fontSize: 8, color: COLORS.ink2 }}>{segment.label}</Text>
              </View>
              <Text style={{ fontSize: 8, color: COLORS.ink, fontWeight: 700 }}>
                {fmtInt(segment.value)}{" "}
                <Text style={{ fontWeight: 400, color: COLORS.muted }}>
                  ({fmtPercent(segment.value, total)}){detail ? ` | ${detail}` : ""}
                </Text>
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function ColumnChart({ chart, height = 80 }: { chart: TimeChart; height?: number }) {
  const { buckets, series } = chart;
  const values = series.flatMap((s) => buckets.map((b) => s.values[b.key] ?? 0));
  const max = Math.max(0, ...values);
  if (max <= 0) return <Empty>Sin registros en el periodo.</Empty>;

  // Selective direct labels: only each series' peak carries a number;
  // the legend carries each series' total.
  const peakKey = new Map(
    series.map((s) => {
      let best = buckets[0]?.key ?? "";
      for (const bucket of buckets) {
        if ((s.values[bucket.key] ?? 0) > (s.values[best] ?? 0)) best = bucket.key;
      }
      return [s.label, best];
    })
  );

  // Axis labels span several columns so they never wrap inside one thin
  // column; each starts at the left edge of its first bucket.
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 8));
  const labelChunks: { key: string; label: string; span: number }[] = [];
  for (let i = 0; i < buckets.length; i += labelEvery) {
    labelChunks.push({ key: buckets[i].key, label: buckets[i].label, span: Math.min(labelEvery, buckets.length - i) });
  }

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: height + 12 }}>
        {buckets.map((bucket) => (
          <View
            key={bucket.key}
            style={{ flex: 1, height: height + 12, flexDirection: "row", alignItems: "flex-end", justifyContent: "center", paddingHorizontal: 0.75 }}
          >
            {series.map((s, i) => {
              const value = s.values[bucket.key] ?? 0;
              const barHeight = value > 0 ? Math.max(2, (value / max) * height) : 0;
              const isPeak = value > 0 && peakKey.get(s.label) === bucket.key;
              return (
                <View
                  key={s.label}
                  style={{ flex: 1, maxWidth: 10, marginLeft: i === 0 ? 0 : 0.75, alignItems: "center", justifyContent: "flex-end" }}
                >
                  {isPeak ? (
                    <Text style={{ width: 28, textAlign: "center", fontSize: 6.5, fontWeight: 700, color: COLORS.ink2, marginBottom: 1 }}>
                      {fmtInt(value)}
                    </Text>
                  ) : null}
                  <View
                    style={{
                      alignSelf: "stretch",
                      height: barHeight,
                      backgroundColor: SERIES_COLORS[s.color],
                      borderTopLeftRadius: 1.5,
                      borderTopRightRadius: 1.5,
                    }}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <View style={{ height: 0.75, backgroundColor: COLORS.rule }} />
      <View style={{ flexDirection: "row", marginTop: 2 }}>
        {labelChunks.map((chunk) => (
          <Text key={chunk.key} style={{ flex: chunk.span, fontSize: 6, color: COLORS.muted }}>
            {chunk.label}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", marginTop: 6 }}>
        {series.map((s, i) => {
          const total = buckets.reduce((acc, b) => acc + (s.values[b.key] ?? 0), 0);
          return (
            <View key={s.label} style={{ flexDirection: "row", marginLeft: i === 0 ? 0 : 12 }}>
              <Swatch color={SERIES_COLORS[s.color]} />
              <Text style={{ fontSize: 7.5, color: COLORS.ink2 }}>
                {s.label}: <Text style={{ fontWeight: 700, color: COLORS.ink }}>{fmtInt(total)}</Text>
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
