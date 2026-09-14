import type { ReactNode } from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { fmtDateTime, fmtInt, fmtKg, fmtQty } from "@/lib/reports/format";
import { REPORT_SECTIONS, type ReportSectionId } from "@/lib/reports/sections";
import type { FlowRow, ReportData } from "@/lib/reports/types";
import { COLORS, FONT_FAMILY, SERIES_COLORS } from "./pdf-theme";
import {
  Block,
  Bullets,
  Columns,
  DataTable,
  Empty,
  FigureRow,
  Note,
  Paragraphs,
  SectionHeader,
  type TableColumn,
} from "./pdf-primitives";
import { ColumnChart, Donut, HorizontalBars, StackedBar } from "./pdf-charts";

const PAGE_PADDING_X = 40;

const styles = StyleSheet.create({
  page: {
    fontFamily: FONT_FAMILY,
    fontSize: 9.5,
    color: COLORS.ink,
    backgroundColor: COLORS.surface,
    paddingTop: 80,
    paddingBottom: 54,
    paddingHorizontal: PAGE_PADDING_X,
  },
  chrome: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  chromeBand: {
    height: 52,
    backgroundColor: COLORS.chrome,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: PAGE_PADDING_X,
  },
  chromeShield: {
    height: 38,
    width: 72,
  },
  chromeTitle: {
    fontSize: 8.5,
    fontWeight: 700,
    color: COLORS.surface,
    textAlign: "right",
  },
  chromeSubtitle: {
    fontSize: 7,
    color: COLORS.chromeText,
    textAlign: "right",
    marginTop: 1,
  },
  chromeStripe: {
    height: 3,
    backgroundColor: COLORS.green,
  },
  footer: {
    position: "absolute",
    bottom: 22,
    left: PAGE_PADDING_X,
    right: PAGE_PADDING_X,
    borderTopWidth: 0.75,
    borderTopColor: COLORS.rule,
    paddingTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: COLORS.muted,
  },
  coverOverline: {
    fontSize: 8,
    fontWeight: 700,
    color: COLORS.greenDark,
    letterSpacing: 1.2,
  },
  coverTitle: {
    fontSize: 24,
    fontWeight: 900,
    color: COLORS.ink,
    marginTop: 4,
    lineHeight: 1.15,
  },
  coverPeriod: {
    fontSize: 12,
    color: COLORS.ink2,
    marginTop: 4,
  },
  coverMeta: {
    fontSize: 8,
    color: COLORS.muted,
    marginTop: 6,
  },
  contents: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 0.75,
    borderTopColor: COLORS.rule,
    paddingTop: 8,
  },
  contentsItem: {
    width: "50%",
    flexDirection: "row",
    marginTop: 2,
  },
  contentsNumber: {
    width: 18,
    fontSize: 8,
    fontWeight: 700,
    color: COLORS.greenDark,
  },
  contentsLabel: {
    fontSize: 8,
    color: COLORS.ink2,
  },
  callout: {
    marginTop: 12,
    borderLeftWidth: 3,
    backgroundColor: COLORS.surface2,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  calloutTitle: {
    fontSize: 8,
    fontWeight: 700,
    color: COLORS.ink,
  },
  calloutText: {
    fontSize: 8.5,
    lineHeight: 1.4,
    color: COLORS.ink2,
    marginTop: 2,
  },
  balance: {
    flexDirection: "row",
    marginTop: 10,
    borderWidth: 0.75,
    borderColor: COLORS.rule,
    borderRadius: 3,
  },
  balanceCell: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 6,
  },
  balanceLabel: {
    fontSize: 6.5,
    color: COLORS.muted,
  },
  balanceValue: {
    fontSize: 11,
    fontWeight: 900,
    color: COLORS.ink,
    marginTop: 2,
  },
  tableTitle: {
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 4,
  },
});

export interface ReportAssets {
  shieldSrc: string;
}

