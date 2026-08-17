import localFont from "next/font/local";

/*
 * Ancízar es la tipografía institucional de la Universidad Nacional.
 * Los archivos vienen de la plantilla oficial de Unimedios y se sirven
 * desde el propio dominio: ningún CDN externo la distribuye, y la red
 * de la Universidad no siempre deja salir a uno.
 */

export const ancizarSans = localFont({
  src: [
    { path: "../fonts/ancizar_sans-light.woff2", weight: "300", style: "normal" },
    { path: "../fonts/ancizar_sans-regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ancizar_sans-bold.woff2", weight: "700", style: "normal" },
    { path: "../fonts/ancizar_sans-extrabold.woff2", weight: "800", style: "normal" },
    { path: "../fonts/ancizar_sans-black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-ancizar-sans",
  display: "swap",
});

export const ancizarSerif = localFont({
  src: [
    { path: "../fonts/ancizar_serif-regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ancizar_serif-bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-ancizar-serif",
  display: "swap",
});
