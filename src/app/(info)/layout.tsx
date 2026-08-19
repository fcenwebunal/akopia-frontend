import { UnalShell } from "@/components/unal-template/unal-shell";

/*
 * Páginas informativas enlazadas desde el pie de página (directriz B3):
 * Mapa del sitio, FAQ, Glosario, Acerca de este sitio web. Contenido
 * público, sin el menú de la app (nadie lo necesita para leer el mapa
 * del sitio) y `boxed` por defecto (son páginas de texto, no una
 * campaña de ancho completo como la portada).
 *
 * La forma de volver ("Inicio" o "Volver al panel", según haya sesión)
 * la resuelve <HomeNavItem> dentro de <UnalHeader> — ver el comentario
 * ahí. Un `menuItems` estático con "Inicio" no bastaba: alguien con
 * sesión activa que cae en estas páginas (por ejemplo desde el pie de
 * página) necesita volver al panel, no al inicio público.
 */
export default function InfoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <UnalShell>{children}</UnalShell>;
}
