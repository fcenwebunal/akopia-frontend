import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Preguntas frecuentes sobre AKOPIA, el centro de acopio de la FCEN Manizales.",
};

interface Faq {
  question: string;
  answer: React.ReactNode;
}

interface FaqGroup {
  title: string;
  items: Faq[];
}

const GROUPS: FaqGroup[] = [
  {
    title: "Sobre AKOPIA",
    items: [
      {
        question: "¿Qué es AKOPIA?",
        answer:
          "El sistema del centro de acopio de la Facultad de Ciencias Exactas y Naturales, sede Manizales. Lleva el registro de las donaciones que llegan, las clasifica, controla cuánto hay disponible en bodega y organiza su entrega a quien lo necesite.",
      },
      {
        question: "¿Necesito una cuenta para donar?",
        answer:
          "No. Donar es un trámite presencial en el punto de recepción del centro de acopio; quien recibe la donación la registra en el sistema. La cuenta es solo para quienes operan la bodega.",
      },
      {
        question: "¿Quién puede tener una cuenta?",
        answer: (
          <>
            Cualquiera puede{" "}
            <Link href="/registro" className="font-bold text-unal-green-dark underline">
              registrarse
            </Link>
            , pero la cuenta queda inactiva hasta que un administrador la active — es la
            manera de asegurarse de que solo personal del centro de acopio use el sistema.
          </>
        ),
      },
    ],
  },
  {
    title: "Donaciones",
    items: [
      {
        question: "¿Por qué un producto queda «En Revisión» y no aparece disponible de una vez?",
        answer:
          "Toda donación llega primero a revisión. Alguien del centro de acopio confirma que el producto está en condiciones de entregarse antes de que pase a disponible — evita que algo dañado o vencido termine donde alguien lo puede pedir.",
      },
      {
        question: "¿Qué significan los tres saldos que aparecen en el inventario?",
        answer: (
          <>
            <strong className="text-(--ink)">Disponible</strong> es lo que se puede reservar
            y despachar ahora mismo. <strong className="text-(--ink)">Reservado</strong> ya
            está comprometido con una solicitud aprobada, aunque todavía esté físicamente en
            bodega. <strong className="text-(--ink)">En Revisión</strong> está retenido hasta
            que alguien decida si pasa a disponible o se rechaza — nada de esto se puede
            pedir.
          </>
        ),
      },
      {
        question: "Me equivoqué al clasificar una donación, ¿se puede corregir?",
        answer:
          "Depende del estado. Mientras el artículo siga en revisión se puede reubicar o rechazar sin problema. Una vez pasa a disponible y afecta el inventario, ya no se edita el registro original — cualquier corrección se hace con un nuevo movimiento (un ajuste o un rechazo), para que el historial quede completo y no se pierda el rastro de lo que pasó.",
      },
    ],
  },
  {
    title: "Solicitudes y despachos",
    items: [
      {
        question: "¿Puedo pedir más de lo que hay disponible?",
        answer:
          "Sí, y a propósito: registrar la solicitud completa deja constancia de la demanda real, aunque hoy no se pueda cubrir del todo. Lo que sí tiene un límite real es la aprobación — ahí el sistema no deja reservar más de lo que en verdad hay en bodega.",
      },
      {
        question: "¿Cómo sé si una solicitud fue aprobada?",
        answer:
          "Cada solicitud tiene su propio estado (pendiente, aprobada, rechazada o cancelada), visible en el listado de Solicitudes. Al aprobarla, lo pedido queda reservado a nombre de esa solicitud hasta que se despache.",
      },
      {
        question: "¿Qué pasa si no hay suficiente stock para aprobar una solicitud completa?",
        answer:
          "El sistema explica exactamente qué producto falta y cuánto, en vez de solo rechazar la solicitud. Esa información alimenta la sección de Productos faltantes, para que se sepa qué priorizar en la próxima donación.",
      },
    ],
  },
  {
    title: "Datos y privacidad",
    items: [
      {
        question: "¿Los datos de quienes donan o solicitan ayuda son públicos?",
        answer:
          "No. Los nombres y datos de contacto de donantes y solicitantes solo los ve el personal autorizado del centro de acopio, dentro del sistema. Lo único que se muestra públicamente en la portada son los productos que hacen falta, sin nombres de por medio.",
      },
      {
        question: "¿Cómo contacto al centro de acopio?",
        answer:
          "Los datos de contacto están al final de esta página, en el pie — dirección, teléfono y correo institucional.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="text-sm font-bold text-unal-green-dark">Ayuda</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight">Preguntas frecuentes</h1>
      <p className="mt-4 text-(--ink-2)">
        Lo que más se pregunta sobre cómo funciona AKOPIA. Si algo no queda claro, revisa
        también el{" "}
        <Link href="/glosario" className="font-bold text-unal-green-dark underline">
          glosario
        </Link>{" "}
        o el{" "}
        <Link href="/mapa-del-sitio" className="font-bold text-unal-green-dark underline">
          mapa del sitio
        </Link>
        .
      </p>

      {GROUPS.map((group) => (
        <section key={group.title} className="mt-10 border-t border-(--rule) pt-8">
          <h2 className="text-xl font-bold">{group.title}</h2>
          <div className="mt-4 space-y-6">
            {group.items.map((item) => (
              <div key={item.question}>
                <p className="font-bold">{item.question}</p>
                <p className="mt-1 text-(--ink-2)">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
