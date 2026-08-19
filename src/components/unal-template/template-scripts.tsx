"use client";

import Script from "next/script";

/*
 * jQuery + Bootstrap + los dos scripts propios de la plantilla, en su
 * orden de dependencia. `unal.js` usa jQuery y arma el buscador de
 * Google (cx embebido, sin configuración); `accesibilidad.js` declara
 * las funciones globales que usan el panel de accesibilidad y el botón
 * de tema (ver src/types/unal-template.d.ts). Sin GSAP/Swiper/video.js:
 * son widgets de la demo que AKOPIA no usa.
 *
 * jQuery Migrate va justo después de jQuery: restaura en tiempo de
 * ejecución las APIs que jQuery 3 removió (.live(), $.browser, etc.)
 * para que unal.js/accesibilidad.js, escritos contra jQuery 1.11,
 * sigan funcionando tras la actualización de la 1.11.0 vulnerable
 * (CVE-2020-11023, CVE-2019-11358, CVE-2015-9251) a la 3.7.1.
 */
export function TemplateScripts() {
  return (
    <>
      <Script src="/unal-template/js/jquery.js" strategy="afterInteractive" />
      <Script
        src="/unal-template/js/jquery-migrate.js"
        strategy="afterInteractive"
      />
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