export function ReportDocument({ data, assets }: { data: ReportData; assets: ReportAssets }) {
  const { meta } = data;
  const selected = REPORT_SECTIONS.filter((section) => meta.sections.includes(section.id));

  return (
    <Document
      title={`${meta.title} | ${meta.periodLabel}`}
      author="AKOPIA | Centro de Acopio UNAL Manizales"
      subject={meta.periodLabel}
      creator="AKOPIA"
      producer="AKOPIA"
      language="es-CO"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.chrome} fixed>
          <View style={styles.chromeBand}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
            <Image src={assets.shieldSrc} style={styles.chromeShield} />
            <View>
              <Text style={styles.chromeTitle}>AKOPIA | Centro de Acopio</Text>
              <Text style={styles.chromeSubtitle}>Universidad Nacional de Colombia, Sede Manizales</Text>
            </View>
          </View>
          <View style={styles.chromeStripe} />
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {meta.title} | {meta.periodLabel}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>

        <Cover data={data} selected={selected.map((section) => section.title)} />

        {selected.map((section, index) => {
          const { lead, rest } = sectionParts(section.id, data);
          return (
            <View key={section.id}>
              {/* The heading travels with the first block of its section,
                  so a page never ends on a lone title. */}
              <View wrap={false}>
                <SectionHeader number={index + 1} title={section.title} />
                {lead}
              </View>
              {rest}
            </View>
          );
        })}
      </Page>
    </Document>
  );
}

function Cover({ data, selected }: { data: ReportData; selected: string[] }) {
  const { meta } = data;
  return (
    <View>
      <Text style={styles.coverOverline}>INFORME DE GESTIÓN</Text>
      <Text style={styles.coverTitle}>{meta.title}</Text>
      <Text style={styles.coverPeriod}>{meta.periodLabel}</Text>
      <Text style={styles.coverMeta}>
        Generado el {fmtDateTime(meta.generatedAt)}
        {meta.generatedBy ? ` por ${meta.generatedBy}` : ""}. Fuente: registros de AKOPIA.
      </Text>

      <View style={styles.contents}>
        {selected.map((title, i) => (
          <View key={title} style={styles.contentsItem}>
            <Text style={styles.contentsNumber}>{String(i + 1).padStart(2, "0")}</Text>
            <Text style={styles.contentsLabel}>{title}</Text>
          </View>
        ))}
      </View>

      {meta.includePersonalData ? (
        <View style={[styles.callout, { borderLeftColor: COLORS.red }]}>
          <Text style={styles.calloutTitle}>Uso interno</Text>
          <Text style={styles.calloutText}>
            Este reporte incluye nombres de personas. No debe publicarse ni compartirse fuera del equipo.
          </Text>
        </View>
      ) : null}

      {meta.notes ? (
        <View style={[styles.callout, { borderLeftColor: COLORS.green }]}>
          <Text style={styles.calloutTitle}>Observaciones</Text>
          <Text style={styles.calloutText}>{meta.notes}</Text>
        </View>
      ) : null}
    </View>
  );
}

interface SectionParts {
  lead: ReactNode;
  rest: ReactNode;
}

function granularityNoun(granularity: "day" | "week" | "month"): string {
  return granularity === "day" ? "día" : granularity === "week" ? "semana" : "mes";
}

function TableBlock({ title, children, marginTop = 10 }: { title: ReactNode; children: ReactNode; marginTop?: number }) {
  return (
    <View style={{ marginTop }} wrap={false}>
      <Text style={styles.tableTitle}>{title}</Text>
      {children}
    </View>
  );
}

function sectionParts(id: ReportSectionId, data: ReportData): SectionParts {
  switch (id) {
    case "summary":
      return summaryParts(data);
    case "donations":
      return donationsParts(data);
    case "classification":
      return classificationParts(data);
    case "flow":
      return flowParts(data);
    case "stock":
      return stockParts(data);
    case "requests":
      return requestsParts(data);
    case "dispatches":
      return dispatchesParts(data);
    case "adjustments":
      return adjustmentsParts(data);
    case "activity":
      return activityParts(data);
    case "methodology":
      return { lead: <Bullets items={data.methodology.bullets} />, rest: null };
  }
}

