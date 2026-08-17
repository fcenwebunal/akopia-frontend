import Link from "next/link";

const STEPS = [
  {
    title: "Recibe con orden",
    body: "Registra donaciones y clasifica cada producto desde el momento de llegada, con su unidad, su cantidad y su ubicación en bodega.",
  },
  {
    title: "Conoce tu inventario",
    body: "Mantén a la vista qué hay disponible, qué está reservado y qué está retenido a revisión, para que el equipo decida sobre datos y no sobre memoria.",
  },
  {
    title: "Entrega con trazabilidad",
    body: "Prepara y despacha ayuda con un flujo claro en cada paso, y con un registro de quién movió qué y cuándo.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="border-b border-[var(--rule)] bg-[var(--surface-2)]">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-unal-green-dark">
              Centro de acopio · UNAL Manizales
            </p>
            <h1 className="text-4xl font-black leading-[1.08] tracking-tight text-balance sm:text-5xl">
              La ayuda organizada llega más lejos
            </h1>
            <p className="mt-5 max-w-prose text-lg leading-relaxed text-[var(--ink-2)]">
              AKOPIA ordena la gestión de donaciones de un centro de acopio: le
              permite recibir, organizar y distribuir lo que llega de forma
              transparente, sin perder el rastro de nada.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/registro"
                className="rounded bg-unal-green-dark px-6 py-3 font-bold text-white hover:bg-unal-green"
              >
                Crear una cuenta
              </Link>
              <Link
                href="/login"
                className="rounded border-2 border-unal-green-dark px-6 py-3 font-bold text-unal-green-dark hover:bg-unal-green-soft"
              >
                Acceder a AKOPIA
              </Link>
            </div>
          </div>

          <DashboardPreview />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
        <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
          Cómo funciona
        </h2>
        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="border-t-4 border-unal-green pt-5">
              <span className="block text-sm font-black text-unal-green-dark">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 text-lg font-bold">{step.title}</h3>
              <p className="mt-2 leading-relaxed text-[var(--ink-2)]">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-[var(--rule)] bg-[var(--surface-2)]">
        <div className="mx-auto max-w-6xl px-5 py-14 text-center">
          <p className="font-serif text-2xl text-[var(--ink-2)] text-balance sm:text-3xl">
            Operaciones claras para responder mejor
          </p>
        </div>
      </section>
    </>
  );
}

/*
 * Vista estática de la pantalla de operación. Los números son de
 * muestra: la app real vive tras el login y lee de PocketBase.
 */
function DashboardPreview() {
  return (
    <div
      className="rounded-lg border border-[var(--rule)] bg-[var(--surface)] p-6 shadow-sm"
      aria-label="Vista previa del panel de operación"
    >
      <div className="flex items-baseline justify-between border-b border-[var(--rule)] pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
            Centro de acopio
          </p>
          <p className="mt-1 text-lg font-bold">Resumen de hoy</p>
        </div>
        <span className="flex items-center gap-2 text-sm font-bold text-unal-green-dark">
          <span
            className="inline-block h-2 w-2 rounded-full bg-unal-green"
            aria-hidden="true"
          />
          Operativo
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-4 py-5">
        <div>
          <dd className="text-3xl font-black text-unal-green-dark">24</dd>
          <dt className="text-sm text-[var(--muted)]">Donaciones recibidas</dt>
        </div>
        <div>
          <dd className="text-3xl font-black text-unal-orange">8</dd>
          <dt className="text-sm text-[var(--muted)]">Solicitudes pendientes</dt>
        </div>
      </dl>

      <div className="rounded border-l-4 border-unal-yellow bg-[var(--surface-2)] p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
          Prioridad
        </p>
        <p className="mt-1 text-sm leading-relaxed">
          Preparar los insumos reservados para el despacho de esta tarde.
        </p>
      </div>
    </div>
  );
}
