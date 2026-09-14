/*
 * Mirror of MOVEMENT_EFFECTS in akopia-backend/pb_hooks/utils/helpers.js,
 * collapsed to the effect on the TOTAL balance (available + reserved +
 * quarantine). Internal moves (reserve, release, relocate, send to or
 * release from review) net to zero, so only these seven change how much
 * physically sits in the warehouse. If the backend adds a movement type,
 * it has to be classified here too.
 */
export const TOTAL_EFFECT: Record<string, number> = {
  entrada: 1,
  cuarentena: 1,
  devolucion: 1,
  ajuste_positivo: 1,
  ajuste_negativo: -1,
  salida: -1,
  rechazo: -1,
};

export const INFLOW_TYPES = new Set(["entrada", "cuarentena", "devolucion"]);
export const OUTFLOW_TYPES = new Set(["salida"]);
export const WRITE_OFF_TYPES = new Set(["rechazo"]);
export const ADJUSTMENT_TYPES = new Set(["ajuste_positivo", "ajuste_negativo"]);
