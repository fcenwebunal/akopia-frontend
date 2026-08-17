import { AppShell } from "@/components/app/app-shell";

/*
 * App de bodega: layout propio, móvil primero. No lleva la plantilla
 * institucional — estas pantallas se usan de pie y con una sola mano.
 * Ver la nota sobre la directriz B3 en CLAUDE.md.
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