function summaryParts(data: ReportData): SectionParts {
  const { summary, meta } = data;
  const { balance } = summary;
  const cells: { label: string; value: string }[] = [
    { label: "Existencia inicial", value: fmtKg(balance.start) },
    { label: "+ Entradas", value: fmtKg(balance.inflow) },
    { label: "- Salidas", value: fmtKg(balance.outflow) },
    { label: "- Bajas", value: fmtKg(balance.writeOff) },
    { label: "+/- Ajustes", value: fmtKg(balance.adjustments) },
    { label: meta.endsToday ? "= Existencia hoy" : "= Existencia final", value: fmtKg(balance.end) },
  ];

  return {
    lead: <FigureRow figures={summary.figures} perRow={3} />,
    rest: (
      <View>
        <Paragraphs items={summary.paragraphs} />
        <View wrap={false}>
          <View style={styles.balance}>
            {cells.map((cell, i) => (
              <View
                key={cell.label}
                style={[
                  styles.balanceCell,
                  {
                    borderLeftWidth: i === 0 ? 0 : 0.75,
                    borderLeftColor: COLORS.rule,
                    backgroundColor: i === cells.length - 1 ? COLORS.greenSoft : COLORS.surface,
                  },
                ]}
              >
                <Text style={styles.balanceLabel}>{cell.label}</Text>
                <Text style={styles.balanceValue}>{cell.value}</Text>
              </View>
            ))}
          </View>
          <Note>Balance del periodo en kilos estimados. Lo despachado sin entrega confirmada aún no cuenta como salida.</Note>
        </View>
        {summary.attention.length > 0 ? (
          <View style={[styles.callout, { borderLeftColor: COLORS.yellow }]} wrap={false}>
            <Text style={styles.calloutTitle}>Requiere atención a la fecha del reporte</Text>
            <Bullets items={summary.attention} />
          </View>
        ) : null}
      </View>
    ),
  };
}

// A section with nothing in the period keeps its figures and its one
// explanatory sentence, without a row of empty chart cards.
function emptyParts(figures: ReactNode, paragraphs: string[]): SectionParts {
  return { lead: figures, rest: <Paragraphs items={paragraphs} /> };
}

function donationsParts(data: ReportData): SectionParts {
  const { donations } = data;
  if (!donations.hasData) return emptyParts(<FigureRow figures={donations.figures} />, donations.paragraphs);
  return {
    lead: <FigureRow figures={donations.figures} />,
    rest: (
      <View>
        <Paragraphs items={donations.paragraphs} />
        <Columns>
          <Block
            title={`Donaciones por ${granularityNoun(donations.timeline.granularity)}`}
            subtitle="Según la fecha de recepción."
            flex={1.25}
          >
            <ColumnChart chart={donations.timeline} />
          </Block>
          <Block title="Tipo de donante" subtitle="Cantidad de donaciones y peso declarado." marginLeft={10}>
            <Donut
              segments={donations.donorTypes}
              centerLabel="donaciones"
              extra={(segment) => {
                const kg = donations.donorTypes.find((t) => t.label === segment.label)?.kg ?? 0;
                return kg > 0 ? fmtKg(kg) : null;
              }}
            />
          </Block>
        </Columns>
        <Columns>
          <Block title="Qué llegó, por grupo" subtitle="Artículos de las donaciones del periodo, en kg estimados.">
            <HorizontalBars rows={donations.kgByGroup} unit="kg" emptyText="Ningún artículo clasificado todavía." />
            {donations.itemsWithoutWeight > 0 ? (
              <Note>{fmtInt(donations.itemsWithoutWeight)} artículo(s) sin peso en el catálogo no suman aquí.</Note>
            ) : null}
          </Block>
          <Block title="Estado de las donaciones del periodo" marginLeft={10} flex={0.8}>
            <StackedBar
              segments={[
                { label: "Clasificadas", value: donations.reception.classified, color: "available" },
                { label: "En recepción", value: donations.reception.inReception, color: "quarantine" },
              ]}
            />
            <Note>Una donación en recepción ya llegó, pero todavía no se cierra su clasificación.</Note>
          </Block>
        </Columns>
        {donations.topDonors && donations.topDonors.length > 0 ? (
          <TableBlock title="Principales donantes">
            <DataTable
              columns={[
                { header: "Donante", flex: 3 },
                { header: "Tipo", flex: 1.2 },
                { header: "Donaciones", flex: 1, align: "right" },
                { header: "Peso declarado", flex: 1.2, align: "right" },
              ]}
              rows={donations.topDonors.map((d) => [d.name, d.type, fmtInt(d.donations), d.kg > 0 ? fmtKg(d.kg) : "sin dato"])}
            />
          </TableBlock>
        ) : null}
      </View>
    ),
  };
}

