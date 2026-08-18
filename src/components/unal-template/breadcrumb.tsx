"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Del más específico al más general: el primer prefijo que calce gana.
const LABELS: [string, string][] = [
  ["/login", "Iniciar sesión"],
  ["/registro", "Crear cuenta"],
  ["/panel/donaciones/nueva", "Nueva donación"],
  ["/panel/donaciones", "Donaciones"],
  ["/panel/solicitudes/nueva", "Nueva solicitud"],
  ["/panel/solicitudes/faltantes", "Productos faltantes"],
  ["/panel/solicitudes", "Solicitudes"],
  ["/panel/despachos/nueva", "Nuevo despacho"],
  ["/panel/despachos", "Despachos"],
  ["/panel/inventario", "Inventario"],
  ["/panel/ubicaciones", "Ubicaciones"],
  ["/panel/usuarios", "Usuarios"],
  ["/panel/historial", "Historial"],
  ["/panel/respaldos", "Respaldos"],
  ["/panel/pendiente", "Cuenta pendiente"],
  ["/panel", "Panel"],
];

function labelFor(pathname: string): string | null {
  for (const [prefix, label] of LABELS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return label;
  }
  return null;
}

/*
 * "Está en: Inicio / {página}", obligatoria en páginas internas por la
 * directriz B3. Se omite en la portada (no hace falta decir "está en
 * Inicio" estando ya en Inicio) — labelFor("/") no calza con nada.
 */
export function Breadcrumb() {
  const pathname = usePathname();
  const label = labelFor(pathname);
  if (!label) return null;

  return (
    <div className="breadcrumb-class">
      Está en:
      <Link href="/" title="Inicio">
        Inicio
      </Link>
      /<span>{label}</span>
    </div>
  );
}
