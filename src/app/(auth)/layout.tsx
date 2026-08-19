import { UnalShell } from "@/components/unal-template/unal-shell";

/*
 * Momento 2: login y registro. La franja de cuenta (<AccountBar>, ya
 * dentro de <UnalShell>) se ve algo redundante aquí —"Iniciar sesión"
 * arriba, el formulario debajo— pero es la consistencia que Juan Manuel
 * pidió explícitamente: la misma franja en las tres superficies.
 *
 * `menuItems` con "Inicio": esta superficie no es la portada ni la app
 * (que ya tiene "Panel" como su propio hogar) — sin un enlace de vuelta
 * al sitio, quien entra aquí desde un enlace externo (o el pie de
 * página) no tiene cómo volver. No contradice la directriz de no
 * incluir "Inicio" en el menú de la app (menu-config.ts): esa regla es
 * sobre el menú DENTRO de la app, no sobre cómo volver a ella desde
 * afuera. Pedido explícito del 19 de agosto.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <UnalShell menuItems={[{ label: "Inicio", href: "/" }]}>{children}</UnalShell>;
}