function classificationParts(data: ReportData): SectionParts {
  const { classification } = data;
  const check = classification.weightCheck;
  if (!classification.hasData) {
    return emptyParts(<FigureRow figures={classification.figures} />, classification.paragraphs);
  }
  return {
    lead: <FigureRow figures={classification.figures} />,
    rest: (
      <View>
        <Paragraphs items={classification.paragraphs} />
        <Columns>
          <Block title="Destino de lo clasificado" subtitle="Kilos estimados que ingresaron en el periodo." flex={1.3}>
            <StackedBar segments={classification.outcome} unit="kg" />
            <Note>Aprovechable suma lo que pasó directo a disponible y lo que se aprobó después de revisarlo.</Note>
          </Block>
          <Block title="Peso declarado frente a clasificado" subtitle="Donaciones con clasificación cerrada." marginLeft={10}>
            {check ? (
              <DataTable
                columns={[
                  { header: "Concepto", flex: 2 },
                  { header: "Valor", flex: 1, align: "right" },
                ]}
                rows={[
                  ["Donaciones comparadas", fmtInt(check.donations)],
                  ["Peso declarado", fmtKg(check.declaredKg)],
                  ["Peso clasificado", fmtKg(check.classifiedKg)],
                  ["Diferencia", fmtKg(check.classifiedKg - check.declaredKg)],
                ]}
              />
            ) : (
              <Empty>Ninguna donación del periodo tiene los dos pesos registrados.</Empty>
            )}
          </Block>
        </Columns>
        {classification.rejectionReasons.length > 0 ? (
          <TableBlock title="Motivos de rechazo más frecuentes">
            <DataTable
              columns={[
                { header: "Motivo", flex: 4 },
                { header: "Veces", flex: 0.8, align: "right" },
                { header: "Kilos", flex: 1, align: "right" },
              ]}
              rows={classification.rejectionReasons.map((r) => [r.reason, fmtInt(r.count), fmtKg(r.kg)])}
            />
          </TableBlock>
        ) : null}
      </View>
    ),
  };
}

function flowCells(row: FlowRow, showAdjustments: boolean): string[] {
  const cells = [row.label, fmtKg(row.start), fmtKg(row.inflow), fmtKg(row.outflow), fmtKg(row.writeOff)];
  if (showAdjustments) cells.push(fmtKg(row.adjustments));
  cells.push(fmtKg(row.end));
  return cells;
}

function flowParts(data: ReportData): SectionParts {
  const { flow, meta } = data;
  const showAdjustments = Math.abs(flow.total.adjustments) >= 0.05;
  const columns: TableColumn[] = [
    { header: "Grupo", flex: 2.6 },
    { header: "Inicial", flex: 1, align: "right" },
    { header: "Entradas", flex: 1, align: "right" },
    { header: "Salidas", flex: 1, align: "right" },
    { header: "Bajas", flex: 1, align: "right" },
    ...(showAdjustments ? [{ header: "Ajustes", flex: 1, align: "right" as const }] : []),
    { header: meta.endsToday ? "Hoy" : "Final", flex: 1, align: "right" },
  ];

  return {
    lead: <Paragraphs items={flow.paragraphs} />,
    rest: (
      <View>
        <TableBlock title="Balance por grupo de productos (kg estimados)">
          {flow.rows.length > 0 ? (
            <DataTable
              columns={columns}
              rows={flow.rows.map((row) => flowCells(row, showAdjustments))}
              total={flowCells(flow.total, showAdjustments)}
            />
          ) : (
            <Empty>No hay existencias ni movimientos en el periodo.</Empty>
          )}
        </TableBlock>
        {flow.topProducts.length > 0 ? (
          <TableBlock title={`Los ${fmtInt(flow.topProducts.length)} productos con más movimiento`} marginTop={12}>
            <DataTable
              columns={[
                { header: "Producto", flex: 2.6 },
                { header: "Unidad", flex: 1 },
                { header: "Entró", flex: 0.8, align: "right" },
                { header: "Salió", flex: 0.8, align: "right" },
                { header: "Bajas", flex: 0.8, align: "right" },
                { header: "Existencia", flex: 1, align: "right" },
                { header: "Kg aprox.", flex: 1, align: "right" },
              ]}
              rows={flow.topProducts.map((p) => [
                p.name,
                p.unit.toLowerCase(),
                fmtQty(p.inflow),
                fmtQty(p.outflow),
                fmtQty(p.writeOff),
                fmtQty(p.end),
                p.endKg === null ? "sin peso" : fmtKg(p.endKg),
              ])}
            />
            <Note>Cantidades en la unidad propia de cada producto, ordenados por kilos movidos (entradas, salidas y bajas).</Note>
          </TableBlock>
        ) : null}
      </View>
    ),
  };
}

