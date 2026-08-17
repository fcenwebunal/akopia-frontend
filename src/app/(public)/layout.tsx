import { InstitutionalHeader } from "@/components/unal/institutional-header";
import { InstitutionalFooter } from "@/components/unal/institutional-footer";

/*
 * Superficie pública: lleva la identidad institucional completa.
 * La app de bodega vive en el grupo (app), con su propio layout móvil
 * primero, para que la plantilla no condicione pantallas que se usan
 * de pie y con una sola mano.
 */
export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-unal-green-dark focus:px-4 focus:py-2 focus:text-white"
      >
        Saltar al contenido principal
      </a>
      <InstitutionalHeader />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <InstitutionalFooter />
    </div>
  );
}
