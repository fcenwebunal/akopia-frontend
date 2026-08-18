// accesibilidad.js (plantilla UNAL, cargado como script clásico) declara
// estas funciones como globales de `window`. No se reescriben — se tipan
// para poder llamarlas desde JSX en vez de usar `onclick="..."` inline.
export {};

declare global {
  interface Window {
    cambiarTamanioLetra?: (movement: "+" | "-") => void;
    cambiarContrastes?: (number: 1 | 2 | 3) => void;
    invertirColores?: () => void;
    defaultConfig?: () => void;
    accesstab?: () => void;
  }
}
