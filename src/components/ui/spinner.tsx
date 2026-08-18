// Un solo spinner para toda la app, para que "está cargando" se vea
// igual en cualquier pantalla en vez de que cada botón invente su propio
// texto. `currentColor` hace que herede el color del texto del botón que
// lo contiene (blanco en un botón verde, verde en uno con borde).
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`inline-block h-4 w-4 animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"
      />
    </svg>
  );
}

// Fila de texto + spinner para reemplazar un simple "Cargando…" en
// pantallas que esperan datos por primera vez.
export function LoadingLine({ label = "Cargando…" }: { label?: string }) {
  return (
    <p className="flex items-center gap-2 text-(--muted)">
      <Spinner />
      {label}
    </p>
  );
}
