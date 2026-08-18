"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { pb, type AkopiaUser } from "@/lib/pb";

/*
 * Guarda de sesión de la app de bodega, extraída de app-shell.tsx (que
 * antes mezclaba esto con su propio cromo visual, ya reemplazado por
 * <UnalShell>). pb.authStore vive en el navegador: la comprobación es
 * de cliente, un componente de servidor no la ve.
 */
export function useSessionGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AkopiaUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    function sync() {
      if (pb.authStore.isValid && pb.authStore.record) {
        const record = pb.authStore.record as unknown as AkopiaUser;
        setUser(record);

        // Una cuenta sin activar tiene token válido — Firebase no exige
        // aprobación de admin, eso lo decide PocketBase — pero cada
        // regla de acceso del backend exige `active = true`, así que
        // aquí solo vería listas vacías sin entender por qué.
        if (!record.active && pathname !== "/panel/pendiente") {
          router.replace("/panel/pendiente");
        }
      } else {
        setUser(null);
        router.replace("/login");
      }
      setChecked(true);
    }

    sync();
    return pb.authStore.onChange(sync);
  }, [router, pathname]);

  return { user, checked };
}
