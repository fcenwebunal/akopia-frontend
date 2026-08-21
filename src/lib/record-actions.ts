"use client";

import { callRoute } from "./pb";

export interface DeleteCheckResult {
  blocked: boolean;
  reason: string | null;
  mode: "delete" | "deactivate";
}

export function checkDeletable(collection: string, id: string) {
  return callRoute<DeleteCheckResult>(
    `/api/records/${collection}/${id}/delete-check`
  );
}

export function deleteRecordWithReason(
  collection: string,
  id: string,
  reason: string
) {
  return callRoute<{ id: string; mode: string }>(
    `/api/records/${collection}/${id}/delete`,
    { method: "POST", body: { reason } }
  );
}

/*
 * `changes` viaja como texto JSON, no como objeto anidado: el backend
 * usa DynamicModel para leer el cuerpo, y un campo objeto ahí no se
 * vincula a un objeto plano — solo los campos string/number sí (ver
 * 11_edit_delete_with_reason.pb.js).
 */
export function editRecordWithReason(
  collection: string,
  id: string,
  reason: string,
  changes: Record<string, unknown>
) {
  return callRoute<{ id: string; updated_fields: string[] }>(
    `/api/records/${collection}/${id}/edit`,
    { method: "POST", body: { reason, changes: JSON.stringify(changes) } }
  );
}
