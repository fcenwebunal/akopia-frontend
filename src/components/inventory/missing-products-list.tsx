import type { MissingProduct } from "@/lib/missing-products";

/*
 * Puramente presentacional: nada de `pb`, `fetch`, hooks de datos ni
 * sesión aquí adentro — solo `items` y, opcionalmente, cómo se ven la
 * carga y el error. Así lo puede montar tanto una página del panel
 * (con `fetchMissingProducts()` autenticado) como, más adelante, una
 * landing pública (con su propio fetcher, sin sesión) sin tocar una
 * sola línea de este archivo. Sin "use client": no usa hooks ni estado
 * propio, así que sirve igual desde un componente de servidor.
 *
 * `emptyMessage`/`title` son configurables porque el mismo componente
 * se lee distinto según quién lo mire: un operador ve "nada pendiente
 * de conseguir", una visita externa vería algo como "gracias, por ahora
 * no falta nada".
 */
export function MissingProductsList({
  items,
  loading = false,
  error = null,
  title = "Productos faltantes",
  emptyMessage = "No hay faltantes en este momento.",
}: {
  items: MissingProduct[];
  loading?: boolean;
  error?: string | null;
  title?: string;
  emptyMessage?: string;
}) {
  if (error) {
    return (
      <p role="alert" className="rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3 text-sm">
        {error}
      </p>
    );
  }

  if (loading) {
    return <p className="text-sm text-(--muted)">Cargando…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="rounded border border-(--rule) bg-(--surface) p-6 text-center">
        <p className="font-bold text-unal-green-dark">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div>
      {title ? (
        <h2 className="text-sm font-bold text-(--ink-2)">
          {title} <span className="font-normal text-(--muted)">({items.length})</span>
        </h2>
      ) : null}

      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <MissingProductCard key={item.product_id} item={item} />
        ))}
      </ul>
    </div>
  );
}

function MissingProductCard({ item }: { item: MissingProduct }) {
  const covered = item.requested_qty > 0 ? item.available_qty / item.requested_qty : 0;
  const coveredPct = Math.max(0, Math.min(1, covered)) * 100;

  return (
    <li className="rounded border border-(--rule) bg-(--surface) p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold leading-tight">{item.product_name}</p>
        <span className="shrink-0 rounded bg-(--surface-2) px-2 py-0.5 text-xs font-bold text-(--ink-2)">
          {item.category_name}
        </span>
      </div>

      <p className="mt-3 text-2xl font-black tabular-nums text-unal-red">
        {item.missing_qty}
        <span className="ml-1 text-sm font-bold text-(--muted)">{item.unit} faltan</span>
      </p>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-(--surface-2)">
        <div
          className="h-full rounded-full bg-unal-green"
          style={{ width: `${coveredPct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-(--muted)">
        {item.available_qty} de {item.requested_qty} {item.unit.toLowerCase()} pedidos ya están cubiertos
      </p>
    </li>
  );
}
