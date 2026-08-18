import type { Metadata } from "next";
import { ancizarSans, ancizarSerif } from "@/lib/fonts";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { TemplateScripts } from "@/components/unal-template/template-scripts";
import { TemplateStyles } from "@/components/unal-template/template-styles";
import "./globals.css";

// Formato exigido por la directriz B3: "Nombre del sitio | Universidad
// Nacional de Colombia".
export const metadata: Metadata = {
  title: {
    default: "AKOPIA | Universidad Nacional de Colombia",
    template: "%s | Universidad Nacional de Colombia",
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
        <TemplateStyles />
      </head>
      <body className="antialiased">
        {children}
        <TemplateScripts />
      </body>
    </html>
  );
}
