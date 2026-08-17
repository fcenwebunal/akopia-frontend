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

**Además:** cada mejora o corrección se commitea y se empuja en el momento, sin esperar a que lo pidan. `main` no tiene protección de rama: se puede empujar directo cuando el cambio lo amerite, y los PR se reservan para lo que conviene revisar.

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
- Agregada [`PUESTA-EN-MARCHA.md`](PUESTA-EN-MARCHA.md): guía conjunta de los dos repositorios, con el diagrama de conexión, la comprobación de seis pasos y el diagnóstico por síntoma. Existe una copia gemela en el backend.
- Verificado que CORS funciona sin configuración: PocketBase responde `Access-Control-Allow-Origin: *`, así que `localhost:3000` puede llamar a `127.0.0.1:8090` en desarrollo. En producción no hay CORS porque nginx sirve ambos bajo el mismo dominio.
- Instrucción global recibida: hacer push de cada cambio en el momento, y no proteger `main`.

### 2026-08-17 (tarde) — Corrección de la guía para PowerShell

- La guía traía solo comandos `curl` de bash. En PowerShell `curl` es un alias de `Invoke-WebRequest`, que no entiende `-X`, `-H` ni `-d`, y `\` no continúa líneas. El equipo trabaja en Windows: ninguna comprobación era ejecutable tal cual.
- `PUESTA-EN-MARCHA.md` corregida: la prueba de los hooks apunta al script `verificar.ps1` / `verificar.sh` del backend, y los comandos manuales llevan versión de PowerShell con `Invoke-RestMethod` además de la de bash. Agregados los dos errores típicos a la tabla de diagnóstico.

### 2026-08-17 (noche) — App de bodega

- **Bug:** el login redirigía a `/panel`, que no existía. Entrar correctamente terminaba en un 404.
- Creado el grupo `(app)` con guarda de sesión de cliente (`pb.authStore` vive en el navegador, un componente de servidor no lo ve) y cromo propio móvil primero. Tres pantallas con datos reales: resumen del día, lista de donaciones e inventario con los tres saldos.
- **Dos nombres de campo que estaban mal**, tomados por supuestos sin mirar el esquema: `units` expone `code`, no `abbreviation`; y `locations` no tiene ningún campo `code` — la etiqueta se compone de `zone`, `shelf` y `position`, como el catálogo maestro (`A-01-03`). El segundo habría mostrado «Sin ubicar» para siempre.
- Extraído `useAsyncData`: la regla `react-hooks/set-state-in-effect` marca cualquier función que llame a `setState` desde un efecto, aunque sea tras un `await`. Concentrar la carga en un hook deja la excepción justificada en un solo lugar. **El `fetcher` debe venir en `useCallback`.**
- Adoptada la sintaxis canónica de Tailwind v4 en todo el árbol: `text-(--token)` en vez de `text-[var(--token)]`.
<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

### 2026-08-17 (noche) — Propuesta de captura rápida

[`PROPUESTA-CAPTURA.md`](PROPUESTA-CAPTURA.md): evaluación de la metodología de captura jerárquica y diseño de la pantalla de recepción, móvil primero y con lector de códigos en PC. **Pendiente de decisión, nada implementado todavía.**

Lo esencial:

- **La jerarquía es correcta para el catálogo futuro, no para el actual.** Medido: 11 grupos, 55 categorías, 123 productos — **3 productos por categoría en promedio**. Tres niveles de navegación para elegir entre 3 opciones no compensan. Se construye, pero como red de seguridad; el camino principal son recientes y búsqueda.
- **Bloqueante: no existe marca, ni presentación, ni código de barras** en `products`. El flujo pedido no se puede construir sobre el esquema actual. Propuesta: colección `product_variants`.
- **Decisión estructural pendiente: ¿inventario por producto o por variante?** Recomiendo variante — un centro de acopio entrega paquetes, no kilogramos. **Hoy son dos migraciones sobre tablas vacías; con datos cargados es una migración de datos.**
- **El código de barras es un atajo que colapsa la jerarquía**, no una función aparte. Un lector USB se comporta como teclado: funciona sin drivers ni permisos.
- **La cámara del móvil exige HTTPS.** `getUserMedia` y `BarcodeDetector` solo funcionan en contexto seguro, así que sobre `http://172.23.177.12` no van a funcionar. Y `BarcodeDetector` no existe en Safari ni Firefox: en iPhone hace falta polyfill WASM. **Esto convierte el certificado TLS pendiente con OTIC en un bloqueante funcional, no estético.**
- Un EAN-13 **no lleva vencimiento ni lote**: eso se seguirá tecleando.
- «Despensas Armadas» es un grupo sin categorías ni productos.
