"use client";

import { useCallback, useState } from "react";
import { Layers, Plus } from "lucide-react";
import { currentUser, errorMessage, pb } from "@/lib/pb";
import type { Kit } from "@/lib/kits";
import { hasAnyRole } from "@/lib/roles";
import { useAsyncData } from "@/lib/use-async-data";
import { useRouter } from "next/navigation";
import { LoadingLine, Spinner } from "@/components/ui/spinner";
import { LinkButton } from "@/components/ui/button";

const KIT_ROLES = ["admin", "coordinacion", "salida"] as const;

/*
 * Un kit es una plantilla de productos+cantidades para no repetir la
 * misma combinación cada vez que se registra una solicitud — se usa
 * desde /panel/solicitudes/nueva, no aquí. Esta pantalla es solo para
 * definir/ajustar las plantillas. Mismos roles que ya pueden crear
 * solicitudes (decisión explícita de Juan Manuel, 20 ago 2026): no hay
 * una capa "solo admin/coordinación edita la plantilla oficial".
 */
export default function KitsPage() {
  const operator = currentUser();
  const canManage = hasAnyRole(operator?.role, KIT_ROLES);
  const router = useRouter();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchKits = useCallback(async () => {
    // Sin filtrar por `active`: a diferencia del selector dentro de
    // solicitudes/nueva (que solo ofrece los activos), aquí conviene
    // ver también los retirados para poder reactivarlos.
    return pb.collection("kits").getFullList<Kit>({ sort: "-active,name" });
  }, []);

  const { data: kits, error: loadError, reload } = useAsyncData(fetchKits);

  async function toggleActive(kit: Kit) {
    setBusyId(kit.id);
    setError(null);
    try {
      await pb.collection("kits").update(kit.id, { active: !kit.active });
      reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (!canManage) {
    return (
      <p role="alert" className="rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
        Esta sección es para quienes pueden crear solicitudes: administración, coordinación o salida.
      </p>
    );
  }

  if (loadError) {
    return (
      <p role="alert" className="rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
        {loadError}
      </p>
    );
  }

  if (!kits) {
    return <LoadingLine />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Kits</h1>
          <p className="mt-1 text-(--muted)">
            Plantillas de productos y cantidades para no repetir la misma combinación en cada solicitud.
          </p>
        </div>
        <LinkButton href="/panel/kits/nueva" icon={Plus}>
          Nuevo kit
        </LinkButton>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
          {error}
        </p>
      ) : null}

      {kits.length === 0 ? (
        <div className="mt-6 rounded border border-(--rule) bg-(--surface) p-6">
          <p className="font-bold">Todavía no hay ningún kit.</p>
          <p className="mt-1 text-sm text-(--muted)">
            Crea uno con las combinaciones que más se repiten al armar una solicitud.
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-(--rule) overflow-hidden rounded border border-(--rule) bg-(--surface)">
          {kits.map((kit) => (
            <li key={kit.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => router.push(`/panel/kits/${kit.id}`)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-(--surface-2) text-(--muted)">
                  <Layers size={18} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium">
                    {kit.name}
                    {!kit.active ? (
                      <span className="ml-2 rounded bg-(--surface-2) px-1.5 py-0.5 text-xs font-normal text-unal-red">
                        desactivado
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-sm text-(--muted)">
                    {kit.description || "Sin descripción"}
                    {" · "}
                    usado {kit.use_count || 0} {kit.use_count === 1 ? "vez" : "veces"}
                  </p>
                </div>
              </button>
              <button
                type="button"
                disabled={busyId === kit.id}
                onClick={() => toggleActive(kit)}
                className="flex items-center gap-2 rounded border border-(--rule) px-3 py-1.5 text-sm font-bold disabled:opacity-50"
              >
                {busyId === kit.id ? <Spinner /> : null}
                {kit.active ? "Desactivar" : "Reactivar"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
