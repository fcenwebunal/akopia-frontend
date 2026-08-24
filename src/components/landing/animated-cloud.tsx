/*
 * Las nubes verde-azuladas de la sección "Inscríbete como voluntario"
 * vivían como parte del mismo archivo `.svg` que las hojas rosas —
 * imposible de animar por separado siendo un solo `<img src>`. Se
 * extrajo ese grupo (el blob grande + las burbujas que ya traía el
 * arte) a estos dos componentes, que se dibujan como SVG en línea
 * DETRÁS de la misma imagen de hojas (ahora sin el grupo verde, ver
 * `public/landing/flowers_corner_bottom_left.svg` y `_rigth.svg`).
 *
 * Cada componente solo dibuja el `<svg viewBox>` — NO fija su propio
 * tamaño ni posición. Quien lo usa (`(landing)/page.tsx`) lo mete en
 * un envoltorio junto con el `<img>` de las hojas, y estira a los dos
 * a exactamente 100%×100% de esa misma caja (con `aspect-ratio`
 * fijado al mismo viewBox). Es a propósito: si cada capa calculara su
 * alto "auto" por su cuenta (una como `<img>`, otra como `<svg>` en
 * línea), un redondeo de un solo píxel entre ambas ya se nota como un
 * borde cortado justo donde el arte toca la esquina — forzarlas a la
 * MISMA caja explícita lo hace imposible.
 */

const CLOUD_FILL = "#84cab7";

export function VolunteerCloudLeft() {
  return (
    <svg viewBox="0 0 1183 690" aria-hidden="true" className="block h-full w-full">
      <path
        className="akopia-cloud-blob"
        fill={CLOUD_FILL}
        d="M1182.608,689.525l-1182.608,0l0,-625.225c126.812,9.2 190.763,157.071 235.342,257.479c126.363,284.604 672.333,8.075 947.267,367.746Z"
      />
      <circle
        className="akopia-cloud-bubble"
        style={{ animationDelay: "-0.5s", animationDuration: "5.5s" }}
        fill={CLOUD_FILL}
        cx="1031.7"
        cy="499.992"
        r="24.979"
      />
      <circle
        className="akopia-cloud-bubble"
        style={{ animationDelay: "-2.3s", animationDuration: "4.8s" }}
        fill={CLOUD_FILL}
        cx="1076.975"
        cy="533.562"
        r="12.492"
      />
      <circle
        className="akopia-cloud-bubble"
        style={{ animationDelay: "-4.1s", animationDuration: "6.4s" }}
        fill={CLOUD_FILL}
        cx="113.696"
        cy="34.738"
        r="34.737"
      />
      <circle
        className="akopia-cloud-bubble"
        style={{ animationDelay: "-1.4s", animationDuration: "5.1s" }}
        fill={CLOUD_FILL}
        cx="1000"
        cy="570"
        r="9"
      />
      <circle
        className="akopia-cloud-bubble"
        style={{ animationDelay: "-3.6s", animationDuration: "5.9s" }}
        fill={CLOUD_FILL}
        cx="1050"
        cy="495"
        r="16"
      />
    </svg>
  );
}

export function VolunteerCloudRight() {
  return (
    <svg viewBox="0 0 1067 768" aria-hidden="true" className="block h-full w-full">
      <path
        className="akopia-cloud-blob"
        fill={CLOUD_FILL}
        d="M1066.217,32.389l0,734.979l-1066.217,0c43.079,-233.929 230.721,-495.612 353.242,-240.087c-39.204,-286.033 305.575,-836.158 509.046,-304.546c18.046,-152.833 100.75,-192.321 171.492,-192.604c10.708,-0.046 21.533,0.75 32.437,2.258Z"
      />
      <circle
        className="akopia-cloud-bubble"
        style={{ animationDelay: "-0.8s", animationDuration: "5.6s" }}
        fill={CLOUD_FILL}
        cx="364.196"
        cy="196.305"
        r="27.129"
      />
      <circle
        className="akopia-cloud-bubble"
        style={{ animationDelay: "-3.2s", animationDuration: "5s" }}
        fill={CLOUD_FILL}
        cx="342.333"
        cy="247.435"
        r="16.004"
      />
      <circle
        className="akopia-cloud-bubble"
        style={{ animationDelay: "-1.9s", animationDuration: "4.7s" }}
        fill={CLOUD_FILL}
        cx="390"
        cy="235"
        r="11"
      />
      <circle
        className="akopia-cloud-bubble"
        style={{ animationDelay: "-4.4s", animationDuration: "6.1s" }}
        fill={CLOUD_FILL}
        cx="318"
        cy="175"
        r="15"
      />
    </svg>
  );
}
