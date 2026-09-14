import type { ReportSectionId } from "./sections";

export interface RawProduct {
  id: string;
  name: string;
  category_id: string;
  default_unit_id: string;
  weight_kg?: number | null;
  min_stock_alert?: number | null;
  active?: boolean;
}

export interface RawCategory {
  id: string;
  name: string;
  group_id: string;
}

export interface RawGroup {
  id: string;
  name: string;
}

export interface RawUnit {
  id: string;
  code: string;
  name: string;
}

export interface RawLocation {
  id: string;
  zone: string;
  shelf?: string;
  position?: string;
}

export interface RawInventoryRow {
  product_id: string;
  location_id: string;
  available_qty: number;
  reserved_qty: number;
  quarantine_qty: number;
}

export interface RawMovement {
  movement_type: string;
  product_id: string;
  quantity: number;
  created: string;
  notes?: string;
}

export interface RawDonation {
  id: string;
  donor_type: string;
  donor_name?: string;
  donor_id_number?: string;
  total_weight_kg?: number | null;
  classified_weight_kg?: number | null;
  status?: string;
  receipt_date: string;
}

export interface RawDonationItem {
  donation_id: string;
  product_id: string;
  quantity: number;
  classification_status: string;
}

export interface RawRequest {
  id: string;
  status: string;
  priority: string;
  beneficiary_count?: number | null;
  created: string;
  approved_at?: string;
  source_kit_id?: string;
}

export interface RawRequestItem {
  request_id: string;
  product_id: string;
  quantity_requested: number;
  status: string;
}

export interface RawDispatch {
  id: string;
  request_id: string;
  dispatch_date: string;
  brigade?: string;
  destination?: string;
  destination_lat?: number | null;
  destination_lng?: number | null;
}

export interface RawDelivery {
  id: string;
  dispatch_id: string;
  delivery_date: string;
  status: string;
}

export interface RawKit {
  id: string;
  name: string;
}

export interface RawAdjustment {
  product_id: string;
  difference: number;
  reason: string;
  created: string;
}

export interface RawAuditEntry {
  entity_type: string;
  action: string;
  operator_id: string;
  created: string;
  operator_name?: string;
}

export interface RawMissingProduct {
  product_name: string;
  unit: string;
  requested_qty: number;
  available_qty: number;
  missing_qty: number;
}

export interface ReportRawData {
  products: RawProduct[];
  categories: RawCategory[];
  groups: RawGroup[];
  units: RawUnit[];
  locations: RawLocation[];
  inventory: RawInventoryRow[];
  movements: RawMovement[];
  donations: RawDonation[];
  donationItems: RawDonationItem[];
  requests: RawRequest[];
  requestItems: RawRequestItem[];
  dispatches: RawDispatch[];
  deliveries: RawDelivery[];
  kits: RawKit[] | null;
  adjustments: RawAdjustment[] | null;
  audit: RawAuditEntry[] | null;
  missingProducts: RawMissingProduct[] | null;
}

export interface ReportOptions {
  title: string;
  notes: string;
  sections: ReportSectionId[];
  includePersonalData: boolean;
  from: Date | null;
  to: Date;
  generatedBy: string;
  generatedAt: Date;
}

export type Tone = "neutral" | "good" | "warning" | "critical";

export type SeriesColor =
  | "available"
  | "reserved"
  | "quarantine"
  | "magnitude"
  | "rejected"
  | "donorIndividual"
  | "donorEmpresa"
  | "donorInstitucion"
  | "donorAnonimo";

export interface Figure {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}

export interface LabeledValue {
  label: string;
  value: number;
}

export interface Segment {
  label: string;
  value: number;
  color: SeriesColor;
}

export interface TimeBucket {
  key: string;
  label: string;
}

export interface TimeSeries {
  label: string;
  color: SeriesColor;
  values: Record<string, number>;
}

export interface TimeChart {
  granularity: "day" | "week" | "month";
  buckets: TimeBucket[];
  series: TimeSeries[];
}

export interface FlowRow {
  label: string;
  start: number;
  inflow: number;
  outflow: number;
  writeOff: number;
  adjustments: number;
  end: number;
}

export interface ProductFlowRow {
  name: string;
  unit: string;
  inflow: number;
  outflow: number;
  writeOff: number;
  end: number;
  endKg: number | null;
}

export interface ReportMeta {
  title: string;
  periodLabel: string;
  from: Date;
  to: Date;
  generatedAt: Date;
  generatedBy: string;
  notes: string;
  includePersonalData: boolean;
  sections: ReportSectionId[];
  endsToday: boolean;
}

export interface SummarySection {
  paragraphs: string[];
  figures: Figure[];
  balance: { start: number; inflow: number; outflow: number; writeOff: number; adjustments: number; end: number };
  attention: string[];
}

export interface DonationsSection {
  hasData: boolean;
  count: number;
  identifiedDonors: number;
  anonymous: number;
  declaredKg: number;
  declaredCount: number;
  paragraphs: string[];
  figures: Figure[];
  timeline: TimeChart;
  donorTypes: (Segment & { kg: number })[];
  reception: { inReception: number; classified: number };
  kgByGroup: LabeledValue[];
  itemsWithoutWeight: number;
  topDonors: { name: string; type: string; donations: number; kg: number }[] | null;
}

export interface ClassificationSection {
  hasData: boolean;
  paragraphs: string[];
  figures: Figure[];
  outcome: Segment[];
  weightCheck: { donations: number; declaredKg: number; classifiedKg: number } | null;
  rejectionReasons: { reason: string; count: number; kg: number }[];
  pendingNow: { items: number; donationsInReception: number; quarantineKg: number };
}

export interface FlowSection {
  paragraphs: string[];
  rows: FlowRow[];
  total: FlowRow;
  topProducts: ProductFlowRow[];
  pendingConfirmationKg: number;
}

export interface StockSection {
  paragraphs: string[];
  figures: Figure[];
  buckets: Segment[];
  byGroup: LabeledValue[];
  byLocation: { label: string; available: number; reserved: number; quarantine: number }[];
  lowStock: { name: string; unit: string; available: number; min: number }[];
  lowStockCount: number;
}

export interface RequestsSection {
  hasData: boolean;
  paragraphs: string[];
  figures: Figure[];
  byStatus: LabeledValue[];
  byPriority: LabeledValue[];
  topRequested: LabeledValue[];
  missing: { name: string; unit: string; requested: number; available: number; missing: number }[] | null;
  missingCount: number;
  kits: LabeledValue[] | null;
}

export interface DispatchesSection {
  hasData: boolean;
  paragraphs: string[];
  figures: Figure[];
  timeline: TimeChart;
  deliveryStatus: LabeledValue[];
  brigades: LabeledValue[];
}

export interface AdjustmentsSection {
  paragraphs: string[];
  figures: Figure[];
  recent: { date: string; product: string; difference: string; reason: string }[];
  rejectionReasons: { reason: string; count: number; kg: number }[];
}

export interface ActivitySection {
  hasData: boolean;
  paragraphs: string[];
  figures: Figure[];
  timeline: TimeChart;
  byEntity: LabeledValue[];
  byAction: LabeledValue[];
  topOperators: LabeledValue[] | null;
}

export interface MethodologySection {
  bullets: string[];
}

export interface ReportData {
  meta: ReportMeta;
  summary: SummarySection;
  donations: DonationsSection;
  classification: ClassificationSection;
  flow: FlowSection;
  stock: StockSection;
  requests: RequestsSection;
  dispatches: DispatchesSection;
  adjustments: AdjustmentsSection | null;
  activity: ActivitySection | null;
  methodology: MethodologySection;
}
