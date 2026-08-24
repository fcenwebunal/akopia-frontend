"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/*
 * Dispara una animación de entrada (definida en globals.css por la
 * clase que se le pase) cuando el elemento entra en el viewport, vía
 * IntersectionObserver — una sola vez, sin volver a ocultarse si se
 * hace scroll hacia atrás. El estado inicial ("oculto") ya lo pinta el
 * propio SSR, así que sin JavaScript el `<noscript>` de la portada
 * fuerza `.akopia-reveal-hidden` a su estado final visible: el
 * contenido nunca queda invisible para siempre.
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

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const style: CSSProperties | undefined =
    visible && delayMs ? { animationDelay: `${delayMs}ms` } : undefined;

  return (
    <div
      ref={ref}
      className={`akopia-reveal ${visible ? "akopia-reveal-visible" : "akopia-reveal-hidden"} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
