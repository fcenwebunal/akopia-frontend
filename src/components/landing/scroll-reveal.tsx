"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/*
 * Dispara una animación de entrada (definida en globals.css por la
 * clase que se le pase) cuando el elemento entra en el viewport, vía
 * IntersectionObserver — una sola vez, sin volver a ocultarse si se
 * hace scroll hacia atrás.
 *
 * El nodo observado (el `<div ref>` exterior) nunca se transforma —
 * solo el `<div>` interior recibe la clase que anima. Es la causa
 * real de por qué algunas tarjetas no llegaban a aparecer: si el
 * propio nodo observado es el que se traslada (hasta -160% en Y,
 * hasta ±115% en X para el estado "oculto"), el navegador calcula la
 * intersección contra esa posición YA desplazada, no contra el lugar
 * natural de la tarjeta en el documento. Un desplazamiento horizontal
 * grande (Horario/Punto de recepción en móvil, ±115% de su propio
 * ancho) saca la caja observada por completo del eje X del viewport
 * — cero superposición posible, el observer nunca dispara. Uno
 * vertical grande (las tarjetas de "¿Qué estamos recibiendo?", -160%)
 * puede además quedar recortado por el `overflow-hidden` de la
 * sección que las contiene, reduciendo o anulando el rectángulo de
 * intersección de forma intermitente según la posición de scroll —
 * el "a veces sí, a veces no". Separar "qué se observa" (el
 * envoltorio, siempre en su sitio natural) de "qué se anima" (el
 * interior) resuelve los dos casos a la vez.
 *
 * `threshold: 0` — dispara con el primer píxel visible, sin esperar
 * un porcentaje de superposición: prioriza que la tarjeta SIEMPRE
 * termine apareciendo sobre la precisión de en qué instante exacto
 * del scroll lo hace. Sin JavaScript, o si el navegador no soporta
 * IntersectionObserver, el elemento queda visible de una — nunca se
 * oculta para siempre (ver también el `<noscript>` de la portada).
 */
export function ScrollReveal({
  children,
  className = "",
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      // Defiere la actualización a una macrotarea en vez de llamar a
      // setState directo en el cuerpo del efecto — react-hooks/
      // set-state-in-effect lo rechaza igual; el patrón ya se usó en
      // otros componentes del proyecto para el mismo caso.
      const id = window.setTimeout(() => setVisible(true), 0);
      return () => window.clearTimeout(id);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0, rootMargin: "0px 0px -5% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const style: CSSProperties | undefined =
    visible && delayMs ? { animationDelay: `${delayMs}ms` } : undefined;

  return (
    <div ref={ref}>
      <div
        className={`akopia-reveal ${visible ? "akopia-reveal-visible" : "akopia-reveal-hidden"} ${className}`}
        style={style}
      >
        {children}
      </div>
    </div>
  );
}
