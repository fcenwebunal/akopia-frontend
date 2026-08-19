import { UnalShell } from "@/components/unal-template/unal-shell";

/*
 * Páginas informativas enlazadas desde el pie de página (directriz B3):
 * Mapa del sitio, FAQ, Glosario, Acerca de este sitio web. Contenido
 * público, sin el menú de la app (nadie lo necesita para leer el mapa
 * del sitio) y `boxed` por defecto (son páginas de texto, no una
 * campaña de ancho completo como la portada).
 *
 * `menuItems` lleva solo "Inicio": quien llega aquí desde el pie de
 * página o un enlace externo no tiene otra forma de volver al sitio.
 * Pedido explícito del 19 de agosto — "en todos los sitios que no sean
 * la página de inicio o la app".
 */
export default function InfoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <UnalShell menuItems={[{ label: "Inicio", href: "/" }]}>{children}</UnalShell>;
}
