import type { MissingProduct } from "./missing-products";

/*
 * Fetcher del lado del servidor para la landing pública: sin `pb`, sin
 * sesión, un `fetch()` liso contra una ruta que ya está abierta al
 * público (`/api/requests/missing-products`, ver 05_routes.pb.js). No
 * importa `./pb` a propósito — ese módulo trae el SDK completo de
 * PocketBase, que esta página no necesita para un solo GET.
 *
 * `revalidate: 30` en vez de `no-store`: es una landing pública que
 * puede recibir tráfico real el mismo día que se publica, y refrescar
 * el dato cada medio minuto es más que suficiente para "qué donar
 * ahora" — no hace falta pegarle a PocketBase en cada visita.
 */
export async function fetchPublicMissingProducts(): Promise<MissingProduct[]> {
  // Servidor a servidor: siempre local, nunca la URL pública que ve el
  // navegador (ver src/lib/pb.ts sobre por qué esa se deja vacía/relativa).
  const base = process.env.PB_INTERNAL_URL ?? "http://127.0.0.1:8090";

  try {
    const response = await fetch(`${base}/api/requests/missing-products`, {
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as { items: MissingProduct[] };
    return data.items;
  } catch {
    // Sin backend disponible en el momento de construir/servir la
    // página, la landing igual debe verse — solo sin esta sección.
    return [];
  }
}
