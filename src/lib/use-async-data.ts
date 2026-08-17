"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "./pb";

export interface AsyncData<T> {
  data: T | null;
  error: string | null;
  /** Vuelve a pedir los datos. Útil para el botón de reintentar. */
  reload: () => void;
}

/*
 * Carga datos de PocketBase en un componente de cliente.
 *
 * Existe para tener el efecto en un solo lugar: `react-hooks/set-state-in-effect`
 * marca cualquier función que acabe llamando a setState desde un efecto, aunque
 * lo haga después de un await. Pedir datos a un servicio externo es
 * precisamente para lo que sirve un efecto, así que la excepción se justifica
 * aquí una vez en vez de repetirse en cada pantalla.
 *
 * `fetcher` debe venir envuelto en useCallback, o el efecto se repite en cada
 * render.
 */
export function useAsyncData<T>(fetcher: () => Promise<T>): AsyncData<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    try {
      setData(await fetcher());
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [fetcher]);

  useEffect(() => {
    let active = true;

    fetcher()
      .then((result) => {
        if (active) {
          setData(result);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setError(errorMessage(err));
        }
      });

    return () => {
      active = false;
    };
  }, [fetcher]);

  return { data, error, reload: run };
}
