import type { UserRole } from "../pb";

export const REPORT_ROLES: UserRole[] = ["admin", "coordinacion", "comunicaciones"];

export type ReportSectionId =
  | "summary"
  | "donations"
  | "classification"
  | "flow"
  | "stock"
  | "requests"
  | "dispatches"
  | "adjustments"
  | "activity"
  | "methodology";

export interface ReportSectionDef {
  id: ReportSectionId;
  title: string;
  description: string;
  defaultOn: boolean;
  // The backend only lets these roles read what the section needs
  // (`adjustments` is admin/coordinación since migration 054).
  roles?: UserRole[];
}

export const REPORT_SECTIONS: ReportSectionDef[] = [
  {
    id: "summary",
    title: "Resumen ejecutivo",
    description: "Cifras clave del periodo, balance de kilos y un párrafo que lo resume todo.",
    defaultOn: true,
  },
  {
    id: "donations",
    title: "Donaciones recibidas",
    description: "Cuántas llegaron, de qué tipo de donante, por día y qué grupos de productos trajeron.",
    defaultOn: true,
  },
  {
    id: "classification",
    title: "Clasificación y calidad",
    description: "Qué pasó a disponible, qué quedó en revisión, qué se rechazó y qué sigue pendiente.",
    defaultOn: true,
  },
  {
    id: "flow",
    title: "Entradas, salidas y existencias",
    description: "Balance en kilos por grupo y los productos con más movimiento, sin listar el catálogo.",
    defaultOn: true,
  },
  {
    id: "stock",
    title: "Existencias actuales",
    description: "Disponible, reservado y en revisión hoy, por grupo y por ubicación, con alertas de mínimo.",
    defaultOn: true,
  },
  {
    id: "requests",
    title: "Solicitudes",
    description: "Estados, prioridades, beneficiarios, lo más pedido y la demanda que no se pudo cubrir.",
    defaultOn: true,
  },
  {
    id: "dispatches",
    title: "Despachos y entregas",
    description: "Despachos por día, entregas confirmadas, pendientes de confirmar y tiempos.",
    defaultOn: true,
  },
  {
    id: "adjustments",
    title: "Ajustes y bajas",
    description: "Correcciones manuales de inventario y rechazos, con sus motivos.",
    defaultOn: false,
    roles: ["admin", "coordinacion"],
  },
  {
    id: "activity",
    title: "Actividad del sistema",
    description: "Operaciones registradas por módulo y por día, a partir del historial.",
    defaultOn: false,
  },
  {
    id: "methodology",
    title: "Notas metodológicas",
    description: "Cómo se calculó cada cifra y qué limitaciones tiene la estimación en kilos.",
    defaultOn: true,
  },
];

export function sectionsForRoles(roles: UserRole[] | undefined): ReportSectionDef[] {
  const owned = roles ?? [];
  return REPORT_SECTIONS.filter(
    (section) => !section.roles || section.roles.some((role) => owned.includes(role))
  );
}
