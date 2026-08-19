import { UnalShell } from "@/components/unal-template/unal-shell";

/*
 * Páginas informativas enlazadas desde el pie de página (directriz B3):
 * Mapa del sitio, FAQ, Glosario, Acerca de este sitio web. Contenido
 * público, sin `menuItems` (nadie necesita el menú de la app para leer
 * el mapa del sitio) y `boxed` por defecto (son páginas de texto, no
 * una campaña de ancho completo como la portada).
 */
export default function InfoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <UnalShell>{children}</UnalShell>;
}
