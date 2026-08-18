import { UnalShell } from "@/components/unal-template/unal-shell";

/*
 * Momento 2: login y registro. La franja de cuenta (<AccountBar>, ya
 * dentro de <UnalShell>) se ve algo redundante aquí —"Iniciar sesión"
 * arriba, el formulario debajo— pero es la consistencia que Juan Manuel
 * pidió explícitamente: la misma franja en las tres superficies.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <UnalShell>{children}</UnalShell>;
}
