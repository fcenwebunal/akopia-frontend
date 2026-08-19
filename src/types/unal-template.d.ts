// accesibilidad.js/unal.js (plantilla UNAL, cargados como scripts
// clásicos) declaran estas funciones como globales de `window`. No se
// reescriben — se tipan para poder llamarlas desde React en vez de
// depender de que un evento del propio script las dispare solo.
export {};

declare global {
  interface Window {
    cambiarTamanioLetra?: (movement: "+" | "-") => void;
    cambiarContrastes?: (number: 1 | 2 | 3) => void;
    invertirColores?: () => void;
    defaultConfig?: () => void;
    accesstab?: () => void;
    // unal.js: clona el menú/buscador/sedes de escritorio hacia sus
    // contenedores móviles. Solo corre una vez por su cuenta (en
    // jQuery(document).ready) — <UnalShell> la vuelve a invocar en
    // cada navegación, porque la app no recarga la página.
    prepare_content_menu?: () => void;
  }
}
