import Image from "next/image";
import type { MissingProduct } from "@/lib/missing-products";
import { formatQuantity } from "@/lib/format";

/*
 * Sección pública de "qué donar ahora", alimentada por la misma ruta
 * que ya usa el panel (`/api/requests/missing-products`) — sin ningún
 * dato del solicitante, solo producto, foto y cuánto falta. Puramente
 * presentacional: la página la llama con lo que ya trajo el fetch del
 * servidor, así que esto no necesita "use client".
 */
export function MissingWanted({ items }: { items: MissingProduct[] }) {
  if (items.length === 0) {
    return (
      <section className="bg-[#f4f1fb] py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#3f7a3e]">
            Al día
          </p>
          <h2 className="mt-2 font-serif text-3xl font-bold italic text-[#1f4d2c] sm:text-4xl">
            Por ahora, ninguna solicitud está sin cubrir
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[#33452f]">
            Gracias a lo que ya ha llegado, el inventario alcanza para lo que se ha pedido.
            Vuelve pronto — esta lista se actualiza sola con cada solicitud nueva.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="lo-que-falta" className="bg-[#f4f1fb] py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center text-xs font-bold uppercase tracking-[0.14em] text-[#3f7a3e]">
          Actualizado en vivo
        </p>
        <h2 className="mt-2 text-center font-serif text-3xl font-bold italic text-[#1f4d2c] sm:text-4xl">
          Lo que hace falta ahora mismo
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-[#33452f]">
          Esto es exactamente lo que hay solicitado y todavía no alcanza en bodega. Si
          puedes traer alguno de estos productos, es justo lo que más ayuda hoy.
        </p>

        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <MissingCard key={item.product_id} item={item} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function MissingCard({ item }: { item: MissingProduct }) {
  const covered = item.requested_qty > 0 ? item.available_qty / item.requested_qty : 0;
  const coveredPct = Math.max(0, Math.min(1, covered)) * 100;

  return (
    <li className="flex gap-4 rounded-[18px] border border-black/5 bg-white p-4 shadow-[0_8px_24px_rgba(90,70,140,0.08)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_16px_30px_rgba(90,70,140,0.14)]">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#eaf6df]">
        {item.photo_url ? (
          <Image
            src={item.photo_url}
            alt=""
            width={80}
            height={80}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl font-black text-[#8fc93a]">
            {item.product_name.charAt(0)}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 min-w-0 font-bold leading-tight text-[#1f4d2c]">
            {item.product_name}
          </p>
          <span className="shrink-0 rounded-full bg-[#eaf6df] px-2 py-0.5 text-[11px] font-bold text-[#3f7a3e]">
            {item.category_name}
          </span>
        </div>

        <p className="mt-2 text-2xl font-black tabular-nums text-[#d9603a]">
          {formatQuantity(item.missing_qty)}
          <span className="ml-1 text-sm font-bold text-[#6b7d68]">
            {item.unit.toLowerCase()} faltan
          </span>
        </p>

        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#eaf6df]">
          <div className="h-full rounded-full bg-[#3f7a3e]" style={{ width: `${coveredPct}%` }} />
        </div>
        <p className="mt-1 text-xs text-[#6b7d68]">
          {formatQuantity(item.available_qty)} de {formatQuantity(item.requested_qty)} {item.unit.toLowerCase()} ya cubiertos
        </p>
      </div>
    </li>
  );
}
