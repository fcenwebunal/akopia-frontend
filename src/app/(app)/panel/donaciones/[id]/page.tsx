"use client";

import { use, useCallback, useState } from "react";
import Link from "next/link";
import { errorMessage, pb } from "@/lib/pb";
import { useAsyncData } from "@/lib/use-async-data";
import { LoadingLine, Spinner } from "@/components/ui/spinner";

interface Item {
  id: string;
  quantity: number;
  classification_status: "pending" | "available" | "quarantine" | "rejected";
  expiry_date: string;
  batch_code: string;
  rejection_reason: string;
  expand?: {
    product_id?: { name?: string };
    unit_id?: { code?: string; name?: string };
  };
}

interface Donation {
  id: string;
  code: string;
  donor_name: string;
  donor_type: string;
  receipt_date: string;
  notes: string;
}

const STATUS_LABELS: Record<Item["classification_status"], string> = {
  pending: "Por clasificar",
  available: "Apto",
  quarantine: "En Revisión",
  rejected: "Rechazado",
};

const STATUS_STYLES: Record<Item["classification_status"], string> = {
  pending: "bg-(--surface-2) text-(--ink-2)",
  available: "bg-unal-green-soft text-unal-green-dark",
  quarantine: "bg-(--surface-2) text-unal-orange",
  rejected: "bg-(--surface-2) text-unal-red",
};

/*
 * Clasificar es lo que mueve el inventario: al pasar un artículo a apto o
 * a revisión, los hooks del backend generan el movimiento y ajustan el
 * saldo. Desde aquí solo se cambia el estado — nunca se toca `inventory`.
 */
export default function DonacionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [busy, setBusy] = useState<string | null>(null);
  const [busyStatus, setBusyStatus] = useState<Item["classification_status"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const fetchData = useCallback(async () => {
    const donation = await pb.collection("donations").getOne<Donation>(id);
    const items = await pb.collection("donation_items").getList<Item>(1, 200, {
      filter: `donation_id = "${id}"`,
      sort: "created",
      expand: "product_id,unit_id",
    });
    return { donation, items: items.items, version };
  }, [id, version]);

  const { data, error: loadError } = useAsyncData(fetchData);

  async function classify(item: Item, status: Item["classification_status"]) {
    setBusy(item.id);
    setBusyStatus(status);
    setError(null);

    try {
      await pb
        .collection("donation_items")
        .update(item.id, { classification_status: status });
      setVersion((current) => current + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
      setBusyStatus(null);
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
        {loadError}
      </p>
    );
  }

  if (!data) {
    return <LoadingLine />;
  }

  const pending = data.items.filter(
    (item) => item.classification_status === "pending"
  ).length;

  return (
    <div>
      <Link href="/panel/donaciones" className="text-sm font-bold text-unal-green-dark">
        ← Donaciones
      </Link>

      <h1 className="mt-2 font-mono text-2xl font-black tracking-tight text-unal-green-dark">
        {data.donation.code}
      </h1>
      <p className="mt-1 text-(--muted)">
        {data.donation.donor_name} ·{" "}
        {new Date(data.donation.receipt_date).toLocaleDateString("es-CO", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>
      {data.donation.notes ? (
        <p className="mt-2 text-sm text-(--ink-2)">{data.donation.notes}</p>
      ) : null}

      {pending > 0 ? (
        <p className="mt-4 rounded border-l-4 border-unal-yellow bg-(--surface) px-4 py-3 text-sm">
          <strong>{pending}</strong> artículo(s) sin clasificar. Hasta que no se
          clasifiquen no entran al inventario.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
          {error}
        </p>
      ) : null}

      <ul className="mt-5 space-y-3">
        {data.items.map((item) => {
          const status = item.classification_status;
          const locked = status === "available" || status === "quarantine";

          return (
            <li
              key={item.id}
              className="rounded border border-(--rule) bg-(--surface) p-4"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-bold">
                  {item.expand?.product_id?.name ?? "—"}
                </span>
                <span className="text-(--muted)">
                  {item.quantity}{" "}
                  {item.expand?.unit_id?.code ?? item.expand?.unit_id?.name ?? ""}
                </span>
                <span
                  className={`ml-auto rounded px-2 py-0.5 text-xs font-bold ${STATUS_STYLES[status]}`}
                >
                  {STATUS_LABELS[status]}
                </span>
              </div>

              {item.expiry_date || item.batch_code ? (
                <p className="mt-1 text-sm text-(--muted)">
                  {item.expiry_date
                    ? `Vence ${new Date(item.expiry_date).toLocaleDateString("es-CO")}`
                    : ""}
                  {item.expiry_date && item.batch_code ? " · " : ""}
                  {item.batch_code ? `Lote ${item.batch_code}` : ""}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {status !== "available" ? (
                  <button
                    type="button"
                    disabled={busy === item.id}
                    onClick={() => classify(item, "available")}
                    className="rounded bg-unal-green-dark px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {busy === item.id && busyStatus === "available" ? (
                      <>
                        <Spinner className="mr-2" />
                        Guardando…
                      </>
                    ) : status === "quarantine" ? (
                      "Liberar a disponible"
                    ) : (
                      "Marcar apto"
                    )}
                  </button>
                ) : null}

                {status !== "quarantine" ? (
                  <button
                    type="button"
                    disabled={busy === item.id}
                    onClick={() => classify(item, "quarantine")}
                    className="rounded border border-unal-orange px-4 py-2 text-sm font-bold text-unal-orange disabled:opacity-50"
                  >
                    {busy === item.id && busyStatus === "quarantine" ? (
                      <>
                        <Spinner className="mr-2" />
                        Guardando…
                      </>
                    ) : (
                      "A revisión"
                    )}
                  </button>
                ) : null}

                {!locked && status !== "rejected" ? (
                  <button
                    type="button"
                    disabled={busy === item.id}
                    onClick={() => classify(item, "rejected")}
                    className="rounded border border-(--rule) px-4 py-2 text-sm font-bold text-unal-red disabled:opacity-50"
                  >
                    {busy === item.id && busyStatus === "rejected" ? (
                      <>
                        <Spinner className="mr-2" />
                        Guardando…
                      </>
                    ) : (
                      "Rechazar"
                    )}
                  </button>
                ) : null}
              </div>

              {locked ? (
                <p className="mt-2 text-xs text-(--muted)">
                  Ya afectó inventario: para rechazarlo hay que hacer un ajuste.
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
