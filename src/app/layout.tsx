import type { Metadata } from "next";
import { ancizarSans, ancizarSerif } from "@/lib/fonts";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Akopia",
    template: "%s",
  },
  description:
    "Sistema de gestión del centro de acopio de la Universidad Nacional de Colombia, sede Manizales. Recibe, clasifica, almacena y entrega donaciones con trazabilidad.",
  applicationName: "AKOPIA",
  authors: [{ name: "Universidad Nacional de Colombia, sede Manizales" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${ancizarSans.variable} ${ancizarSerif.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
