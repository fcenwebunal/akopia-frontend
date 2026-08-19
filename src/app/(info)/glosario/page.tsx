import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Glosario",
  description: "Términos propios de AKOPIA y del centro de acopio, explicados en una línea.",
};

interface Term {
  term: string;
  definition: string;
}

const TERMS: Term[] = [
  {
    term: "Ajuste (positivo / negativo)",
    definition:
      "Movimiento que corrige un saldo sin que haya de por medio una entrada, salida o reserva real — por ejemplo, tras un conteo físico que no coincide con lo que muestra el sistema.",
  },
  {
    term: "Cuarentena / En Revisión",
    definition:
      "Estado de un producto recién llegado, retenido hasta que alguien confirme que está en condiciones de entregarse. No se puede reservar ni despachar mientras esté aquí.",
  },
  {
    term: "Despacho",
    definition:
      "La salida de un producto de la bodega hacia su destino final, una vez que la solicitud que lo reservó ya fue aprobada.",
  },
  {
    term: "Disponible",
    definition: "Saldo de un producto que se puede reservar y despachar en este momento.",
  },
  {
    term: "Donación",
    definition:
      "Lo que alguien entrega al centro de acopio. Se registra quién dona (o si prefiere quedar anónimo) y qué trajo.",
  },
  {
    term: "Historial de movimientos",
    definition:
      "El libro completo de todo lo que le ha pasado al inventario: cada entrada, salida, reserva, ajuste y cuarentena, con quién lo hizo y cuándo. Es lo que garantiza que un saldo siempre se pueda explicar.",
  },
  {
    term: "Inventario",
    definition:
      "El conjunto de saldos —disponible, reservado y en revisión— de cada producto en cada ubicación. Nunca se edita a mano: siempre es la consecuencia de un movimiento.",
  },
  {
    term: "Movimiento",
    definition:
      "Cualquier operación que cambia un saldo de inventario. AKOPIA reconoce nueve tipos: entrada, reserva, liberación, salida, cuarentena, liberar cuarentena, traslado a cuarentena, ajuste positivo y ajuste negativo.",
  },
  {
    term: "Panel de Accesibilidad",
    definition:
      "El botón azul junto al menú, con herramientas para cambiar el tamaño de letra, el contraste, invertir colores o cambiar entre tema claro y oscuro.",
  },
  {
    term: "Por Ubicar",
    definition:
      "Un producto que ya pasó la clasificación (es apto para entregarse) pero todavía no tiene un estante o espacio asignado dentro de la bodega.",
  },
  {
    term: "Reclasificar / Rechazar",
    definition:
      "Las dos salidas posibles de un producto que está en revisión: pasar a disponible, o rechazarlo de forma definitiva si no está en condiciones de entregarse. Rechazar es una salida del inventario, no una reubicación — el saldo no vuelve a aparecer en ningún lado.",
  },
  {
    term: "Remesa",
    definition:
      "El conjunto de artículos que llegan juntos en una misma donación — lo que se registra de una vez al recibir a un donante.",
  },
  {
    term: "Reservado",
    definition:
      "Saldo comprometido con una solicitud ya aprobada. Sigue físicamente en la bodega, pero ya no se le puede ofrecer a nadie más hasta que se despache o se libere.",
  },
  {
    term: "Solicitud",
    definition:
      "El registro de lo que alguien necesita. Se puede pedir más de lo que hay disponible a propósito — así queda constancia de la demanda real, aunque hoy no se pueda cubrir del todo.",
  },
  {
    term: "Traslado / Reubicar",
    definition:
      "Mover un producto de una ubicación a otra dentro de la bodega, sin que cambie su saldo total ni su estado (disponible sigue siendo disponible).",
  },
  {
    term: "Ubicación",
    definition:
      "Un estante o espacio físico de la bodega, con su propia foto y descripción, donde se guarda un producto.",
  },
];

export default function GlosarioPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="text-sm font-bold text-unal-green-dark">Ayuda</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight">Glosario</h1>
      <p className="mt-4 text-(--ink-2)">
        Los términos propios del centro de acopio que aparecen dentro de AKOPIA, en orden
        alfabético.
      </p>

      <dl className="mt-10 divide-y divide-(--rule)">
        {TERMS.map((item) => (
          <div key={item.term} className="py-5">
            <dt className="font-bold">{item.term}</dt>
            <dd className="mt-1 text-(--ink-2)">{item.definition}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
