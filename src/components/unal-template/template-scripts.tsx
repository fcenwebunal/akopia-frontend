"use client";

import Script from "next/script";

/*
 * jQuery + Bootstrap + los dos scripts propios de la plantilla, en su
 * orden de dependencia. `unal.js` usa jQuery y arma el buscador de
 * Google (cx embebido, sin configuración); `accesibilidad.js` declara
 * las funciones globales que usan el panel de accesibilidad y el botón
 * de tema (ver src/types/unal-template.d.ts). Sin GSAP/Swiper/video.js:
 * son widgets de la demo que AKOPIA no usa.
 */
export function TemplateScripts() {
  return (
    <>
      <Script src="/unal-template/js/jquery.js" strategy="afterInteractive" />
      <Script
        src="/unal-template/js/bootstrap.bundle.min.js"
        strategy="afterInteractive"
      />
      <Script src="/unal-template/js/unal.js" strategy="afterInteractive" />
      <Script
        src="/unal-template/js/accesibilidad.js"
        strategy="afterInteractive"
      />
    </>
  );
}
