import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Figure } from "@/lib/reports/types";
import { COLORS, TONE_COLORS } from "./pdf-theme";

const styles = StyleSheet.create({
  sectionHeader: {
    marginTop: 22,
    marginBottom: 8,
  },
  sectionOverline: {
    fontSize: 8,
    fontWeight: 700,
    color: COLORS.greenDark,
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 900,
    color: COLORS.ink,
    marginTop: 1,
  },
  sectionRule: {
    flexDirection: "row",
    marginTop: 6,
    height: 2,
  },
  sectionRuleAccent: {
    width: 36,
    backgroundColor: COLORS.green,
  },
  sectionRuleRest: {
    flex: 1,
    marginTop: 0.5,
    height: 1,
    backgroundColor: COLORS.rule,
  },
  paragraph: {
    fontSize: 9.5,
    lineHeight: 1.45,
    color: COLORS.ink2,
    marginTop: 6,
  },
  figureRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  figure: {
    flex: 1,
    borderWidth: 0.75,
    borderColor: COLORS.rule,
    borderLeftWidth: 3,
    borderRadius: 2,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  figureValue: {
    fontSize: 15,
    fontWeight: 900,
    color: COLORS.ink,
  },
  figureLabel: {
    fontSize: 7.5,
    color: COLORS.muted,
    marginTop: 2,
  },
  figureHint: {
    fontSize: 7,
    fontWeight: 700,
    color: COLORS.ink2,
    marginTop: 2,
  },
  block: {
    borderWidth: 0.75,
    borderColor: COLORS.rule,
    borderRadius: 3,
    padding: 10,
  },
  blockTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: COLORS.ink,
  },
  blockSubtitle: {
    fontSize: 7.5,
    color: COLORS.muted,
    marginTop: 1,
  },
  blockBody: {
    marginTop: 8,
  },
  columns: {
    flexDirection: "row",
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.surface2,
    borderBottomWidth: 0.75,
    borderBottomColor: COLORS.rule,
  },
  tableHeaderCell: {
    fontSize: 6.5,
    fontWeight: 700,
    color: COLORS.muted,
    letterSpacing: 0.4,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.rule,
  },
  tableTotalRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: COLORS.ink,
  },
  tableCell: {
    fontSize: 8,
    color: COLORS.ink,
    paddingVertical: 3.5,
    paddingHorizontal: 4,
  },
  note: {
    fontSize: 7.5,
    color: COLORS.muted,
    marginTop: 6,
    lineHeight: 1.35,
  },
  empty: {
    fontSize: 8.5,
    color: COLORS.muted,
  },
  bulletRow: {
    flexDirection: "row",
    marginTop: 3,
  },
  bulletMark: {
    width: 10,
    fontSize: 9,
    color: COLORS.greenDark,
  },
  bulletText: {
    flex: 1,
    fontSize: 8.5,
    lineHeight: 1.4,
    color: COLORS.ink2,
  },
});

export function SectionHeader({ number, title }: { number: number; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionOverline}>{String(number).padStart(2, "0")}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionRule}>
        <View style={styles.sectionRuleAccent} />
        <View style={styles.sectionRuleRest} />
      </View>
    </View>
  );
}

export function Paragraphs({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((text) => (
        <Text key={text} style={styles.paragraph}>
          {text}
        </Text>
      ))}
    </View>
  );
}

export function FigureRow({ figures, perRow = 4 }: { figures: Figure[]; perRow?: number }) {
  const rows: Figure[][] = [];
  for (let i = 0; i < figures.length; i += perRow) {
    rows.push(figures.slice(i, i + perRow));
  }

  return (
    <View wrap={false}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.figureRow}>
          {row.map((figure, i) => (
            <View
              key={figure.label}
              style={[
                styles.figure,
                { borderLeftColor: TONE_COLORS[figure.tone ?? "neutral"], marginLeft: i === 0 ? 0 : 8 },
              ]}
            >
              <Text style={styles.figureValue}>{figure.value}</Text>
              <Text style={styles.figureLabel}>{figure.label}</Text>
              {figure.hint ? <Text style={styles.figureHint}>{figure.hint}</Text> : null}
            </View>
          ))}
          {Array.from({ length: perRow - row.length }).map((_, i) => (
            <View key={`spacer-${i}`} style={{ flex: 1, marginLeft: 8 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// A Block always lives inside <Columns> (a row), even when it is alone:
// its `flex` would collapse its height inside a column container.
export function Block({
  title,
  subtitle,
  children,
  flex = 1,
  marginLeft = 0,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  flex?: number;
  marginLeft?: number;
}) {
  return (
    <View style={[styles.block, { flex, marginLeft }]} wrap={false}>
      <Text style={styles.blockTitle}>{title}</Text>
      {subtitle ? <Text style={styles.blockSubtitle}>{subtitle}</Text> : null}
      <View style={styles.blockBody}>{children}</View>
    </View>
  );
}

export function Columns({ children, marginTop = 10 }: { children: ReactNode; marginTop?: number }) {
  return <View style={[styles.columns, { marginTop }]}>{children}</View>;
}

export interface TableColumn {
  header: string;
  flex: number;
  align?: "left" | "right";
}

export function DataTable({
  columns,
  rows,
  total,
}: {
  columns: TableColumn[];
  rows: string[][];
  total?: string[];
}) {
  // `flex` goes on the wrapping View (a row child), never on the Text:
  // inside a column container react-pdf reads it as a zero height basis
  // and the row collapses onto its borders.
  const cell = (value: string, column: TableColumn, key: number, bold: boolean) => (
    <View key={key} style={{ flex: column.flex }}>
      <Text style={[styles.tableCell, { textAlign: column.align ?? "left", fontWeight: bold ? 700 : 400 }]}>
        {value}
      </Text>
    </View>
  );

  return (
    <View wrap={false}>
      <View style={styles.tableHeader}>
        {columns.map((column) => (
          <Text
            key={column.header}
            style={[styles.tableHeaderCell, { flex: column.flex, textAlign: column.align ?? "left" }]}
          >
            {column.header.toUpperCase()}
          </Text>
        ))}
      </View>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.tableRow}>
          {row.map((value, i) => cell(value, columns[i], i, i === 0))}
        </View>
      ))}
      {total ? (
        <View style={styles.tableTotalRow}>{total.map((value, i) => cell(value, columns[i], i, true))}</View>
      ) : null}
    </View>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <Text style={styles.note}>{children}</Text>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <Text style={styles.empty}>{children}</Text>;
}

export function Bullets({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow} wrap={false}>
          <Text style={styles.bulletMark}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}
