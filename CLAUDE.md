# CLAUDE.md — Frontend AKOPIA

Contexto operativo para asistentes de IA y para quien retome el proyecto.
La guía completa de instalación, identidad visual y flujo de trabajo está en [README.md](README.md); aquí va lo que **no** se puede deducir leyendo el código.

---

## Regla permanente de este repositorio

> **Todo cambio importante y toda instrucción global se registran por escrito, en el mismo PR que los introduce.**
>
> - **Siempre** → una línea en la [bitácora](#bitácora-de-avances) de este archivo, con fecha absoluta.
> - **Además, en el [README.md](README.md)** cuando el cambio altera el contrato: estructura de rutas, tokens de identidad, forma de hablar con el backend, pasos de instalación, variables de entorno o convenciones de trabajo.
> - **Además, en el `CLAUDE.md` raíz** del proyecto AKOPIA cuando la decisión afecta también al backend o al despliegue.
>
> Un cambio que el resto del equipo no puede descubrir leyendo el repositorio es un cambio que va a romperle el trabajo a alguien.

---

## Qué es esto en una frase

Interfaz en Next.js 16 + TypeScript + Tailwind v4 para el centro de acopio de la UNAL Manizales, contra un backend PocketBase que ya tiene toda la lógica de negocio.

---

## Las cuatro cosas que se hacen mal por defecto

1. **La lógica de inventario NO va aquí.** El backend mantiene tres saldos (`available_qty`, `reserved_qty`, `quarantine_qty`) y los actualiza mediante hooks transaccionales cuando cambia el estado de un `donation_item` o de una `reservation`. Desde el frontend jamás se hace `PATCH /inventory` ni se calcula un saldo sumando movimientos: se cambia el estado del registro de origen y se lee el saldo que resulta.

2. **El servidor asigna los códigos.** Al crear una donación, una solicitud o un despacho **se omite el campo `code`**. Mandarlo, o generarlo aquí, rompe la secuencia.

3. **Los errores del backend ya vienen en español** y escritos para un operador de bodega («No se puede cambiar la cantidad de un artículo que ya afectó inventario»). `errorMessage()` en `src/lib/pb.ts` los extrae. Muéstralos tal cual: sustituirlos por un texto genérico pierde la única indicación útil de qué hacer.

4. **`pb.authStore` vive en el navegador.** Un componente de servidor no ve la sesión a menos que se le pase la cookie de auth explícitamente en cada petición. Si una pantalla necesita datos autenticados, o es componente de cliente, o reenvía la cookie a mano.

---

## Identidad visual: restricciones duras

- **`#94B43B` (verde institucional) no alcanza contraste AA sobre blanco** (~2.1:1). Por eso existe `unal-green-dark` (`#6F8A24`): el verde puro se usa para superficies y acentos, nunca para texto pequeño. Este es el error más fácil de cometer y el que sí se nota en una auditoría de accesibilidad.
- **Ancízar no se sustituye.** Los `.woff2` de `src/fonts/` vienen de la plantilla oficial de Unimedios y se auto-hospedan: ningún CDN la distribuye y la red de la Universidad no siempre deja salir a uno.
- **El escudo no se recorta, no se recolorea y no se compone con el logotipo de AKOPIA.** Son marcas distintas y van separadas.
- **Colores y tipografía siempre por token.** Un hex escrito a mano en un componente sobrevive al siguiente cambio de identidad, que es justo lo que no queremos.

---

## Decisiones tomadas que no se ven en el código

| Decisión | Por qué |
|---|---|
| Dos superficies separadas por grupos de rutas: `(public)` con identidad institucional completa, `(app)` con layout propio móvil primero | La app se usa de pie en la bodega. La plantilla institucional no puede condicionar esas pantallas. **Depende de confirmar la directriz B3** con Medios Digitales |
| `/registro` explica el procedimiento en vez de ofrecer un formulario | `users.createRule` es `@request.auth.role = 'admin'`: un formulario fallaría con 400 en cada envío. **Decisión de producto pendiente**: o se abre el registro en el backend, o la pantalla se queda así |
| `pb.autoCancellation(false)` | React dispara dos veces cada efecto en desarrollo y el auto-cancel del SDK convertía eso en peticiones canceladas espurias |
| Ninguna URL en el código, todo por `NEXT_PUBLIC_PB_URL` | El mismo build sirve en local, en el Ubuntu de pruebas y en la UNAL |
| Sin librería de componentes, sin gestor de estado, sin cliente HTTP | Next + Tailwind + SDK de PocketBase cubren lo que hace falta. Agregar piezas se discute en un issue primero |
| Identificadores y commits en inglés, texto visible en español | Lo lee un operador de bodega |

---

## Pendientes

- Layout de `(app)/` con guarda de sesión
- Pantallas en el orden del flujo real: recepción → clasificación → inventario → solicitud → reserva → despacho → entrega. Empezar por recepción y clasificación, que son las que ejercitan los hooks y confirman que el inventario cuadra
- Tipos generados desde el esquema (`pocketbase-typegen`) como script de npm
- Confirmar la directriz B3 con la Oficina de Medios Digitales

---

## Bitácora de avances

### 2026-08-17 — Arranque del repositorio

- Repositorio creado en `fcenwebunal/akopia-frontend`. La maqueta previa (`akopia-front.vercel.app`) no tenía repositorio accesible, así que se reconstruyó desde cero con el stack fijado, conservando su contenido: titular «La ayuda organizada llega más lejos», la vista previa del panel y los tres pasos del flujo.
- Stack: Next.js 16 (App Router), TypeScript estricto, Tailwind v4, SDK de PocketBase.
- Identidad UNAL aplicada: paleta como tokens de Tailwind, Ancízar Sans y Serif auto-hospedadas desde la plantilla oficial de Unimedios, escudo y sello en `public/unal/`, cabecera y pie institucionales.
- Se introdujo `unal-green-dark` porque el verde institucional puro no alcanza contraste AA sobre blanco.
- `/login` funcional contra la colección `users`; `/registro` convertida en página informativa por la restricción de `users.createRule`.
- Estructura de dos superficies con grupos de rutas `(public)` y `(app)`.
