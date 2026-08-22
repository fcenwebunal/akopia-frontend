import { NextRequest, NextResponse } from "next/server";

/*
 * CSP con nonce por petición, siguiendo el patrón oficial de Next.js
 * (https://nextjs.org/docs/app/guides/content-security-policy).
 *
 * Reemplaza la cabecera CSP que antes vivía en nginx (ver
 * akopia-backend/DESPLIEGUE.md) — no puede seguir ahí, porque nginx no
 * puede generar un valor aleatorio distinto en cada respuesta. Si
 * nginx volviera a agregar su propia cabecera Content-Security-Policy,
 * el navegador aplicaría las dos a la vez (intersección), y el nonce
 * de esta cabecera no coincidiría con la de la otra — bloqueando todo
 * script inline, incluidos los que sí traen el nonce correcto.
 *
 * script-src ya no lleva 'unsafe-inline': el propio Next.js aplica
 * este nonce a los scripts inline que él mismo inyecta (el payload de
 * React Server Components) en cuanto detecta el nonce en la cabecera.
 * El único script inline propio (tema claro/oscuro, en
 * src/app/layout.tsx) lo recibe a mano vía `headers()`.
 *
 * style-src se queda con 'unsafe-inline' a propósito — no es parte de
 * este cambio (ver PROPUESTA/reporte de ZAP, sección "script-src y
 * style-src con unsafe-inline"): un nonce no cubre atributos
 * style="..." y la aplicación usa varias decenas, muchos con valores
 * calculados en tiempo de ejecución.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' https://apis.google.com https://www.gstatic.com`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https://res.cloudinary.com https://*.basemaps.cartocdn.com https://*.openstreetmap.org`,
    `connect-src 'self' https://nominatim.openstreetmap.org https://api.cloudinary.com https://*.googleapis.com https://securetoken.googleapis.com https://apis.google.com`,
    `frame-src https://accounts.google.com https://akopia.firebaseapp.com`,
    `font-src 'self' data:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `frame-ancestors 'self'`,
    `form-action 'self'`,
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