function stockParts(data: ReportData): SectionParts {
  const { stock } = data;
  return {
    lead: <FigureRow figures={stock.figures} />,
    rest: (
      <View>
        <Paragraphs items={stock.paragraphs} />
        <Columns>
          <Block title="Distribución del inventario" subtitle="Kilos estimados en cada estado, a la fecha del reporte.">
            <StackedBar segments={stock.buckets} unit="kg" />
          </Block>
        </Columns>
        <Columns>
          <Block title="Existencia por grupo" subtitle="Total en bodega, en kg estimados.">
            <HorizontalBars rows={stock.byGroup} unit="kg" emptyText="Sin existencias." />
          </Block>
          <Block title="Existencia por ubicación" subtitle="Kg estimados por estado." marginLeft={10} flex={1.15}>
            {stock.byLocation.length > 0 ? (
              <DataTable
                columns={[
                  { header: "Ubicación", flex: 2 },
                  { header: "Disp.", flex: 1, align: "right" },
                  { header: "Reserv.", flex: 1, align: "right" },
                  { header: "Revisión", flex: 1, align: "right" },
                ]}
                rows={stock.byLocation.map((row) => [row.label, fmtKg(row.available), fmtKg(row.reserved), fmtKg(row.quarantine)])}
              />
            ) : (
              <Empty>Sin existencias.</Empty>
            )}
          </Block>
        </Columns>
        {stock.lowStock.length > 0 ? (
          <TableBlock
            title={`Por debajo del mínimo (${fmtInt(stock.lowStockCount)} en total${
              stock.lowStockCount > stock.lowStock.length ? `, se muestran los ${stock.lowStock.length} más críticos` : ""
            })`}
          >
            <DataTable
              columns={[
                { header: "Producto", flex: 3 },
                { header: "Unidad", flex: 1 },
                { header: "Disponible", flex: 1, align: "right" },
                { header: "Mínimo", flex: 1, align: "right" },
              ]}
              rows={stock.lowStock.map((p) => [p.name, p.unit.toLowerCase(), fmtQty(p.available), fmtQty(p.min)])}
            />
          </TableBlock>
        ) : null}
      </View>
    ),
  };
}

function MissingTable({ requests }: { requests: ReportData["requests"] }) {
  if (!requests.missing || requests.missing.length === 0) {
    return <Empty>Toda la demanda pendiente está cubierta.</Empty>;
  }
  return (
    <DataTable
      columns={[
        { header: "Producto", flex: 2.6 },
        { header: "Pedido", flex: 0.9, align: "right" },
        { header: "Hay", flex: 0.8, align: "right" },
        { header: "Falta", flex: 0.9, align: "right" },
      ]}
      rows={requests.missing.map((m) => [
        `${m.name} (${m.unit.toLowerCase()})`,
        fmtQty(m.requested),
        fmtQty(m.available),
        fmtQty(m.missing),
      ])}
    />
  );
}

function requestsParts(data: ReportData): SectionParts {
  const { requests } = data;
  if (!requests.hasData) {
    return {
      lead: <FigureRow figures={requests.figures} />,
      rest: (
        <View>
          <Paragraphs items={requests.paragraphs} />
          {requests.missingCount > 0 ? (
            <TableBlock title="Demanda sin cubrir hoy">
              <MissingTable requests={requests} />
            </TableBlock>
          ) : null}
        </View>
      ),
    };
  }
  return {
    lead: <FigureRow figures={requests.figures} />,
    rest: (
      <View>
        <Paragraphs items={requests.paragraphs} />
        <Columns>
          <Block title="Solicitudes por estado" subtitle="Estado actual de las solicitudes del periodo.">
            <HorizontalBars rows={requests.byStatus} color={SERIES_COLORS.reserved} />
          </Block>
          <Block title="Por prioridad" subtitle="Cómo se declaró la urgencia." marginLeft={10} flex={0.8}>
            <HorizontalBars rows={requests.byPriority} color={SERIES_COLORS.reserved} />
            {requests.kits && requests.kits.length > 0 ? (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.tableTitle}>Kits más usados</Text>
                <HorizontalBars rows={requests.kits} color={SERIES_COLORS.reserved} />
              </View>
            ) : null}
          </Block>
        </Columns>
        <Columns>
          <Block title="Lo más pedido" subtitle="Kilos estimados solicitados en el periodo.">
            <HorizontalBars rows={requests.topRequested} unit="kg" color={SERIES_COLORS.reserved} />
          </Block>
          <Block
            title="Demanda sin cubrir hoy"
            subtitle={`Solicitudes pendientes sin existencia suficiente (${fmtInt(requests.missingCount)} productos).`}
            marginLeft={10}
            flex={1.2}
          >
            <MissingTable requests={requests} />
          </Block>
        </Columns>
      </View>
    ),
  };
}

