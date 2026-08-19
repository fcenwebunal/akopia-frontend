import type { LucideIcon } from "lucide-react";

/*
 * Mismo recurso decorativo que la catedral de la portada: un ícono de
 * fondo, más grande que su contenedor, empujado hacia la derecha un 25%
 * de su propio ancho — el padre (con `relative overflow-hidden`) recorta
 * justo esa porción contra el borde. `currentColor` hereda el color de
 * texto del botón/tarjeta, así que no hace falta un token de color aparte.
 */
export function CutIcon({
  icon: Icon,
  sizeClass = "h-9 w-9",
  className = "",
}: {
  icon: LucideIcon;
  sizeClass?: string;
  className?: string;
}) {
  return (
    <Icon
      aria-hidden="true"
      strokeWidth={1.5}
      className={`pointer-events-none absolute top-1/2 right-0 translate-x-1/4 -translate-y-1/2 ${sizeClass} ${className}`}
    />
  );
}
