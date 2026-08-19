"use client";

import Link from "next/link";
import { useCallback } from "react";
import { Gift } from "lucide-react";
import { pb } from "@/lib/pb";
import { useAsyncData } from "@/lib/use-async-data";
import { LoadingLine } from "@/components/ui/spinner";
import { LinkButton } from "@/components/ui/button";

interface Donation {
  id: string;
  code: string;
  donor_type: string;
  donor_name: string;
  receipt_date: string;
  expand?: { operator_id?: { full_name?: string } };
}

const DONOR_TYPES: Record<string, string> = {
  individual: "Persona",
  empresa: "Empresa",
  institucion: "Institución",
  anonimo: "Anónimo",
};

export default function DonacionesPage() {
  const fetchDonations = useCallback(async () => {
    const page = await pb.collection("donations").getList<Donation>(1, 50, {
      sort: "-receipt_date",
      expand: "operator_id",
    });
    return page.items;
  }, []);

  const { data: donations, error } = useAsyncData(fetchDonations);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Donaciones</h1>
          <p className="mt-1 text-(--muted)">
            Las últimas donaciones registradas. El código lo asigna el servidor.
          </p>
        </div>
        <LinkButton href="/panel/donaciones/nueva" icon={Gift}>
          Registrar donación
        </LinkButton>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-6 rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3"
        >
          {error}
        </p>
      ) : null}

      {donations === null && !error ? (
        <div className="mt-6">
          <LoadingLine />
        </div>
      ) : null}

      {donations !== null && donations.length === 0 ? (
        <div className="mt-6 rounded border border-(--rule) bg-(--surface) p-6">
          <p className="font-bold">Todavía no hay donaciones registradas.</p>
          <p className="mt-1 text-(--ink-2)">
            La pantalla de recepción es la siguiente que se va a construir.
          </p>
        </div>
      ) : null}

      {donations !== null && donations.length > 0 ? (
        <ul className="mt-6 space-y-2">
          {donations.map((donation) => (
            <li key={donation.id}>
              <Link
                href={`/panel/donaciones/${donation.id}`}
                className="block rounded border border-(--rule) bg-(--surface) p-4 hover:border-unal-green"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-bold text-unal-green-dark">{donation.donor_name}</span>
                  <span className="rounded bg-(--surface-2) px-2 py-0.5 text-xs text-(--muted)">
                    {DONOR_TYPES[donation.donor_type] ?? donation.donor_type}
                  </span>
                  <span className="ml-auto text-sm text-(--muted)">
                    {new Date(donation.receipt_date).toLocaleDateString("es-CO", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-(--muted)">
                  <span className="font-mono">{donation.code}</span>
                  {donation.expand?.operator_id?.full_name ? (
                    <span>· Recibió: {donation.expand.operator_id.full_name}</span>
                  ) : null}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
