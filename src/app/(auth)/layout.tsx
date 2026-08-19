import { UnalShell } from "@/components/unal-template/unal-shell";

/*
 * Momento 2: login y registro. La franja de cuenta (<AccountBar>, ya
 * dentro de <UnalShell>) se ve algo redundante aquí —"Iniciar sesión"
 * arriba, el formulario debajo— pero es la consistencia que Juan Manuel
 * pidió explícitamente: la misma franja en las tres superficies.
 *
 * La forma de volver ("Inicio" o "Volver al panel", según haya sesión)
 * la resuelve <HomeNavItem> dentro de <UnalHeader> — se ajusta sola
 * según el estado real de la sesión, cosa que un `menuItems` estático
 * no podía (alguien con sesión activa que cae aquí necesita volver al
 * panel, no al inicio).
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <UnalShell>{children}</UnalShell>;
}
