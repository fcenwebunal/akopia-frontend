"use client";

import { callRoute, pb, type UserRole } from "../pb";
import { toPbDate } from "./format";
import type { ReportSectionId } from "./sections";
import type {
  RawAdjustment,
  RawAuditEntry,
  RawCategory,
  RawDelivery,
  RawDispatch,
  RawDonation,
  RawDonationItem,
  RawGroup,
  RawInventoryRow,
  RawKit,
  RawLocation,
  RawMissingProduct,
  RawMovement,
  RawProduct,
  RawRequest,
  RawRequestItem,
  RawUnit,
  ReportRawData,
} from "./types";

interface FetchOptions {
  sections: ReportSectionId[];
  roles: UserRole[];
  includePersonalData: boolean;
  from: Date | null;
  to: Date;
}

const BATCH = 1000;

function full<T>(collection: string, fields: string, filter = ""): Promise<T[]> {
  return pb.collection(collection).getFullList<T>({ batch: BATCH, fields, filter });
}

/*
 * Every collection except the audit log is small enough (tens to a few
 * thousand rows) to read whole and filter by date in memory: balances
 * at the start of the period need movements from outside the period
 * anyway, and it avoids relation filters whose syntax differs between
 * PocketBase versions. Inactive catalog rows are kept on purpose: a
 * deactivated product still has history.
 */
export async function fetchReportData(options: FetchOptions): Promise<ReportRawData> {
  const wants = (id: ReportSectionId) => options.sections.includes(id);
  const canReadAdjustments = options.roles.some((role) => role === "admin" || role === "coordinacion");
  const canReadKits = options.roles.some((role) => role === "admin" || role === "coordinacion" || role === "salida");

  const auditFilter = [
    options.from ? `created >= "${toPbDate(options.from)}"` : "",
    `created <= "${toPbDate(options.to)}"`,
  ]
    .filter(Boolean)
    .join(" && ");

  const [
    products,
    categories,
    groups,
    units,
    locations,
    inventory,
    movements,
    donations,
    donationItems,
    requests,
    requestItems,
    dispatches,
    deliveries,
    kits,
    adjustments,
    audit,
    missingProducts,
  ] = await Promise.all([
    full<RawProduct>("products", "id,name,category_id,default_unit_id,weight_kg,min_stock_alert,active"),
    full<RawCategory>("categories", "id,name,group_id"),
    full<RawGroup>("groups", "id,name"),
    full<RawUnit>("units", "id,code,name"),
    full<RawLocation>("locations", "id,zone,shelf,position"),
    full<RawInventoryRow>("inventory", "product_id,location_id,available_qty,reserved_qty,quarantine_qty"),
    full<RawMovement>("inventory_movements", "movement_type,product_id,quantity,created,notes"),
    full<RawDonation>(
      "donations",
      "id,donor_type,donor_name,donor_id_number,total_weight_kg,classified_weight_kg,status,receipt_date"
    ),
    full<RawDonationItem>("donation_items", "donation_id,product_id,quantity,classification_status"),
    full<RawRequest>("requests", "id,status,priority,beneficiary_count,created,approved_at,source_kit_id"),
    full<RawRequestItem>("request_items", "request_id,product_id,quantity_requested,status"),
    full<RawDispatch>("dispatches", "id,request_id,dispatch_date,brigade,destination,destination_lat,destination_lng"),
    full<RawDelivery>("deliveries", "id,dispatch_id,delivery_date,status"),
    wants("requests") && canReadKits ? full<RawKit>("kits", "id,name") : Promise.resolve(null),
    wants("adjustments") && canReadAdjustments
      ? full<RawAdjustment>("adjustments", "product_id,difference,reason,created")
      : Promise.resolve(null),
    wants("activity") ? fetchAudit(auditFilter, options.includePersonalData) : Promise.resolve(null),
    wants("requests") || wants("summary")
      ? callRoute<{ items: RawMissingProduct[] }>("/api/requests/missing-products").then((r) => r.items)
      : Promise.resolve(null),
  ]);

  return {
    products,
    categories,
    groups,
    units,
    locations,
    inventory,
    movements,
    donations,
    donationItems,
    requests,
    requestItems,
    dispatches,
    deliveries,
    kits,
    adjustments,
    audit,
    missingProducts,
  };
}

interface AuditRow {
  entity_type: string;
  action: string;
  operator_id: string;
  created: string;
  expand?: { operator_id?: { full_name?: string } };
}

// Names only travel when the person asked for them. `users` view rules
// still apply to the expand, so Comunicaciones gets no names back.
async function fetchAudit(filter: string, withNames: boolean): Promise<RawAuditEntry[]> {
  const rows = await pb.collection("audit_log").getFullList<AuditRow>({
    batch: BATCH,
    filter,
    fields: withNames
      ? "entity_type,action,operator_id,created,expand.operator_id.full_name"
      : "entity_type,action,operator_id,created",
    expand: withNames ? "operator_id" : undefined,
  });

  return rows.map((row) => ({
    entity_type: row.entity_type,
    action: row.action,
    operator_id: row.operator_id,
    created: row.created,
    operator_name: row.expand?.operator_id?.full_name,
  }));
}