function dispatchesParts(data: ReportData): SectionParts {
  const { dispatches } = data;
  const hasBrigades = dispatches.brigades.length > 0;
  if (!dispatches.hasData) return emptyParts(<FigureRow figures={dispatches.figures} />, dispatches.paragraphs);
  return {
    lead: <FigureRow figures={dispatches.figures} />,
    rest: (
      <View>
        <Paragraphs items={dispatches.paragraphs} />
        <Columns>
          <Block title={`Despachos y entregas confirmadas por ${granularityNoun(dispatches.timeline.granularity)}`}>
            <ColumnChart chart={dispatches.timeline} />
          </Block>
        </Columns>
        <Columns>
          <Block title="Resultado de las entregas" subtitle="Entregas confirmadas en el periodo.">
            <HorizontalBars rows={dispatches.deliveryStatus} color={SERIES_COLORS.available} emptyText="Ninguna entrega confirmada." />
          </Block>
          {hasBrigades ? (
            <Block title="Despachos por brigada" subtitle="Equipo registrado en cada despacho." marginLeft={10}>
              <HorizontalBars rows={dispatches.brigades} color={SERIES_COLORS.reserved} />
            </Block>
          ) : (
            <View style={{ flex: 1, marginLeft: 10 }} />
          )}
        </Columns>
      </View>
    ),
  };
}

function adjustmentsParts(data: ReportData): SectionParts {
  const { adjustments } = data;
  if (!adjustments) {
    return { lead: <Empty>Esta sección solo está disponible para Administración y Coordinación.</Empty>, rest: null };
  }
  return {
    lead: <FigureRow figures={adjustments.figures} perRow={3} />,
    rest: (
      <View>
        <Paragraphs items={adjustments.paragraphs} />
        {adjustments.recent.length > 0 ? (
          <TableBlock title="Ajustes más recientes">
            <DataTable
              columns={[
                { header: "Fecha", flex: 0.8 },
                { header: "Producto", flex: 2 },
                { header: "Diferencia", flex: 1.1, align: "right" },
                { header: "Motivo", flex: 3.2 },
              ]}
              rows={adjustments.recent.map((a) => [a.date, a.product, a.difference.toLowerCase(), a.reason])}
            />
          </TableBlock>
        ) : null}
        {adjustments.rejectionReasons.length > 0 ? (
          <TableBlock title="Rechazos por motivo">
            <DataTable
              columns={[
                { header: "Motivo", flex: 4 },
                { header: "Veces", flex: 0.8, align: "right" },
                { header: "Kilos", flex: 1, align: "right" },
              ]}
              rows={adjustments.rejectionReasons.map((r) => [r.reason, fmtInt(r.count), fmtKg(r.kg)])}
            />
          </TableBlock>
        ) : null}
      </View>
    ),
  };
}

function activityParts(data: ReportData): SectionParts {
  const { activity } = data;
  if (!activity) return { lead: <Empty>Sin datos del historial.</Empty>, rest: null };
  if (!activity.hasData) return emptyParts(<FigureRow figures={activity.figures} perRow={3} />, activity.paragraphs);
  return {
    lead: <FigureRow figures={activity.figures} perRow={3} />,
    rest: (
      <View>
        <Paragraphs items={activity.paragraphs} />
        <Columns>
          <Block title={`Operaciones por ${granularityNoun(activity.timeline.granularity)}`}>
            <ColumnChart chart={activity.timeline} height={60} />
          </Block>
        </Columns>
        <Columns>
          <Block title="Por módulo">
            <HorizontalBars rows={activity.byEntity} />
          </Block>
          <Block title="Por tipo de operación" marginLeft={10}>
            <HorizontalBars rows={activity.byAction} />
          </Block>
        </Columns>
        {activity.topOperators ? (
          <Columns>
            <Block title="Operaciones por persona" subtitle="Uso interno.">
              <HorizontalBars rows={activity.topOperators} />
            </Block>
          </Columns>
        ) : null}
      </View>
    ),
  };
}
