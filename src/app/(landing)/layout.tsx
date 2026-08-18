import { UnalShell } from "@/components/unal-template/unal-shell";

/*
 * Momento 1: la portada pública. Campaña de ancho completo ("Unidos por
 * Manizales"), por eso boxed=false — no lleva el margen de `.detalle`
 * que sí usan las páginas internas. El cabezote y el pie son los reales
 * de la plantilla UNAL; el menú principal va vacío (la directriz B3
 * prohíbe enlazar a "Inicio" desde el propio menú).
 */
export default function LandingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <UnalShell boxed={false}>{children}</UnalShell>;
}
