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

## Tema claro/oscuro — convención obligatoria para cualquier pantalla nueva

El proyecto tiene selector de tema (claro / oscuro / según el sistema) desde el 18 de agosto de 2026, con el control en `AppShell`, junto a "Salir". La mecánica:

- **`src/lib/theme.ts`** — `applyTheme()` escribe `data-theme="light"` o `"dark"` en `<html>` y lo guarda en `localStorage`; `"system"` borra el atributo y deja que decida `prefers-color-scheme`. Un `<script>` en `src/app/layout.tsx` (`THEME_INIT_SCRIPT`) aplica el tema guardado **antes** de pintar, para que no haya parpadeo.
- **`src/components/ui/theme-toggle.tsx`** — el control de tres botones. No se necesita en cada pantalla: vive una sola vez en `AppShell` y el atributo en `<html>` es global.
- **`globals.css`** define los valores en tres bloques que deben quedar sincronizados: `:root` (claro, por defecto), `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` (oscuro automático), y `:root[data-theme="dark"] { … }` (oscuro forzado por el selector). Los tres bloques repiten los mismos valores — es intencional, no duplicación accidental.

**Regla para toda pantalla o componente nuevo:**

1. **Nunca un color fijo** (`#fff`, `bg-white`, `text-black`, un hex a mano). Siempre un token: `bg-(--surface)`, `text-(--ink)`, `border-(--rule)`, o una utilidad de Tailwind que ya sea un token del proyecto (`bg-unal-green-dark`, etc.). Un color fijo se ve bien en un tema y roto en el otro.
2. Los tokens existentes (`--surface`, `--surface-2`, `--ink`, `--ink-2`, `--muted`, `--rule`, y los de gráficos `--viz-*`) ya cubren la enorme mayoría de los casos — revisa esa lista antes de inventar uno nuevo.
3. **Si de verdad hace falta un token nuevo**, decláralo en los tres bloques de arriba, con un valor para claro y otro para oscuro — nunca en uno solo, o el selector de tema lo deja a medias. Si el color entra en un gráfico o necesita distinguirse de otros por daltonismo, valídalo con el script de la skill de dataviz (`node scripts/validate_palette.js "<hex,hex,…>" --mode light` y de nuevo con `--mode dark`) antes de fijarlo, como se hizo con `--viz-available/reserved/quarantine`.
4. **Los controles nativos del navegador** (selector de fecha, flechas de `<input type="number">`, barra de scroll) siguen la propiedad CSS `color-scheme`, ya declarada en los tres bloques — no hace falta nada por componente para que el ícono del calendario se vea bien en oscuro. Si un control nativo se ve mal en un tema, el arreglo va en `color-scheme`, no en el componente.
5. No leas `window.matchMedia("(prefers-color-scheme: dark)")` directamente en un componente: el tema activo puede ser el elegido a mano, no el del sistema. Si un componente necesita saber el tema actual en JS (raro — casi todo se resuelve con CSS), usa `getStoredTheme()` de `src/lib/theme.ts`.

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

### 2026-08-18 (plazo) — Pantalla de recepción

**El aplicativo debe estar funcionando el 18 de agosto.** Alcance recortado: sin marca, sin valor monetario, sin variantes ni lotes, sin escáner. Inventario por producto.

- **`/panel/donaciones/nueva`** — la pantalla que faltaba para que el sistema fuera usable. Hasta ahora la app solo leía.
- **Tres caminos hacia el mismo sitio**, por orden de velocidad: recientes de la sesión (un toque), búsqueda (tres letras, sin acentos ni mayúsculas), jerarquía grupo → categoría → producto (la red de seguridad). Con 123 productos la jerarquía es el camino lento, por eso no es el que se ve primero.
- **El catálogo se carga entero una vez** (189 registros) y se filtra en memoria: en bodega la señal es mala justo donde se descarga, y una petición por pulsación haría la captura inusable.
- **Borrador local, envío al final.** Repetir un producto suma cantidad en vez de abrir otra línea, salvo que lleve vencimiento o lote — ahí cada entrada es distinta.
- **Formulario condicional** según `requires_expiry` / `requires_batch` / `requires_quarantine`: 75 de 123 productos exigen vencimiento, 5 lote, 6 cuarentena.
- **Fallo parcial contemplado:** si la donación se crea pero algún artículo no entra, se informa cuál y la donación queda utilizable.
- **Pendiente para cerrar el ciclo:** la pantalla de clasificación (`pending → available/quarantine`).
- **`/panel/donaciones/[id]`** — detalle y clasificación. Es lo que cierra el ciclo: pasar un artículo a apto o a cuarentena dispara los hooks y mueve el saldo. Desde aquí solo se cambia el estado; nunca se toca `inventory`.
- Los artículos que ya afectaron inventario muestran por qué no se pueden rechazar (hay que hacer un ajuste), en vez de ofrecer un botón que devolvería 400.

### 2026-08-18 — Módulo de Solicitudes

Gap analysis contra el mockup de Vercel: solo tiene 3 rutas reales (`/`, `/login`, `/registro`), sin dashboard navegable — la tarjeta "Centro de acopio" es una ilustración estática. En login/registro/portada ya estamos al nivel del mockup o por encima. La brecha real estaba entre lo que el backend ya soporta y lo que el frontend usaba.

- **`/panel/solicitudes`** — listado con prioridad y estado.
- **`/panel/solicitudes/nueva`** — mismo patrón que la recepción: borrador local, `ProductPicker` reutilizado. Renglón más simple que `donation_items` (sin vencimiento/lote).
- **`/panel/solicitudes/[id]`** — detalle con `Comprobar disponibilidad`, `Aprobar`, `Rechazar` (solo admin, oculto para operador con explicación) y `Cancelar`. Consumen las rutas propias del backend (`approve`, `reject`, `cancel`, `availability`) en vez de reimplementar la lógica.
- **`callRoute` en `src/lib/pb.ts`.** El SDK de PocketBase (`^0.27.3`) no expone un método genérico para rutas fuera de colecciones — se buscó y no existe en esta versión. `callRoute` habla por `fetch` directo contra `pb.buildURL()`, y `RouteError` conserva `status`/`response` con la misma forma que usa `errorMessage()`, así que el manejo de errores es uno solo en toda la app.
- **`approve` puede devolver 400 con `missing`** (detalle de qué falta): se captura por separado del resto de errores y se muestra como lista, no como texto plano.
- Verificado de punta a punta contra el servidor real: solicitud creada, `availability` confirma, `approve` reserva — disponible 100→70, reservado 0→30.

### 2026-08-18 — Módulo de Despachos y hallazgo tardío en el mockup

**El mockup tiene mucho más de lo que se había visto:** `/dashboard` no estaba enlazado desde la portada, pero existe con navegación completa (Dashboard, Donaciones, Inventario, Solicitudes, Despachos, Productos, Usuarios, Historial) y datos de ejemplo. Revisado a fondo tras el aviso del usuario.

**Piezas explícitamente decorativas en el propio mockup**, según su texto: *«La edición queda pendiente de integración»* (Productos) y *«Vista general de usuarios mock. No realiza gestión real de cuentas»* (Usuarios). No son objetivo a igualar — son placeholders del mockup, y nuestro backend ya podría hacerlas de verdad si algún día se priorizan.

**Backlog identificado, no bloqueante para el ciclo actual:**
- Filtros en `/panel/inventario` por grupo/categoría/ubicación/búsqueda — el mockup los tiene, el nuestro no
- Vista de solo lectura de `audit_log` (equivalente a "Historial") — el backend ya genera estas entradas con hooks reales, sería mostrar lo que ya existe
- Gestión real de usuarios (crear/desactivar) — el backend ya lo permite vía `users.createRule`; el mockup es explícitamente mock
- Panel con métricas más ricas (distribución por categoría, ocupación por ubicación) — nuestro resumen es más simple a propósito

**Módulo de Despachos**, cierra el ciclo completo hasta la entrega:

- **`/panel/despachos`** — listado; el estado mostrado es el de la solicitud (`despachada`/`entregada`/`cancelada`), porque `dispatches` no tiene campo de estado propio — es CRUD simple, no dispara movimiento de inventario, ya que el stock se reservó al aprobar.
- **`/panel/despachos/nueva`** — elige entre solicitudes en estado `aprobada`. Crear el despacho es CRUD; además se pasa la solicitud a `despachada` con una segunda llamada (no transaccional, pero de bajo riesgo: no toca inventario).
- **`/panel/despachos/[id]`** — si no hay entrega, formulario de confirmación que llama a `confirm-delivery`; si ya existe, la muestra de solo lectura.
- **Relabel de `receiver_id_type`** solo en la interfaz («Documento de identidad» en vez de literalmente «INE»): los valores del esquema (`ine`, `pasaporte`, `credencial`, `otro`) vienen de una plantilla mexicana, pendiente de corregir en el backend — documentado, no bloqueante hoy.

Verificado de punta a punta contra el servidor real: aprobar (reservado 0→20) → despachar → confirmar entrega (reservado 20→0, disponible sin cambio porque ya se había restado al reservar, movimiento `salida` real) → solicitud queda `entregada`.

**El ciclo completo del negocio ya se puede recorrer de principio a fin:** recepción → clasificación → inventario → solicitud → aprobación (reserva) → despacho → entrega (consume la reserva).

### 2026-08-18 — Filtros de inventario

`/panel/inventario` ganó los cuatro filtros del mockup: grupo, categoría (dependiente del grupo elegido), ubicación y búsqueda por nombre.

- **Todo se filtra en memoria** contra los datos ya cargados (`loadCatalog()` + la lista de inventario, que hoy no pasa de unos pocos cientos de filas). Sin peticiones nuevas por cada cambio de filtro.
- **Las opciones de ubicación salen del inventario real, no de la colección `locations`.** Con `locations` todavía vacía, ofrecer un desplegable con zonas que nadie usó sería una promesa falsa; así el filtro solo lista lo que de verdad existe hoy, incluido "Sin ubicar".
- `normalize()` se sacó de `catalog.ts` a exportada, para no duplicar la lógica de sin-tildes-ni-mayúsculas que ya usa el buscador de productos.
- Verificado con dos productos de categorías distintas (Arroz / Cobijas): `inventory.product_id` viene plano en la fila y `expand.product_id.category_id` con la expansión — exactamente lo que el filtro necesita para cruzar producto → categoría → grupo sin una petición aparte.

### 2026-08-18 — Registro y login real con Firebase Authentication

Instrucción recibida: conectar registro/login con Firebase, dando rol admin a `admin@akopia.org` al enlazarse. Esto reabre y resuelve la decisión pendiente sobre `/registro` (documentada desde el 17 de agosto): ya no explica un procedimiento, ahora lo ejecuta — con aprobación de admin como salvaguarda, en vez de bloqueo total.

**Arquitectura, en una frase:** Firebase prueba identidad; PocketBase sigue decidiendo todo lo demás. Ningún `@request.auth.*` de las 18 colecciones cambió.

- **`src/lib/firebase.ts`** — cliente de Firebase (`firebase` npm, config del proyecto `akopia`, no secreta). `registerWithFirebase` / `loginWithFirebase` devuelven un ID token; nada más.
- **`src/lib/firebase-server.ts`** — verifica el ID token con `jose` contra las llaves públicas de Google (`securetoken@system.gserviceaccount.com`), sin Admin SDK ni cuenta de servicio: solo hace falta el `project_id`, que no es secreto. Se decidió así porque el usuario solo dio la configuración web del cliente, no una cuenta de servicio.
- **`src/app/api/auth/firebase/route.ts`** — el puente. Verifica el token, busca el usuario por `firebase_uid` y si no por `email` (backfillando el uid la primera vez), lo crea si no existe (`active: false` salvo `admin@akopia.org`), y usa `impersonate` —que exige un superusuario real, verificado empíricamente antes de escribir una sola línea— para emitir una sesión de PocketBase sin conocer la contraseña del usuario.
- **`establishFirebaseSession()` en `pb.ts`** — envuelve la llamada al puente y guarda la sesión en `pb.authStore`, para no repetirlo en `/login` y `/registro`.
- **`/registro`** — formulario real. Cuentas nuevas quedan `active: false`.
- **`/login`** — un solo formulario: intenta Firebase primero, si falla por lo que sea cae a la contraseña nativa de PocketBase (para `admin@akopia.org` y cualquier cuenta creada directo por un admin). No se distingue el motivo del primer fallo porque Firebase ya no lo deja saber: desde hace tiempo da el mismo `auth/invalid-credential` tanto si el correo no existe como si la contraseña está mal.
- **`/panel/pendiente`** — a donde va una cuenta con token válido pero `active: false`. Sin esto, alguien recién registrado entraría al panel y vería todo vacío sin saber por qué.
- **`/panel/usuarios`** — gestión real: activar/desactivar, cambiar rol, sección de pendientes destacada, y alta directa sin Firebase para cuando no se quiera usarlo. Solo visible en el nav para `role: admin`.

**Bugs encontrados y corregidos durante la verificación real (no simulada, contra el proyecto Firebase `akopia` de verdad):**

- **`password` y `passwordConfirm` se generaban por separado** (`randomPassword()` llamado dos veces), así que nunca coincidían. La cuenta nueva fallaba con 400 en cada registro. Corregido: una sola llamada, reutilizada.
- **La contraseña aleatoria de dos UUID (72 caracteres) excedía el máximo de PocketBase (71).** `bcrypt` trunca en 72 bytes y de ahí sale ese límite — no es arbitrario. Un solo UUID (36 caracteres) sobra.
- **El correo de otros usuarios aparecía vacío en `/panel/usuarios`.** No es bug de la pantalla: PocketBase oculta `email` de terceros (`emailVisibility`) incluso a un `role: admin` que no es superusuario real. Resuelto con `manageRule` en el backend (migración `030`) — ver su `CLAUDE.md`.

**Verificado de punta a punta contra Firebase y PocketBase reales:** alta de un operador (`active: false`), y `admin@akopia.org` registrándose por primera vez en Firebase y enlazándose a su cuenta existente sin perder el rol admin ni el `active: true`. Confirmado también que `active` se revisa en cada petición, no queda embebido en el token: activar a alguien surte efecto con la sesión que ya tenía.

**Nuevas variables de entorno**, en `.env.local` (nunca se commitea): `NEXT_PUBLIC_FIREBASE_*` (config del proyecto, no secreta) y `POCKETBASE_SERVICE_EMAIL` / `POCKETBASE_SERVICE_PASSWORD` (sí secreto — el superusuario de servicio, exclusivo para este puente, nunca expuesto al navegador).

### 2026-08-18 (tarde) — Superusuario de servicio: desviación de la guía

Juan Manuel creó el superusuario de servicio con `./pocketbase superuser upsert admin@akopia.org "..."`, reutilizando el correo de la cuenta de aplicación en vez de crear el `servicio@akopia.internal` dedicado que sugiere `PUESTA-EN-MARCHA.md`.

**Funciona igual:** `_superusers` y `users` son colecciones independientes en PocketBase, y PocketBase no exige que el correo sea único entre ellas. Verificado: el superusuario nuevo autentica y el puente `/api/auth/firebase` opera con normalidad usándolo.

**Pero junta tres identidades bajo un solo correo:**

| | `users.admin@akopia.org` | `_superusers.admin@akopia.org` (esta) | Superuser personal del panel |
|---|---|---|---|
| Para qué | Login de la app | Que el puente de Firebase emita sesiones | Entrar a `/_/` |
| Contraseña | `AKOPIA_INITIAL_ADMIN_PASSWORD` | La que se le dio al crearla | La de cada quien, del `/pbinstall` |

Es justo el patrón que el proyecto ya documentaba como el error más caro de cometer con dos identidades — ahora son tres. `.env.local` de este entorno queda con `POCKETBASE_SERVICE_EMAIL=admin@akopia.org` y su contraseña, con un comentario explicando la desviación. Si alguna vez alguien corre `superuser upsert admin@akopia.org` con una contraseña distinta pensando en su propio acceso al panel, rompe el puente de Firebase sin aviso claro — solo un 500 genérico. Vale la pena, en algún momento, migrar a un correo dedicado.

**De paso:** en esta máquina, `curl` contra `127.0.0.1:PUERTO` no alcanzaba un servidor de Next.js escuchando en `::` (todas las interfaces IPv6) aunque el puerto estuviera bien abierto — daba `curl: (7) Failed to connect`. `localhost` y `[::1]` sí funcionaban. Parece un detalle de la pila dual-stack de Windows con Git Bash, no del servidor. Si una prueba con `curl 127.0.0.1:PUERTO` da error de conexión y el proceso está claramente escuchando (`Get-NetTCPConnection`), prueba con `localhost` antes de sospechar del código.

### 2026-08-18 (tarde) — Historial de auditoría

`/panel/historial`, solo admin: lectura de `audit_log`, que el backend ya llena solo desde `04_audit.pb.js` en cada `create`/`update` de las 8 colecciones auditadas. Esta pantalla no escribe nada — es puro consumo de lo que ya existía y no tenía cara.

- Filtro por entidad (donación, solicitud, despacho…).
- Para `status_change`/`update` muestra los campos que cambiaron, `viejo → nuevo`; para `create` solo la marca de creación, sin volcar el snapshot completo — es ruido, no señal.
- Verificado con movimientos reales generados contra el servidor (una donación, un artículo clasificado): `audit_log` trae `create` y `status_change` con el operador expandido, tal como los muestra la pantalla.

### 2026-08-18 (noche) — La causa real de "no me deja registrarme ni entrar", y Google Sign-In

**El síntoma no era un bug del formulario: era que React nunca se hidrataba.** En la consola del usuario, las peticiones de login/registro aparecían como `GET /login?identity=...&password=...` — un **envío de formulario nativo del navegador por GET**, con la contraseña en la URL. Eso solo pasa cuando el `onSubmit` de React nunca se enganchó al formulario.

Causa confirmada con el propio log: `⚠ Blocked cross-origin request ... from "192.168.0.100"` repetido para cada chunk de `_next/static/` y para `_next/hmr`. El usuario probaba desde el celular por la IP de la red local (`http://192.168.0.100:3000`) — que es exactamente el caso de uso correcto para una app móvil primero — y Next.js en modo desarrollo bloquea por seguridad los recursos de `_next/` a cualquier origen que no sea `localhost`, salvo que se autorice explícitamente. Sin esos archivos JS, React nunca se hidrata, ningún `onSubmit` se activa, y el navegador cae al comportamiento por defecto de un `<form>` sin JavaScript: recargar la página por GET con los campos como parámetros de la URL.

- **`next.config.ts`** — `allowedDevOrigins: ["192.168.0.100"]`. Verificado pidiendo un chunk real de `_next/static/` con `Origin: http://192.168.0.100:3000`: antes del cambio se habría bloqueado (según el log del usuario), después se sirvió completo (864 KB, sin ninguna advertencia). Si la IP de red cambia, hay que agregarla aquí y reiniciar `npm run dev` — Next.js exige IPs concretas, no rangos.
- **Hay que reiniciar `npm run dev`** después de este cambio: `next.config.ts` no se recarga en caliente.

**Google Sign-In**, pedido explícitamente:

- `signInWithGoogle()` en `firebase.ts`, con `signInWithPopup`. Se probó **por qué popup y no redirect**: es más simple de seguir en el código y funciona bien en escritorio y en Chrome para Android; si algún navegador lo bloquea (Safari dentro de una app, por ejemplo), la salida conocida es `signInWithRedirect`, no implementada porque no hacía falta todavía.
- Mismo botón (`GoogleButton`, compartido) en `/login` y `/registro` — Google no distingue "cuenta nueva" de "cuenta existente", y el puente tampoco: `/api/auth/firebase` crea o enlaza según corresponda, sin cambios en esa ruta.
- **Lo que sí se verificó:** el puente que consume el token de Google es el mismo que ya se probó contra Firebase real con correo y contraseña — no es código nuevo. Lo que **no se pudo verificar desde aquí** es el propio botón: `signInWithPopup` abre una ventana interactiva de Google que exige un navegador real, y no hay forma de simularlo por terminal.
- **Advertencia real, no verificada, que puede repetir el mismo problema de origen:** Firebase Authentication solo permite el flujo de Google desde dominios en su lista de *Authorized domains* (consola de Firebase → Authentication → Settings). Por defecto trae `localhost` y los dominios de Firebase Hosting, pero **no** una IP de red como `192.168.0.100`. Si se prueba Google desde el celular por esa IP, es esperable un error `auth/unauthorized-domain` — un problema de Firebase, no de Next.js, y sin relación con el `allowedDevOrigins` de arriba aunque el síntoma inicial se parezca. Si aparece, hay que agregar esa IP (o el dominio real, en producción) a la lista de dominios autorizados desde la consola de Firebase.

### 2026-08-18 (noche) — Ajustes de diseño y Cloudinary

Cuatro pedidos puntuales de diseño, más una integración nueva.

- **Botón «Volver»** del explorador: era texto plano (`← Volver`); pasó a un botón cuadrado con el ícono `ArrowLeft` de `lucide-react`.
- **Escudo UNAL** en el header público: se veía pequeño junto al nombre de la app. `h-12 sm:h-14` → `h-16 sm:h-20`.
- **Íconos en el menú superior de la app** (`AppShell`): agregado uno por sección con `lucide-react` (`Home`, `Download`, `ClipboardList`, `Truck`, `Package`, `Users`, `History`). **No se copiaron los SVG del mockup** — no hay forma confiable de extraer assets de otro sitio, y da igual: son íconos equivalentes de una librería estándar, con el mismo significado semántico que los del mockup.

**Explorador estilo menú de restaurante**, con fotos:

- Migración `031` del backend: `photo_url` en `groups`, `categories`, `products`.
- **`PhotoTile`** — la casilla: foto o inicial de color (determinística por nombre, para que no "parpadee" entre recargas mientras no hay foto), nombre debajo, y si quien mira es admin, un distintivo de cámara para cambiar la foto.
- **Bug real, encontrado antes de probar en el navegador — no en producción:** la primera versión envolvía `PhotoTile` (que ya trae su propio `<button>` de cámara) dentro de OTRO `<button>` para manejar la selección. Un botón dentro de otro botón no es HTML válido: el navegador saca el interior fuera del exterior al parsear, y el clic deja de ir donde se espera. Se corrigió antes de la primera prueba: `PhotoTile` es ahora `role="button"` con manejo de teclado propio, y el botón de cámara para el clic con `stopPropagation()`.
- `isAdmin` se pasa a `ProductPicker` desde `donaciones/nueva` y `solicitudes/nueva` (`operator?.role === "admin"`) — el resto de usuarios ve las mismas casillas, sin el distintivo de cámara.

**Cloudinary**, cuenta real conectada (`upvgrfwr`):

- **El API Secret nunca sale del servidor.** `src/app/api/uploads/sign/route.ts` firma la subida (`cloudinary.utils.api_sign_request`) después de validar que quien pide sea un admin activo — con `pb-server.ts` → `requireAdmin()`, que usa `authRefresh()` contra PocketBase en vez de confiar en un rol que mande el cliente. El navegador sube el archivo **directo a Cloudinary** con esa firma; el archivo nunca pasa por nuestro servidor.
- Carpetas separadas por tipo (`akopia/categories`, `akopia/products`, `akopia/groups`), fijadas en la propia firma — el cliente no puede pedir subir a cualquier carpeta.
- **Verificado de punta a punta contra la cuenta real, no simulado:** pedir firma sin sesión → 403; como operador (no admin) → 403; como admin → firma válida, subida real a Cloudinary, `photo_url` guardado en una categoría y releído correctamente.
- Nuevas variables en `.env.local` (nunca se commitean): `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (no es secreto) y `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` (sí lo son, solo en el servidor).

### 2026-08-18 (noche) — Fotos del catálogo por lote, desde Wikimedia Commons

`scripts/seed-catalog-photos.mjs` + `scripts/catalog-queries.mjs`, para poblar `photo_url` en `groups` y `categories` sin subirlas una por una desde la interfaz. **No toca `products`** (123, deliberado): el explorador ya se ve bien con solo grupo y categoría ilustrados, y acertar una foto específica por producto a ciegas es mucho más ruidoso que acertar la de una categoría.

**Por qué Wikimedia Commons y no un banco con API key:** todo el contenido tiene licencia libre verificada — importa en un catálogo que puede volverse público, y evita cualquier riesgo de derechos de autor. Sin necesidad de credenciales.

**Un hallazgo de seguridad real, no cosmético, en la primera pasada:** la categoría «Cobijas» iba a llevar un archivo llamado `Folded Nude.png` — confirmado por sus categorías de Wikimedia como contenido para adultos. La búsqueda de texto completo lo trajo porque su descripción decía *"on red blanket"*. El primer filtro de calidad (tipo de imagen, proporción, un puñado de palabras prohibidas en el título) no tenía ni la palabra "nude". Se corrigió antes de subir nada: la lista de rechazo ahora cubre términos de contenido para adultos explícitamente, y revisa **título + descripción + categorías juntos**, no solo el nombre del archivo — el mismo patrón (una palabra suelta en una descripción larga coincidiendo con la búsqueda) también trajo fotos documentales de contexto militar irrelevantes en varias categorías, así que se agregó además la exigencia de que el propio título comparta una palabra con la búsqueda: si ninguna candidata la tiene, se prefiere no elegir nada antes que una imagen seguramente equivocada.

**El otro problema real, de infraestructura:** pedirle a Cloudinary que descargue la imagen él mismo desde la URL de Wikimedia (`cloudinary.uploader.upload(url)`) empezó a dar `429 Too Many Requests` de Wikimedia a los pocos intentos — no por el ritmo del propio script, sino porque Wikimedia no distingue las peticiones de Cloudinary por cliente. Se resolvió descargando la imagen desde aquí (con una pausa entre elementos) y subiendo el contenido ya en mano como *data URI*, en vez de pedirle a Cloudinary que la busque.

**Resultado, verificado contra PocketBase y Cloudinary reales, no simulado:** 9 de 11 grupos y 36 de 55 categorías quedaron con foto — 45 de 66 en total. Las 21 restantes no tuvieron ningún candidato que pasara el filtro (mejor ninguna foto que una mal puesta) y quedan para completarse a mano desde el ícono de cámara, o ajustando su búsqueda en `catalog-queries.mjs` y corriendo `node scripts/seed-catalog-photos.mjs --only=categories` de nuevo — el script no repite lo que ya tiene foto salvo que se le pase `--overwrite`.

Sin foto todavía: Despensas Armadas, Mascotas, Aceites y Vinagres, Alimento para Mascotas, Analgésicos, Antigripales, Bolsas de Agua, Calcetines, Cloro y Desinfectantes, Escobas y Trapos, Especias y Condimentos, Leche y Lácteos, Láminas y Estructuras, Mantas y Abarrotas, Material de Curación, Pantalones, Pañales, Protección Solar, Ropa Interior, Toallas Femeninas, Toallas Húmedas.

### 2026-08-18 (noche) — Alta de grupos, categorías y productos desde el explorador

Pedido explícito: que un admin pueda ampliar el catálogo (grupo, categoría o producto) sin pasar por `/_/`. Se resolvió con un único formulario en vez de tres, porque las tres altas comparten forma: nombre, padre fijado por el contexto en que se abrió, y algunos campos propios del nivel.

- **`CatalogAddForm`** (`src/components/app/catalog-add-form.tsx`) — se abre desde una casilla "Agregar" al final de cada cuadrícula del explorador jerárquico en `ProductPicker` (solo visible para `isAdmin`), fijando el grupo o la categoría en la que se estaba parado. Campos por nivel: producto pide unidad (obligatoria) y los tres interruptores `requires_expiry/batch/quarantine`; categoría ofrece una unidad habitual, opcional, solo para sugerir; grupo solo pide nombre y descripción.
- **Dos capas contra duplicados:** `findDuplicateByName()` en `catalog.ts` avisa en el propio formulario, sin red, si el nombre ya existe entre hermanos (mismo grupo para categorías, misma categoría para productos); si dos administradores chocan a la vez, el índice único del backend (migraciones `002`-`004`) lo bloquea igual, y ese `validation_not_unique` también se traduce aquí en vez de mostrarse crudo.
- **Lo creado aparece al instante sin recargar el catálogo completo** (189 registros): `ProductPicker` guarda lo nuevo en tres listas propias (`addedGroups/Categories/Products`) y las combina con `catalog` al renderizar.
- **`default_unit_id` en `categories`** (migración `032` del backend): sugiere la unidad al crear un producto dentro de esa categoría — no la impone, el selector queda editable.
- **No hay borrado, solo `active`** (ya documentado en el catálogo): coherente con que tampoco hay botón de eliminar en este formulario.

Verificado de punta a punta contra el servidor real, no simulado: grupo → categoría (con unidad sugerida) → producto creados con la API en ejecución, el índice único devolvió 400 en un nombre repetido, y `npx tsc --noEmit` limpio. Los tres registros de prueba quedaron desactivados (`active: false`), no borrados, porque `deleteRule` es intencionalmente nulo.

### 2026-08-18 (noche) — Operadores también amplían el catálogo, y recuperación de fotos perdidas

**Migración `033` del backend:** `createRule` de `groups`/`categories`/`products` pasa de admin exclusivo a admin-o-operador (`updateRule` sigue siendo solo admin). En `ProductPicker`, la casilla "Agregar" dejó de depender de `isAdmin` — ahora se ve para cualquier sesión activa, admin u operador; la cámara para poner foto a lo ya existente sigue siendo solo admin, sin cambios.

**Hallazgo al retomar la sesión: todas las fotos de `groups`/`categories` habían perdido su `photo_url`**, y todos los usuarios menos `admin@akopia.org` habían desaparecido de `users` — pero el catálogo base (13 grupos, 57 categorías, 125 productos) seguía intacto, igual que las 76 imágenes ya subidas a Cloudinary (verificado listando el Media Library real: **Cloudinary está bien, nada se perdió ahí**). Lo que se perdió fue el enlace en PocketBase entre cada registro y su imagen, sin que exista forma de reconstruirlo desde Cloudinary mismo (no guarda contexto de a qué categoría pertenecía cada subida).

**Por qué pasa esto — y por qué se ha repetido:** `pb_data/` es SQLite local, correctamente excluido de git (nunca debe compartirse). PocketBase y Next.js, cuando los arranca el asistente dentro de esta sesión de trabajo, corren en un entorno de cómputo que puede reiniciarse por su cuenta (lo que ocurrió al inicio de esta conversación: *"al parecer se reinició la sesión"*). Un reinicio de sesión no borra el código —eso vive en git— pero sí puede hacer que los procesos que corrían dentro de ella mueran y vuelvan a levantarse sobre un estado de `pb_data` más viejo que el último realmente escrito, perdiendo lo que solo existía como escritura en caliente (fotos enlazadas, cuentas creadas a mano) desde la última vez que ese estado quedó fijado en disco de forma duradera. **Esto no tiene que ver con reiniciar el servidor en sí** — se verificó en esta misma sesión que un `taskkill` + relanzar `pocketbase.exe` conserva los datos sin problema, siempre que sea el mismo `pb_data/` de siempre.

**Mitigación práctica, para no repetirlo:**
- Arrancar `pocketbase.exe` y `npm run dev` en una terminal propia de Juan Manuel, no dentro de una sesión del asistente, para que el ciclo de vida de esos procesos no dependa de que la sesión de trabajo siga viva.
- Tomar un respaldo real de vez en cuando desde *Settings → Backups* del panel de PocketBase (ya documentado en el `CLAUDE.md` raíz, §7) — es la única copia duradera de lo que solo vive en `pb_data`.

**Recuperación hecha hoy:**
- **`scripts/link-local-photos.mjs`** (nuevo) — sube fotos locales y las enlaza al grupo o categoría cuyo nombre se le parezca más, por solapamiento de palabras (con tolerancia a singular/plural). Corrido en `--dry-run` primero para revisar el emparejamiento antes de subir nada. Contra las 30 imágenes que Juan Manuel ya tenía guardadas en su Descargas (evidentemente elegidas a mano para el catálogo, con nombres que coinciden con grupos/categorías reales): **20 enlazadas correctamente**, 4 sin candidato claro (quedan para poner a mano).
- **`seed-catalog-photos.mjs` corrido de nuevo** (es idempotente: nunca pisa lo que ya tiene foto) para recuperar el resto desde Wikimedia: 29 más.
- **Resultado final: 11/14 grupos y 38/57 categorías con foto** — mejor cobertura que el 45/66 que había antes de la pérdida.
- Los usuarios perdidos (cuentas de operador creadas a mano, vínculos de Firebase) no se pueden recuperar automáticamente — hay que volver a crearlas o esperar a que cada quien vuelva a registrarse.

### 2026-08-18 (noche) — Feedback de carga en toda la app, número de documento en entregas, y panel con estadísticas reales

**Feedback visual de carga**, pedido explícito: hasta ahora un botón se deshabilitaba y a veces cambiaba de texto, pero sin ningún ícono — fácil de confundir con "no hizo nada". Nuevo `src/components/ui/spinner.tsx` (`Spinner`, `LoadingLine`), aplicado a todos los botones que disparan una acción async (donaciones, solicitudes, despachos, usuarios, login/registro, alta de catálogo) y a toda pantalla que espera su primera carga de datos. `GoogleButton` ganó una prop `loading` que cambia el ícono de Google por el spinner mientras firma.

**Bug real corregido en el propio spinner del panel:** mezclar `background` (atajo) y `backgroundColor` (propiedad larga) en el mismo objeto de estilo de React hace que asignar `background` después borre el color que ya había puesto `backgroundColor` — el navegador trata el atajo como un reinicio de sus componentes. Se encontró probando con Playwright real, no a simple vista: la barra de "hoy" en el gráfico de donaciones no se pintaba. Corregido calculando un solo valor de color en vez de mezclar ambas propiedades.

**Bug real corregido en despachos:** `deliveries` guardaba `receiver_id_type` (tipo de documento) pero nunca tuvo un campo para el NÚMERO — el formulario de "Confirmar entrega" lo pedía y no había dónde ponerlo, así que se descartaba en silencio. Migración `034` del backend agrega `receiver_id_number`; la ruta `confirm-delivery` y el formulario ya lo capturan y lo muestran.

**Panel de inicio rediseñado**, conectado a datos reales (no una lista fija de KPIs por agregar):
- Cuatro tarjetas de estado: artículos por clasificar, solicitudes pendientes (con aviso de las de prioridad alta/crítica), despachos por confirmar, productos bajo el mínimo — cada una enlaza a su sección.
- **Distribución del inventario** (disponible / reservado / cuarentena) como franja de tres tramos con leyenda directa. Se advierte explícitamente que la cifra mezcla unidades distintas (kg, litros, unidades…), sumadas como referencia agregada — igual que ya hace `/api/inventory/summary` en el backend, no una invención nueva.
- **Productos con existencia por grupo**: a propósito NO suma cantidades (mezclaría kilos con litros), sino que cuenta cuántas referencias distintas tienen saldo por grupo — la única forma dimensionalmente honesta de comparar grupos.
- **Donaciones de los últimos 14 días**, barras por día.
- Se refresca solo cada 45s más un botón manual con hora de la última actualización — sin llegar a una suscripción en tiempo real por cada colección, que es mucha complejidad para un panel de lectura.
- Paleta de los gráficos (`--viz-available`, `--viz-reserved`, `--viz-quarantine`, `--viz-magnitude` en `globals.css`, luz y oscuro) validada con el script de la skill de dataviz antes de usarse: separación por daltonismo, contraste, banda de luminosidad — no elegida a ojo.
- Verificado con Playwright real contra el servidor en ejecución (login, navegación a `/panel`, captura de pantalla, revisión de errores de consola) — así se encontraron y corrigieron los dos bugs de arriba antes de entregar.

### 2026-08-18 (noche) — Selector de tema claro/oscuro, y dos arreglos visuales puntuales

**Selector de tema**, pedido explícito: tres botones (claro / según el sistema / oscuro) junto a "Salir" en `AppShell`. El proyecto ya tenía soporte de oscuro automático por `prefers-color-scheme` desde el 17 de agosto (sin selector); esto añade la capa de elección manual sobre lo que ya existía, sin rehacer nada. Mecánica y convención completas para pantallas futuras documentadas arriba, en «Tema claro/oscuro».

- `src/lib/theme.ts` + `src/components/ui/theme-toggle.tsx` + un script de inicialización en `layout.tsx` para que el tema guardado se aplique antes de pintar (sin esto, se ve un parpadeo del tema por defecto).
- El atributo vive en `<html>`, así que aplica a todo el proyecto — sitio público incluido, aunque el control solo aparece en la app de bodega — sin tocar componente por componente.

**Dos arreglos visuales reportados con captura de pantalla:**

- **El ícono del selector de fecha era negro fijo del navegador**, invisible en tema oscuro. No es algo que se corrija por componente: `color-scheme: light` / `dark` en los tres bloques de `globals.css` le dice al navegador que dibuje sus propios controles (fecha, flechas de número, scroll) en la variante correcta — cualquier `<input type="date">` futuro queda cubierto automáticamente, sin clase especial.
- **Los símbolos +/− de los contadores de cantidad** (recepción de donación y alta de solicitud) eran caracteres de texto (`−`, `+`) que un motor de fuentes puede alinear distinto a como se espera. Reemplazados por `Minus`/`Plus` de `lucide-react`, igual que el resto de íconos de la app.

Verificado con Playwright contra el servidor real, en tema oscuro: el selector cambia el tema al instante, el ícono de fecha es blanco y visible, y los botones +/− quedan centrados.

### 2026-08-18 (noche) — Módulo de Ubicaciones, reubicación de inventario y panel de detalle por producto

Pedido explícito, con análisis de arquitectura previo (confirmado con Juan Manuel antes de tocar código): completar la gestión de ubicaciones y rediseñar inventario alrededor de ellas. **Hallazgo que cambió el diseño:** revisando el esquema, no existía NINGÚN punto en la app donde se asignara una ubicación — ni al clasificar una donación, ni después — y el hook de `donation_items` bloquea explícitamente cambiar `location_id` una vez que un artículo ya afectó inventario. Sin eso, «mesa de pendientes → ubicación final» no tenía forma de resolverse.

**Decisiones de arquitectura, las tres confirmadas antes de implementar:**

1. **Reubicación como movimiento nuevo, no como edición del `donation_item`.** El `donation_item` debe seguir diciendo de dónde vino la mercancía — reescribir su `location_id` habría perdido esa trazabilidad. En su lugar, dos tipos de movimiento nuevos en el backend (`traslado_salida`/`traslado_entrada`) que mueven `available_qty` de un renglón de `inventory` a otro, con su propia ruta `POST /api/inventory/{id}/relocate`. Sirve tanto para asignar ubicación por primera vez (destino ≠ actual, que puede ser "") como para reorganizar después. Detalle completo en el `CLAUDE.md` del backend.
2. **«Mesa de pendientes» es un filtro, no una colección nueva.** Renglones de `inventory` con `location_id` vacío y `available_qty > 0` — ya aptos para entregar, solo sin ubicación final. Aparece primero en `/panel/inventario`, con una zona de aviso (`border-unal-yellow`) y su propio botón «Reubicar» por renglón.
3. **El clic en un producto abre un panel con TODAS las remesas que componen ese saldo**, no un redirect ciego a una donación. Un mismo renglón de inventario (producto + ubicación) puede sumar varias donaciones con vencimientos y lotes distintos; asumir 1:1 habría obligado a elegir arbitrariamente cuál mostrar. `ProductLocationDetail` en `inventario/page.tsx` lista cada `donation_item` con `classification_status` `available`/`quarantine` en ese producto+ubicación, cada uno con su enlace a `/panel/donaciones/{id}` y sus propios botones de apto/cuarentena — reutilizando exactamente el mismo `pb.collection("donation_items").update(id, {classification_status})` que ya usaba la pantalla de clasificación, sin ruta nueva para esto.

**Ubicaciones (`/panel/ubicaciones`)**, mismo patrón que grupos/categorías/productos: foto + descripción, `createRule` admin-u-operador (migración `035` del backend), `updateRule` sigue siendo admin. Diferencia real con el resto del catálogo: la foto se sube **antes** de crear el registro, no después con la cámara de `PhotoTile` — un operador puede crear pero no editar, así que la única ventana en la que controla `photo_url` es la creación misma (`LocationAddForm` sube a Cloudinary y arma el `create` con la URL ya en mano). La ruta de firma (`/api/uploads/sign`) ahora distingue: admin-only para categorías/productos/grupos, cualquier activo para ubicaciones — coherente con lo que el backend ya permite.

**Inventario rediseñado**, agrupado por ubicación en vez de tabla plana: cada ubicación es una tarjeta con su foto, y dentro sus renglones con acciones directas (reubicar, abrir detalle). **Bug real encontrado y corregido durante la verificación con Playwright, no a simple vista:** una ubicación desactivada (con stock todavía dentro) se mostraba como «Sin ubicar» — confuso, porque implica mesa de pendientes cuando en realidad SÍ tiene ubicación, solo que esa ubicación ya no está activa. `loadLocations()` filtra por `active`, correcto para el selector de destino al reubicar, pero incorrecto para resolver la etiqueta de un renglón ya existente. Se corrigió cargando también la lista completa sin filtrar para ese propósito, con una insignia «desactivada» junto al nombre real de la ubicación.

**Limitación conocida, heredada, no nueva:** el botón de cuarentena/apto en el panel de detalle mueve la cantidad ORIGINAL del `donation_item` (`item.quantity`), no lo que realmente queda disponible de esa remesa en esa ubicación hoy — si parte ya se reservó o reubicó, el backend responde 400 «Cantidad disponible insuficiente», con el mensaje real mostrado tal cual (verificado que no rompe nada, solo informa). Es el mismo riesgo que ya tenía `/panel/donaciones/[id]` antes de este cambio; no se resuelve aquí, queda documentado como pendiente.

**Alcance dejado fuera a propósito:** la reubicación solo mueve `available_qty` — lo reservado está comprometido con una solicitud y lo que está en cuarentena espera revisión, ninguno se reubica de paso. Mover cuarentena entre ubicaciones (p. ej. a una zona de cuarentena física) queda como posible ampliación futura, no pedida todavía.

Verificado de punta a punta con Playwright contra el servidor real: ubicación creada como operador con foto, reubicación de 1 unidad (con capturas del origen y destino cuadrando), y el panel de detalle abriendo la remesa real con su código de donación, mostrando y manejando correctamente el caso de cantidad insuficiente.

### 2026-08-18 (noche) — Operadores editan fotos de categorías/productos, y foto obligatoria al crear

Pedido explícito, dos partes:

**Un operador ya puede cambiar la foto de una categoría o un producto existente**, no solo de lo que él mismo crea. La cámara de `PhotoTile` en `ProductPicker` dejó de depender de `isAdmin` para esos dos niveles — el `TileGrid`/`ProductGrid` compartido pasó de un prop `isAdmin` a `canUpload`, para que grupos (sigue admin-only, no se pidió abrirlo) y categorías/productos (ahora abierto) puedan tener reglas distintas sin duplicar el componente. El backend es quien de verdad limita el alcance: `categories.updateRule`/`products.updateRule` se abren a cualquier activo (migración `037`), pero un hook nuevo (`06_catalog_photo_guard.pb.js`) rechaza con 403 cualquier cambio de un no-admin que no sea `photo_url` — nombre, categoría/grupo padre, unidad, `active`, todo eso sigue siendo solo de admin. Detalle completo, incluida la trampa real en la que se cayó (una constante a nivel de archivo invisible dentro del handler serializado — el mismo error que el propio backend ya documentaba como riesgo), en el `CLAUDE.md` del backend.

**La foto es obligatoria al crear una categoría o un producto** (no un grupo, no se pidió). `CatalogAddForm` ganó el mismo bloque de subida que ya tenía `LocationAddForm` — se sube antes de crear, con vista previa — y `save()` rechaza continuar sin `photo_url` con un mensaje claro, antes de llamar a la API.

La ruta de firma (`/api/uploads/sign`) ahora solo exige admin para `groups`; `categories`/`products`/`locations` admiten cualquier activo, coherente con lo que sus reglas de colección ya permiten.

Verificado con Playwright, con sesión de un operador real (no admin): la cámara aparece en categorías del explorador, la subida de una foto nueva se refleja de inmediato y persiste (confirmado releyendo el registro), y crear una categoría sin foto muestra "Sube una foto antes de crear." sin llegar a la API.

### 2026-08-18 (noche) — Grupos también editables por operador, y "Explorar por grupo"

Dos ajustes puntuales sobre lo anterior:

- **Grupos se suma al mismo permiso que ya tenían categorías/productos**: `groups.updateRule` se abre a cualquier activo (migración `038` del backend), con el mismo `06_catalog_photo_guard.pb.js` limitándolo a `photo_url` — nombre y descripción de un grupo siguen siendo solo de admin. Con esto ya no queda ningún nivel del catálogo con la cámara reservada a admin; el prop `isAdmin` de `ProductPicker` quedó sin ningún uso dentro del componente y se eliminó por completo (junto con los dos sitios que lo pasaban, `donaciones/nueva` y `solicitudes/nueva`) en vez de dejarlo muerto.
- **"Explorar por categoría" pasó a "Explorar por grupo"** — corrige una imprecisión real: ese primer nivel del explorador navega `groups`, no `categories`; el texto llevaba diciendo lo que no era desde que se escribió.

Verificado con Playwright, sesión de operador real: 11 grupos, 11 cámaras visibles (antes 0), y la etiqueta "EXPLORAR POR GRUPO" en pantalla.

### 2026-08-18 (noche) — Foto obligatoria también al crear un grupo

`CatalogAddForm` ya exigía foto para categoría y producto; ahora la exige igual para grupo — el bloque de subida (antes oculto con `kind !== "group"`) se volvió incondicional, y la validación de `save()` dejó de tener la excepción. `PHOTO_KINDS` reemplaza el ternario que solo sabía elegir entre "categories"/"products" para incluir "groups" también, y el `create` de grupo ya manda `photo_url`.

Verificado con Playwright contra el servidor real: crear un grupo sin foto muestra "Sube una foto antes de crear." y no llega a la API; con foto, el grupo se crea y `photo_url` queda guardado (confirmado releyendo el registro).

### 2026-08-18 (noche) — Logo e ícono de marca reales, y un bug preexistente encontrado de paso

Juan Manuel entregó dos SVG (`akopia_favicon.svg`, `akopia_logo.svg`) para reemplazar el texto "AKOPIA" y el favicon genérico.

- **`src/app/icon.svg`** — convención de Next.js App Router: se sirve solo como favicon junto al `favicon.ico` existente (confirmado en el HTML: dos `<link rel="icon">`, uno `image/svg+xml` para navegadores modernos y el `.ico` como respaldo).
- **`public/brand/akopia-logo.svg`** — reemplaza el texto "AKOPIA" en los dos headers que lo tenían: `InstitutionalHeader` (sitio público) y `AppShell` (app de bodega).

**Bug real, preexistente, encontrado al verificar con Playwright — no introducido por este cambio:** ningún SVG local se estaba sirviendo a través de `next/image` (`/_next/image` devolvía 400 para el logo nuevo Y para el escudo de la UNAL, que ya estaba ahí desde el primer commit). Next.js bloquea optimizar SVG por defecto —puede llevar script embebido— salvo que se autorice explícitamente. Corregido en `next.config.ts` con `images.dangerouslyAllowSVG: true` más `contentSecurityPolicy` restrictiva (la mitigación que la propia documentación de Next.js recomienda junto con la bandera): razonable aquí porque los únicos SVG que sirve `next/image` en este proyecto son propios del repositorio, nunca subidos por un usuario.

**Encontrado de paso, no corregido — fuera de alcance de este pedido:** `escudo-unal.svg` solo tiene relleno blanco (`fill:#FFFFFF`) en las 134 formas que lo componen, así que es invisible sobre el fondo blanco del header — probablemente pensado para un fondo oscuro que nunca se usó. No se toca: recolorear el escudo institucional violaría la directriz B1 ("no se recolorea"), y no fue lo que se pidió. Queda para que alguien con autoridad sobre la identidad visual lo confirme.

Verificado con Playwright contra el servidor real (tras el arreglo de `next.config.ts`, que exige reiniciar `npm run dev`): el logo se ve correctamente en ambos headers, con las dimensiones reales confirmadas en el DOM (no un `<img>` roto), y los dos `<link rel="icon">` presentes en el HTML.

### 2026-08-18 (noche) — "Productos faltantes": métrica nueva, subsección y componente pensado para la landing pública

Pedido explícito con requisito de arquitectura: la lista de faltantes debe poder reciclarse después en la landing pública, así que la lógica de datos y la vista se separaron desde el diseño, no como refactor posterior.

**Hallazgo real al construir la ruta de agregación, documentado en el backend:** `/requests/{id}/availability` y `/requests/{id}/approve` resuelven el inventario disponible con `findInventory(app, productId, item.get("location_id"))` — pero `request_items` nunca tuvo un campo `location_id` en su esquema. Ese `.get()` siempre devuelve vacío, así que las dos rutas solo miran el renglón "sin ubicar" de cada producto, no la suma de todas sus ubicaciones. Desde que existe la reubicación de inventario, cualquier producto trasladado a una ubicación real deja de contarse ahí — un aprobar podría rechazar por "falta stock" cuando en realidad está guardado, solo que en un estante con nombre. **No se corrigió**: arreglarlo de verdad implica decidir cómo repartir una reserva entre varios renglones de inventario, que es un cambio de la lógica transaccional de `approve`, no algo que quepa en un pedido de métricas de solo lectura. La ruta nueva de este cambio suma disponibilidad correctamente (todas las ubicaciones) precisamente para no heredar el mismo error.

- **`GET /api/requests/missing-products`** (backend) — agrega `request_items` de solicitudes `pendiente` por producto, resta contra `available_qty` sumado de todas sus ubicaciones, y devuelve solo lo que falta: nombre, categoría, unidad, cantidad exacta. **Sin ningún dato del solicitante a propósito** — es la forma que en algún momento va a alimentar la vista pública, así que su forma ya tiene que ser segura de mostrar afuera. Hoy exige sesión como el resto de la API; abrirla al público es quitar `requireOperator` y `$apis.requireAuth()`, nada más.
- **`src/lib/missing-products.ts`** — el tipo `MissingProduct` (compartido) y `fetchMissingProducts()`, el fetcher **del panel**: pasa por `callRoute`, que manda el token de sesión. Cuando exista la versión pública, tendrá su propio fetcher (`fetch()` liso, sin auth) devolviendo la misma forma — ninguno de los dos sabe del otro.
- **`src/components/inventory/missing-products-list.tsx`** — `<MissingProductsList>`, puramente presentacional: recibe `items` (y opcionalmente `loading`/`error`/`title`/`emptyMessage`) por props, cero `pb`, cero hooks de datos, sin `"use client"` porque no le hace falta. Es el componente que se recicla tal cual en la landing el día que toque — el contenedor cambia, la vista no.
- **`/panel/solicitudes/faltantes`** — la página contenedora: trae los datos con `fetchMissingProducts()` + `useAsyncData`, se los pasa a `MissingProductsList`. Enlazada desde `/panel/solicitudes`.
- **Panel de inicio** — la tarjeta "Productos bajo el mínimo" (basada en `min_stock_alert`, un umbral que nadie llegó a configurar) se reemplazó por "Productos solicitados faltantes", con una vista previa de los tres primeros reutilizando el mismo `<MissingProductsList>` — la reutilización pedida ya se demuestra dentro del propio panel, antes de llegar a la landing.

Verificado de punta a punta contra el servidor real: una solicitud pidiendo más de lo disponible aparece con la cantidad exacta que falta; una que pide menos de lo disponible no aparece. Con Playwright: la tarjeta nueva y su vista previa en el panel, el enlace desde Solicitudes, y la página completa — los tres coinciden con la respuesta real de la API.

### 2026-08-18 (noche) — Selector de ubicación con foto y buscador, en vez de un `<select>`

Pedido explícito para el diálogo de reubicar: cambiar el `<select>` de texto de "Ubicación destino" por una grilla con foto, filtrable por zona, estante, posición o descripción a la vez.

- **`PhotoTile` ganó un prop `selected`** (anillo verde + insignia de check) — antes solo distinguía `disabled`. Es la pieza que hacía falta para usar la misma casilla del catálogo como control de una sola elección, no solo de navegación.
- **`src/components/app/location-picker.tsx`** — `<LocationPicker>`, nuevo y reutilizable: buscador (filtra en memoria, sin acentos ni mayúsculas, contra los cuatro campos a la vez) + grilla de `PhotoTile`. La casilla "Mesa de pendientes" (sin ubicar) se dibuja aparte, sin foto, con el mismo comportamiento de selección. `currentLocationId` deshabilita la ubicación actual en vez de ocultarla — confirma dónde está antes de elegir hacia dónde se mueve, igual que ya hacía el `<select>` anterior con `disabled` en la opción actual.
- El diálogo de reubicar (`RelocateDialog` en `inventario/page.tsx`) pasó de `sm:max-w-sm` a `sm:max-w-md` con scroll propio (`max-h-[90vh] overflow-y-auto`), porque una grilla con fotos necesita más espacio que una lista de texto.

Verificado con Playwright contra datos reales: buscar por un término que solo aparece en la descripción ("blanco") filtra correctamente a una sola ubicación aunque no coincida con su zona/estante/posición; buscar por zona ("Latas") hace lo mismo; seleccionar una casilla marca el anillo verde y el check, y el traslado se completa con la ubicación elegida en la grilla.

### 2026-08-18 (noche) — Coordenadas de destino en despachos, y mapa de impacto en el panel

Pedido explícito, con tres piezas: guardar el punto exacto del destino de un despacho (para copiarlo o abrirlo en Google Maps), un mapa minimalista y monocromo en el panel de inicio con los puntos donde ha llegado ayuda, y que el registro se haga arrastrando un puntero sobre un mapa de Manizales — editable después.

**Dependencia nueva:** `leaflet` + `react-leaflet@5` (compatible con React 19), sin necesidad de una llave de API ni facturación — las teselas son de CARTO, gratuitas para este volumen de uso. Todo componente que importa Leaflet se carga con `next/dynamic(..., { ssr: false })`: Leaflet toca `window` al importarse, y el render en servidor de una página `"use client"` truena si no se aísla así.

- **Migración `039`** — `destination_lat`/`destination_lng` en `dispatches`, opcionales (los despachos que ya existían no los tienen) con un rango amplio alrededor de Manizales solo para atrapar un valor claramente fuera de lugar. **Hallazgo real, verificado contra el servidor:** un campo numérico no obligatorio que nunca se llenó queda en `0`, no en `null` — así que el filtro correcto para "sin coordenadas" es `!= 0`, no `= null`. Se comprobó antes de escribir el filtro, no se asumió.
- **`src/components/app/map-picker.tsx`** — el mapa de un punto, con marcador propio (un círculo verde por CSS, no el ícono de fábrica de Leaflet, cuyas rutas de imagen se rompen con el empaquetado de Next.js — problema conocido, evitado de raíz). Se mueve arrastrando o tocando el mapa; usa las teselas `light_all` de CARTO, **con** nombres de calles — aquí sí hacen falta, para que quien registra pueda confirmar que está marcando el sitio correcto.
- **`src/components/app/coordinates-display.tsx`** — coordenadas + botón "Copiar" (con confirmación visual) + enlace "Abrir en Google Maps" (`google.com/maps?q=lat,lng`, sin API de Google de por medio). Puramente presentacional, reutilizable donde haga falta mostrar un punto.
- **`/panel/despachos/nueva`** — el mapa aparece con el punto en el centro de Manizales por defecto, listo para arrastrar a la dirección real.
- **`/panel/despachos/[id]`** — muestra el punto guardado (o invita a marcarlo si nunca se hizo) con copiar/abrir en Maps, y un botón "Editar ubicación" que abre el mismo `MapPicker` sobre el punto actual — la edición pedida explícitamente.
- **`src/components/panel/help-map.tsx`** — el mapa de impacto: SIN interacción de zoom/etiquetas, teselas `light_nolabels` de CARTO (calles, manzanas y verde, cero nombres de calle/barrio/lugar — la variante que sí cumple "no quiero nombres de lugares"), puntos como círculos verdes lisos. Puramente presentacional (`points` por props), igual que `MissingProductsList`: mismo patrón de fetch separado de vista ya establecido en este proyecto.
- **Panel de inicio** — nueva sección "Dónde ha llegado la ayuda" con el mapa, alimentada por `fetchDispatchLocations()` (filtra `destination_lat != 0 && destination_lng != 0`).

**Hallazgo urgente, no pedido, encontrado al probar:** para verificar el flujo completo necesité aprobar una solicitud real, y `POST /api/requests/{id}/approve` **rechazó todas las solicitudes con productos que ya se habían reubicado** — el bug de `findInventory` con `location_id` inexistente en `request_items` que ya se había documentado el 18 de agosto al construir "Productos faltantes", pero esta vez confirmé que **ya no es un caso límite: hoy mismo, en esta base, todo el stock de todos los productos está reubicado a alguna ubicación real, así que `approve` no logra aprobar NINGUNA solicitud** (probado con "Bolsa de agua", 8 disponibles según `/api/inventory/summary`, reportado como 0 por `approve`). Merece atención antes que cualquier otra cosa.

**Corregido el mismo 18 de agosto, a continuación de esta entrega** — `findInventoryRows()` nuevo en el backend suma disponibilidad de todas las ubicaciones de un producto, y `approve` ya reparte la reserva entre varias cuando una sola no alcanza, en vez de asumir que todo vive en la ubicación "sin ubicar". Detalle completo, con la verificación de punta a punta (incluido el mismo caso 7/1 que fallaba), en el `CLAUDE.md` del backend.

**De paso, se habilitó el zoom en `HelpMap`** (pedido explícito, a continuación de este arreglo): controles +/-, rueda del mouse y pellizco táctil — antes el mapa del panel era fijo, sin poder acercarse. También se restauró la atribución de OpenStreetMap/CARTO, que se había quitado por limpieza visual sin reparar en que los términos de uso gratuito de CARTO la exigen. Verificado con Playwright: el botón de acercar funciona, y ni siquiera acercado del todo aparece un solo nombre de calle o barrio — la variante `light_nolabels` no los trae en ningún nivel de zoom, no solo en el inicial.

Verificado de punta a punta contra el servidor real y con Playwright: un despacho creado con el punto elegido en el mapa quedó guardado con las coordenadas exactas del clic (confirmado en la base de datos); el detalle mostró "Copiar"/"Abrir en Google Maps" y el flujo de edición reabrió el mapa sobre el punto guardado; el mapa del panel mostró el punto real sobre Manizales usando las teselas sin etiquetas, confirmado inspeccionando la URL de la tesela cargada.

### 2026-08-18 (noche) — "Vincular correo" reemplaza la creación de cuenta con contraseña

Pedido explícito: en `/panel/usuarios`, el admin ya no debe poner la contraseña de nadie — solo reserva correo, nombre y rol; la contraseña real la pone la persona misma al entrar por primera vez.

**El mecanismo para que esto funcione ya existía**, sin que nadie lo hubiera aprovechado desde esta pantalla: `/api/auth/firebase/route.ts` (documentado el 18 de agosto) ya busca primero por `firebase_uid` y si no encuentra nada, cae a buscar por **correo** — y si encuentra un registro sin `firebase_uid` todavía, lo enlaza sin tocar `role`, `full_name` ni `active`. Es exactamente lo que hace posible que `admin@akopia.org` se registrara en Firebase sin perder su rol. "Vincular correo" es la misma idea, ahora disponible para cualquier persona, no solo la cuenta de arranque.

- **`LinkEmailForm`** (antes `CreateUserForm`) — perdió el campo de contraseña. Crea el registro con una contraseña aleatoria de un solo UUID (`crypto.randomUUID()`, ya usado en el cliente en otras pantallas) que nadie conoce ni necesita — el mismo truco que ya usaba el puente de Firebase para sus altas automáticas, solo que ahora también aquí. `active: true` de una vez: elegir el rol ya es la aprobación, no hace falta un segundo paso de "activar" para algo que un admin acaba de decidir a propósito.
- **Error específico si el correo ya existe** (alguien que ya se había registrado solo, por ejemplo) — en vez de un mensaje genérico, indica ir a activar o editar esa cuenta en la lista de abajo en vez de intentar duplicarla.
- El botón que abre el formulario pasó de "Crear cuenta" a "Vincular correo", con una nota corta explicando que la contraseña la pone la persona, no el admin.

**Verificado de punta a punta, no solo la interfaz:** creada una cuenta admin por este formulario contra el servidor real (sin campo de contraseña en pantalla, confirmado con Playwright); confirmado en la base que quedó `active: true`, con el rol elegido y sin `firebase_uid`; y **simulado el paso que hace el puente en el primer login real** — buscar por correo, asignar `firebase_uid` — confirmando que `role`, `full_name` y `active` salen exactamente iguales después, tal como los dejó el admin al vincular.

### 2026-08-18 (noche) — Las listas priorizan el nombre sobre el código

Pedido explícito, con capturas: en Donaciones, Solicitudes y Despachos, el código (`DON-000005`, `SOL-000003`, `DES-000002`) se veía primero y en negrita — antes que el donante, el solicitante o el destino, que es lo que de verdad identifica un registro de un vistazo. Se invirtió la jerarquía en las tres listas:

- **Renglón principal, en negrita:** el dato humano (`donor_name`, `requester_name`, `destination`) + sus insignias de estado/tipo/prioridad + la fecha a la derecha.
- **Renglón secundario, gris y pequeño:** el código en mono, seguido del resto de contexto (`Recibió: …`, `conduce …`, el código de la solicitud enlazada, el destino).

El código no desaparece — sigue ahí para quien lo busca por número — pero ya no compite por la atención con el nombre. Las páginas de detalle (que sí abren directo con el código como título, p. ej. `DON-000002`) no se tocaron: ahí el código ya es la referencia que alguien trae en la mano al buscar ese registro puntual, es un contexto distinto al de una lista.

### 2026-08-18 (noche) — "Ubicaciones" sale del menú principal, entra como botón en Inventario

Pedido explícito: `/panel/ubicaciones` deja de ser un ítem de la barra de navegación de `AppShell` y pasa a ser un botón dentro de `/panel/inventario`, junto al título, con el mismo ícono (`MapPin`). La ruta no cambió — solo de dónde se llega a ella. Verificado con Playwright: la barra de navegación ya no lo lista, el botón nuevo navega correctamente a la página existente.

### 2026-08-18 (noche) — Auditoría de navegación, "Por Ubicar", y confirmación de que cuarentena/mesa de pendientes ya se calculaban bien

Tres pedidos en uno.

**1. Auditoría de navegación.** Se pidió un enlace de vuelta desde Ubicaciones a Inventario (consecuencia directa de haber sacado Ubicaciones del menú principal la entrega anterior — ya no tenía ninguna otra puerta de salida) y una revisión del resto de la app. Encontrados y corregidos cuatro puntos ciegos reales, los únicos que había: `/panel/ubicaciones` y los tres formularios de alta (`donaciones/nueva`, `solicitudes/nueva`, `despachos/nueva`) no tenían el enlace "← Sección" que sí llevan las páginas de detalle (`donaciones/[id]`, `solicitudes/[id]`, `despachos/[id]`, `solicitudes/faltantes`) desde que se escribieron. Las páginas de nivel superior (Inventario, Usuarios, Historial, Donaciones, Solicitudes, Despachos, el panel mismo) no lo necesitan — ya son alcanzables desde la barra de navegación, es el mismo criterio que ya seguían las páginas que sí tenían el enlace.

**2. Verificado, no solo revisado, contra el servidor real:** los productos en la mesa de pendientes (renglones de `inventory` sin ubicación) ya se sumaban correctamente en `available_qty` en todos lados (`/api/inventory/summary`, `/api/requests/missing-products`, `findInventoryRows`, el panel de inicio), y los productos en cuarentena ya se excluían en todos lados — es la cubeta `quarantine_qty`, una columna aparte que ningún cálculo de disponibilidad toca ni tocó nunca. Probado con un caso real: un producto con 40 unidades en cuarentena y 0 disponibles se reportó correctamente como agotado en `availability` y en "Productos faltantes", sin que las 40 en cuarentena se colaran en la cuenta. No hizo falta escribir ni una línea de lógica nueva — el invariante de las tres cubetas separadas, que sostiene el diseño desde el principio del proyecto, ya garantizaba esto.

**3. Renombrado "Mesa de pendientes" → "Por Ubicar"** (decisión tomada junto con Juan Manuel, entre tres opciones, antes del cambio): más corto que "Por Organizar" y nombra exactamente lo que falta — asignar una ubicación — en vez de algo más genérico. Cambiado en las cuatro apariciones reales: el encabezado de la sección en `/panel/inventario`, el subtítulo del diálogo de reubicar, la casilla del selector de ubicación (`LocationPicker`) y `locationLabel()` en `src/lib/locations.ts` (el mismo texto que usa el panel de detalle de un producto sin ubicar). **"En Revisión" no existía en ningún lugar del código** — se buscó explícitamente antes de tocar nada — así que ese punto del pedido ya estaba resuelto: "Cuarentena" es y ya era el único término usado, en las etiquetas de estado, los botones de clasificación y la distribución del panel de inicio.

Verificado con Playwright contra el servidor real: los cuatro enlaces de retorno navegan a la ruta correcta; "Por Ubicar" aparece consistente en la sección de inventario y en la casilla del selector de ubicación, con su anillo de selección funcionando igual que antes del cambio de nombre.

### 2026-08-18 (noche) — "Cuarentena" pasa a "En Revisión", y la mesa de pendientes/en revisión ganan cara propia en Ubicaciones e Inventario

Pedido explícito de Juan Manuel, que **revierte** lo reportado la entrega anterior: entonces se había buscado "En Revisión" en todo el código y no aparecía en ningún lado, así que se dejó "Cuarentena" como el único término, correcto y consistente. Ahora Juan Manuel eligió explícitamente "En Revisión" como el término definitivo — no es un descuido que quedó pendiente, es un cambio de decisión.

**Cambio de término, extendido más allá de lo pedido literalmente.** El pedido decía "reviza en Donaciones", pero dejar "Cuarentena" en Inventario, el panel de inicio o el alta de catálogo mientras Donaciones ya dijera "En Revisión" habría recreado exactamente el problema de inconsistencia que motivó el pedido anterior. Se extendió la búsqueda y el cambio a los cinco archivos donde el término aparecía (`grep` de "Cuarentena" confirmado vacío al terminar):

- `donaciones/nueva/page.tsx` — la etiqueta de línea del borrador y la opción "Cuarentena" del fieldset "Estado" en el diálogo de producto.
- `donaciones/[id]/page.tsx` — `STATUS_LABELS`, el botón "A cuarentena" → "A revisión".
- `inventario/page.tsx` — `STATUS_LABELS` y el botón "Enviar a cuarentena" → "Enviar a revisión", dentro de `ProductLocationDetail`.
- `panel/page.tsx` (dashboard) — el segmento "Cuarentena" de la franja de distribución del inventario.
- `catalog-add-form.tsx` — el interruptor "Revisión en cuarentena" → "Requiere revisión al recibir" (el atributo del producto `requires_quarantine`).

**No se tocó ningún identificador interno**, por convención ya establecida del proyecto (identificadores en inglés, texto visible en español): `classification_status: "quarantine"`, `quarantine_qty`, `movement_type: "cuarentena"` (valor de un campo `select` del backend) y las claves `quarantine:` de los records `STATUS_LABELS`/`STATUS_STYLES` siguen igual — solo cambiaron los valores de texto que ve un operador.

**"En Revisión" ahora también se puede explorar, no solo clasificar.** Antes de este cambio, un producto en cuarentena solo aparecía como una insignia pequeña dentro de la fila de un producto que también tuviera ubicación o disponible — no había forma de ver de un vistazo *todo* lo retenido. Dos piezas nuevas, reutilizando datos que ya se cargaban (`InventoryRow.quarantine_qty` ya venía en cada fila; no hizo falta ninguna petición nueva):

- **`/panel/inventario`** — nueva sección "En Revisión" (borde rojo, como ya usa el resto de la app para ese estado), justo después de "Por Ubicar", listando todo renglón con `quarantine_qty > 0` con su ubicación (o "Por Ubicar" si no tiene) y abriendo el mismo `ProductLocationDetail` que ya mostraba y manejaba correctamente los ítems retenidos desde la entrega de Ubicaciones — sin ruta ni lógica de backend nueva. **Un mismo producto puede aparecer en dos secciones a la vez** (por ejemplo, en "Por Ubicar" por su parte disponible y en "En Revisión" por su parte retenida): son estados independientes que conviven en el mismo renglón de `inventory`, documentado como comentario en el propio código para que no se lea como un bug al retomarlo.
- **`/panel/ubicaciones`** — dos tarjetas nuevas, con borde punteado para distinguirlas visualmente de las ubicaciones físicas reales que sí llevan foto: "Por Ubicar" y "En Revisión", cada una un enlace a `/panel/inventario#por-ubicar` / `#en-revision` (ids agregados a las secciones correspondientes). No son casillas seleccionables ni destino de ninguna reubicación — son navegación pura hacia estados que ya existían, con un comentario explicando por qué no llevan foto ni entran al `grid` de ubicaciones reales. Íconos `PackageSearch`/`ShieldAlert` de `lucide-react`, evitando `MapPin` (reservado desde una instrucción anterior para otro uso futuro).

Verificado con Playwright contra el servidor real: las dos tarjetas nuevas en Ubicaciones navegan a las secciones correctas de Inventario; la sección "En Revisión" de Inventario lista los dos productos retenidos reales de la base (`Pasta (fideos)` 40 PAQUETE, `Desodorante` 5 PIEZA), ambos con "Por Ubicar" como su ubicación; abrir el detalle de uno muestra el badge "En Revisión" y el botón "Liberar a disponible" funcionando igual que antes; el diálogo "Estado" de Donaciones y la franja de distribución del panel de inicio muestran "En Revisión" en vez de "Cuarentena". `npx tsc --noEmit` limpio.

### 2026-08-18 (noche) — Ícono de "Donaciones" en el menú

Pedido explícito: el ícono de la sección Donaciones en `AppShell` era `Download` (una flecha de descarga), sin relación real con lo que representa. Cambiado a `Gift`, de `lucide-react` — mismo patrón que el resto de íconos del menú (uno por sección, semánticamente afín). Verificado con Playwright que el ícono nuevo se ve en la barra de navegación.

### 2026-08-18 (noche) — `/panel/respaldos`: respaldo manual de la base, solo admin

Pedido explícito: un apartado para respaldar la base manualmente (sin cron automático todavía) y restaurarla, restringido al superadmin con contraseña. Se resolvieron tres ambigüedades reales con Juan Manuel por `AskUserQuestion` antes de tocar código, porque cambiaban el diseño de fondo: quién es "el superadmin" (cualquier `role: admin`, no una cuenta fija — **elegido**), qué contraseña se pide (la nativa de PocketBase de esa cuenta, reautenticando con `validatePassword` — **elegido**, sabiendo que una cuenta creada por "Vincular correo" nunca llegó a tener una contraseña nativa conocida y por ahora no podría usar esto) y el alcance de restaurar (**decisión: solo respaldar desde el panel** — restaurar sigue siendo manual, solo desde `/_/` con un superusuario real, porque sobreescribe la base completa y reinicia el servidor, cortando a cualquiera conectado en ese momento).

- **`/panel/respaldos`**, en el menú solo para `role: admin` (mismo patrón que Usuarios/Historial). Lista los respaldos existentes (nombre, tamaño, fecha), un botón "Crear respaldo" y un botón "Descargar" por fila — ambos abren el mismo diálogo pidiendo la contraseña de PocketBase antes de llamar a la API. Un aviso fijo explica por qué restaurar no está aquí y a dónde ir si hace falta.
- **Descarga real de un archivo binario, no JSON:** `callRoute()` siempre espera JSON, así que la descarga usa su propio `fetch` con el mismo patrón de headers, lee la respuesta como `Blob`, y dispara el guardado con un `<a download>` sintético sobre una URL de objeto — sin pasar por ningún endpoint de PocketBase que sirva archivos de colección, porque un respaldo no es un `file` de ningún registro.
- **Rutas nuevas del backend, bajo `/api/akopia-backups`, no `/api/backups`** — ese segundo path ya lo reserva la propia API nativa de PocketBase (superusuario real, no nuestros admins) y una ruta propia con el mismo nombre queda tapada por la suya en silencio. Detalle completo del hallazgo, y de una segunda trampa real (la de los handlers de hook aislados, otra vez) en el `CLAUDE.md` del backend.

Verificado de punta a punta contra los servidores reales, con Playwright: contraseña incorrecta muestra "Contraseña incorrecta." sin crear nada; con la correcta, el respaldo aparece en la lista con tamaño y fecha legibles; descargar con la contraseña correcta produce un archivo real (`akopia_manual_<fecha>.zip`, confirmado por su nombre sugerido) con el spinner de carga visible durante la operación. `npx tsc --noEmit` limpio.

### 2026-08-18 (noche) — Mapa en solicitudes, herencia hacia despachos/entregas, y switch de solo-disponibles

Tres pedidos en uno, con una pregunta de alcance real resuelta con `AskUserQuestion` antes de tocar el backend (ver el `CLAUDE.md` del backend): el sistema ya deja a propósito pedir más de lo disponible con el switch apagado, así que el tope duro de cantidad se quedó donde ya vivía (`approve`), no en la creación de la solicitud.

**1. Mapa y coordenadas en `/panel/solicitudes/nueva`.** Mismo `MapPicker` que ya usaba Despachos, ahora también aquí: el punto se marca una vez, al pedir, en vez de inventarse de nuevo cada vez que se arma el despacho. Requiere la migración `040` del backend (`destination_lat`/`destination_lng` en `requests`).

**2. Herencia hacia despachos y entregas**, la auditoría explícitamente pedida ("qué otras variables deberían heredarse"):
- **`despachos/nueva`** — `selectRequest()` ya copiaba el texto de `destination`; ahora también copia `destination_lat`/`destination_lng` si la solicitud los tiene (con el mismo criterio que ya usa el detalle del despacho para distinguir "sin marcar" de "en 0,0": `!== 0`). Si la solicitud es de antes de esta función y nunca tuvo coordenadas, se arranca del centro de Manizales, como siempre. Sigue siendo editable — es un valor de partida, no una imposición.
- **`despachos/[id]`** — al confirmar la entrega, `receiver_name`/`receiver_phone` se precargan (editable, con un `useEffect` que solo llena si el campo sigue vacío) desde `requester_name`/`requester_phone` de la solicitud enlazada, vía el `expand: "request_id"` que la pantalla ya pedía. Casi siempre quien pidió es quien recibe; cuando no lo es, el operador lo cambia a mano.
- **`solicitudes/[id]`** — ganó el mismo `CoordinatesDisplay` (copiar / abrir en Google Maps) que ya usaba el detalle del despacho, reutilizado tal cual.
- **Sin más redundancia real que resolver:** conductor, placa, brigada, tipo/número de documento son datos propios de cada paso, no copias de algo que ya existiera antes.

**3. Switch "Mostrar solo productos disponibles"**, activado por defecto, en `/panel/solicitudes/nueva`:
- `Toggle` (antes solo un componente local de `catalog-add-form.tsx`) se extrajo a `src/components/ui/toggle.tsx` para poder reutilizarlo aquí sin duplicar código.
- Con el switch activado, el catálogo que ve `ProductPicker` se filtra a productos con `available_qty > 0` (de `/api/inventory/summary`, que ya excluye reservado y cuarentena — no hizo falta ningún cálculo nuevo) — **filtrado en la propia página, no dentro de `ProductPicker`**, porque ese componente también lo usa Donaciones, donde este filtro no aplica y no tiene sentido enseñarle a distinguir el caso.
- El selector de cantidad muestra "disponible: N", topa el botón `+` y el campo numérico en N, y deshabilita "Agregar" con un aviso si se escribe manualmente por encima del tope — validado en la interfaz, consistente con que el backend nunca fue el lugar pensado para este tope (ver arriba).
- Con el switch apagado, el catálogo vuelve a mostrarse completo, incluidos los productos en cero — para dejar registrada una demanda que hoy no se puede cubrir, que es justo lo que ya hace "Productos faltantes" con esos renglones.

Verificado de punta a punta contra los servidores reales, con Playwright: switch activado por defecto; "Frijol · disponible: 8" mostrado correctamente en el selector de cantidad; una solicitud creada con un punto propio del mapa (no el centro de Manizales) apareció con ese mismo punto exacto en Despachos al elegirla, y el nombre del solicitante precargado (editable) al confirmar la entrega. `npx tsc --noEmit` limpio.

### 2026-08-18 (noche) — Dos correcciones al switch de solo-disponibles, reportadas con captura

**Bug real, encontrado por Juan Manuel con una captura de pantalla:** el filtro de "Mostrar solo productos disponibles" solo podaba `catalog.products` — pero `ProductPicker` explora por grupo → categoría → producto usando `catalog.groups`/`catalog.categories`, listas que se quedaban completas. El resultado: con el switch activado seguían apareciendo grupos enteros (Despensas Armadas, Mascotas, Herramientas y Equipos…) cuyo único contenido ya estaba agotado — el clic no rompía nada (la categoría mostraba "no tiene productos"), pero prometía algo que el filtro ya había descartado, justo lo contrario de lo que pide el switch. Corregido en `pickerCatalog` (`solicitudes/nueva/page.tsx`): ahora poda `categories` a las que tengan al menos un producto con stock, y `groups` a los que tengan al menos una categoría así, en cascada junto con `products`. Verificado con datos reales: de 14 grupos del catálogo, solo los 4 que de verdad tienen algo disponible (Agua, Alimentos y Bebidas, Higiene Personal, Medicamentos y Botiquines) siguen apareciendo con el switch activado.

**Pedido explícito, agregado de una vez:** con el switch **apagado** (se permite pedir más de lo disponible, a propósito), el selector de cantidad ahora avisa cuando eso pasa — sin bloquear, solo informando: *"Solo hay N disponibles ahora mismo. El faltante (M) quedará registrado como demanda insatisfecha en «Productos faltantes»."* Es puramente informativo: el botón "Agregar" sigue habilitado, coherente con que ese excedente es justo el dato que ya alimenta la pantalla de faltantes desde antes — no hacía falta ningún cambio de backend, solo hacer visible en el momento lo que ya iba a pasar después.

Verificado con Playwright contra el servidor real: switch activado deja ver solo los 4 grupos con stock (confirmado leyendo la lista completa en pantalla, no asumido); pedir 10 de Arroz con el switch apagado (4 disponibles) muestra el aviso naranja con el faltante correcto (6) sin deshabilitar "Agregar".

### 2026-08-18 (noche) — Botones de acción en "En Revisión", y "Rechazados" al final de Inventario y Ubicaciones

Pedido explícito: botones al final de cada renglón de "En Revisión" para liberar a disponible o rechazar, con "Rechazados" como algo visible hasta el final tanto en Inventario como en Ubicaciones. Antes de tocar código se resolvió con Juan Manuel, por `AskUserQuestion`, la pregunta que cambiaba el diseño: rechazar es una **salida definitiva** del inventario (no una reubicación) — decisión que define todo lo demás, documentada con su razonamiento en el `CLAUDE.md` del backend.

- **"Liberar a disponible"** — botón directo en el renglón, sin abrir el panel de detalle. Reutiliza exactamente la misma escritura que ya usaba ese panel por remesa (`donation_items.classification_status`), solo que en bulk: busca todas las remesas en cuarentena de ese producto+ubicación y las pasa a `available` de una vez. El destino sale solo del propio dato — una remesa sin ubicación queda disponible sin ubicación, que es Por Ubicar, tal como ya describía el pedido.
- **"Rechazar"** — abre `RejectDialog` (cantidad + motivo obligatorio, con aviso de que no tiene deshacer) y llama a la ruta nueva del backend, `POST /api/inventory/{id}/reject`.
- **Bug real encontrado verificando el flujo completo, no al diseñarlo:** como rechazar no toca `donation_items` (a propósito — ver backend), un rechazo parcial deja la remesa marcada con más cantidad en cuarentena de la que en verdad queda en el saldo agregado. Un "liberar a disponible" posterior sobre ese mismo renglón fallaba con el error crudo del backend ("Cantidad en cuarentena insuficiente..."). Corregido en `releaseRow()`: si la suma de las remesas no coincide con `quarantine_qty`, se detiene antes de llamar a la API y explica qué pasó y qué hacer (abrir el detalle y resolverlo remesa por remesa) — en vez de dejar pasar un 400 que no dice cómo seguir.
- **Sección "Rechazados"**, al final de `/panel/inventario` (fuera del bloque que depende de los filtros de grupo/categoría/búsqueda — no es catálogo por ubicar, es un libro). No muestra un saldo — como la decisión fue "salida definitiva", no queda saldo que mostrar — sino el registro de qué se rechazó y por qué: lee directo de `inventory_movements` filtrando `movement_type = "rechazo"`, igual que ya hace Historial con `audit_log`.
- **Tarjeta "Rechazados" en `/panel/ubicaciones`**, deliberadamente separada de "Por Ubicar"/"En Revisión" (esas dos van juntas arriba porque son decisiones pendientes; "Rechazados" va sola, al final, porque ya es historia cerrada) — ícono `Ban` de `lucide-react`, enlaza a `/panel/inventario#rechazados`.

Verificado con Playwright contra el servidor real: liberar y rechazar funcionando por separado sobre renglones limpios; el caso de remesa contaminada por un rechazo parcial previo muestra el aviso nuevo en vez del error crudo; la sección y la tarjeta de Rechazados muestran los movimientos reales creados durante la prueba, con motivo y fecha. `npx tsc --noEmit` limpio.

### 2026-08-18 (noche) — Despliegue provisional en Vercel, y portada pública nueva con "Productos faltantes"

**Decisión de Juan Manuel, revierte la de esa misma mañana:** OTIC no respondió con el acceso al servidor de la UNAL y el aplicativo debía quedar en producción hoy. Se descarta "estrictamente en local hasta nuevo aviso" — Vercel para este repositorio, Fly.io para el backend, como plan **provisional**, con migración al servidor de la UNAL cuando haya VPN. Guía completa, con las variables de entorno exactas que pide Vercel, en [`DEPLOY-PROVISIONAL.md`](DEPLOY-PROVISIONAL.md).

**Portada pública rehecha por completo**, reemplazando el `(public)/page.tsx` genérico (vista previa de panel con datos de muestra) por el diseño real que Juan Manuel ya tenía preparado en `landing-face/` — una campaña de emergencia ("Unidos por Manizales", tras el sismo del 10 de agosto), con su propia paleta e identidad, deliberadamente distinta de los tokens utilitarios del resto de la app (no participa del selector de tema claro/oscuro: es una página de un solo vistazo, pensada para compartirse, no para vivir horas abierta como el panel).

- **Fuentes:** Ancízar sigue auto-hospedada (directriz ya vigente) — el diseño original pedía la serif en negrita itálica hotlinkeada a `fcen.unal.edu.co`, pero no existe ese archivo en el paquete propio del proyecto (solo regular y bold, sin itálica). Se usa la serif bold local con `italic` de CSS: el navegador sintetiza la inclinación. Verificado con zoom que el texto sigue siendo legible — a simple vista en una captura de página completa parecía ilegible, pero era una ilusión de la reducción de tamaño, no un glitch real.
- **`/api/requests/missing-products` ahora alimenta la portada**, sin sesión — `src/lib/public-missing-products.ts` (nuevo, sin `"use client"`) hace un `fetch()` liso del lado del servidor, con `revalidate: 30`. La página es un Server Component `async`: el HTML ya llega con los faltantes reales, sin spinner ni parpadeo, y sigue funcionando sin JavaScript. `MissingWanted` (nuevo, en `src/components/landing/`) es la vista — tarjetas con foto (Cloudinary, ya autorizado en `next.config.ts`), cantidad exacta que falta y una barra de cuánto ya está cubierto; mensaje distinto si no hay ningún faltante en ese momento.
- **Assets** copiados de `landing-face/assets/` a `public/landing/` (se excluyeron `akopia_favicon.svg`/`akopia_logo.svg`, ya resueltos en sesiones anteriores como `src/app/icon.svg` y `public/brand/akopia-logo.svg`).
- **`InstitutionalHeader`/`InstitutionalFooter` se conservan** envolviendo la portada nueva — siguen siendo obligatorios (enlaces de Gobierno en Línea, escudo, directriz B1) y el footer propio del diseño original (una sola línea de marca) quedó de más frente al footer institucional completo que ya existía.

Verificado con Playwright contra el servidor real, escritorio y móvil, más `npm run build` completo (no solo `tsc`): la portada compila como página estática con ISR de 30s, las cuatro fotos de productos faltantes cargan desde Cloudinary, sin errores de consola. Un 504 en las imágenes durante la primera captura resultó ser el "cold start" del optimizador de imágenes de Turbopack en desarrollo, no un bug — confirmado repitiendo la prueba con el servidor ya caliente, sin errores.

### 2026-08-18 (noche) — El backend provisional pasa de Fly.io a Railway

La tarjeta de Juan Manuel (incluida una virtual) fue rechazada dos veces por la verificación de Fly.io — sin eso no había forma de crear la cuenta. Se pivotó a Railway, donde ya tenía un plan de prueba de 30 días sin pedir tarjeta. `DEPLOY-PROVISIONAL.md` de este repo quedó actualizado con Railway como camino principal (todo por su dashboard web, sin CLI) y Fly.io al final como alternativa. La variable `NEXT_PUBLIC_PB_URL` de Vercel ahora apunta a un dominio `.up.railway.app` en vez de `.fly.dev` — el resto de variables de entorno no cambia. Detalle completo, incluido un mecanismo nuevo para crear los superusuarios de PocketBase sin necesitar consola/SSH del hosting, en el `CLAUDE.md` del backend.

### 2026-08-18 (noche) — Desplegado de verdad: Railway + Vercel arriba, con dos hallazgos reales en el camino

**El despliegue provisional quedó funcionando de punta a punta hoy mismo** — backend en Railway, frontend en Vercel, catálogo con fotos, login por Firebase confirmado. Dos problemas reales aparecieron y se resolvieron sobre la marcha, ninguno anticipado al escribir la guía:

1. **Desajuste de puerto en Railway.** El contenedor arrancaba bien (`Server started at http://0.0.0.0:8080`, el `$PORT` que Railway asigna), pero el dominio público seguía configurado para reenviar al puerto 8090 — el que `EXPOSE 8090` del `Dockerfile` sugería, no el real. Daba 502 "Application failed to respond" sin ninguna pista de por qué, hasta revisar los *Deploy Logs* (no los *Build Logs*, que sí se veían bien) y comparar el puerto real contra `Settings → Networking`. Se corrigió a mano, editando el puerto del dominio a 8080.
2. **Restaurar un respaldo completo no era lo que hacía falta.** El plan original era restaurar el zip de `/panel/respaldos` para traer el catálogo con sus fotos — pero ese respaldo trae *todo* (donaciones, solicitudes de prueba, etc.), y la base en Railway debía quedar limpia salvo el catálogo. Se resolvió con `scripts/sync-catalog-photos-to-remote.mjs` (nuevo): copia solo `photo_url` de grupos/categorías/productos desde el local hacia el remoto, emparejando por nombre (los ids no sirven — cada instancia sembró el catálogo por su cuenta, con ids propios). El resto del catálogo (nombres, categorías, unidades) ya estaba igual en los dos lados porque las migraciones lo siembran igual siempre; solo faltaba el enlace a Cloudinary. **Verificado contra el servidor real, no solo el `--dry-run`:** 189 registros actualizados, confirmado leyendo uno de vuelta con una petición autenticada aparte. Los 13 "sin equivalente en destino" eran productos de prueba creados durante las verificaciones con Playwright de esta sesión (Recogedor, pantaloneta, Aromatica...) — nunca estuvieron en el catálogo sembrado, así que saltarlos es lo correcto.

Detalle no menor: al cambiar `SERVICE_SUPERUSER_PASSWORD` en Railway para resolver un problema de autenticación, hay que actualizar **la misma variable en Vercel** (`POCKETBASE_SERVICE_PASSWORD`) — si no, el puente de Firebase se rompe en silencio (un 500 genérico) aunque el resto del sitio se vea perfecto, porque son rutas de código completamente distintas. Confirmado que Juan Manuel lo actualizó y probó el login real antes de dar esto por cerrado.

**Último tropiezo del día:** "Continuar con Google" fallaba en producción (`auth/unauthorized-domain`) aunque `akopia.vercel.app` ya estaba en la lista de dominios autorizados de Firebase. La causa: estaba agregado en el proyecto de Firebase equivocado — la cuenta de Juan Manuel tiene acceso a más de uno con nombre parecido (`fcenedit`/FCEN además del `akopia` real, el que de verdad usa la app según `NEXT_PUBLIC_FIREBASE_PROJECT_ID`), y la consola no avisa si estás parado en el que no es: el dominio se ve "agregado" igual en cualquiera de los dos proyectos. Corregido agregándolo en `akopia`; login por Google confirmado funcionando.

**Cierre del día: el despliegue provisional queda funcionando de punta a punta**, verificado en producción real — portada pública con catálogo y fotos, login por correo y por Google, y el resto del ciclo de negocio ya probado antes. Railway + Vercel, listo para recolectar datos reales.

### 2026-08-18 (noche) — Aire entre el logo y el subtítulo en la cabecera institucional

Reportado con captura: el logo de AKOPIA y "Centro de acopio · Sede Manizales" se veían pegados en `InstitutionalHeader`, sin espacio entre ellos ni centrados verticalmente contra el resto de la cabecera. El contenedor usaba `inline-block` con el `<span>` en `block` (sin margen) para apilarlos, y aunque `self-stretch` alargaba el contenedor a toda la altura de la cabecera, no había nada que centrara el contenido dentro de ese alto. Cambiado a `flex flex-col items-start gap-1.5` en el enlace (separa logo y subtítulo con aire real) y `flex items-center` en el contenedor que ya tenía `self-stretch` (centra ese bloque verticalmente contra el escudo). Verificado con Playwright, capturando solo el `<header>`.

### 2026-08-18 (noche) — Selector de tema también en la portada pública y en login

Pedido explícito: el selector de tema claro/oscuro solo vivía en `AppShell` (la app de bodega); se agregó también a `InstitutionalHeader`, que es compartido por `(public)/layout.tsx` — cubre `/` y `/login` de una sola vez, sin tocar cada página. Mismo componente `ThemeToggle`, sin cambios: el atributo `data-theme` en `<html>` ya era global desde que se creó, así que no hizo falta ninguna mecánica nueva, solo mostrar el control donde antes no estaba.

Verificado con Playwright contra el servidor real, en `/` y `/login`: el selector aparece junto a "Iniciar sesión"/"Registrarse", cambia el tema al instante en ambas páginas (capturas en claro y oscuro), sin errores de consola. `npx tsc --noEmit` limpio.

### 2026-08-18 (noche) — El escudo UNAL se corrige en tema claro, sin recolorear el archivo

Reportado con captura, justo al agregar el selector de tema al header público: `escudo-unal.svg` es todo relleno blanco fijo (`fill:#FFFFFF`) — hallazgo ya documentado como pendiente el 18 de agosto, al entregar el logo de AKOPIA, pero sin corregir entonces por no ser parte de ese pedido. Con el selector de tema ahora visible en la portada, el problema dejó de ser un caso raro (fondo oscuro poco usado) para ser el estado por defecto de cualquiera que entre en claro.

**No se tocó el SVG fuente** — sigue siendo la marca oficial tal como la entregó Unimedios, coherente con la directriz B1 ("no se recolorea"). En vez de eso, un filtro CSS (`filter: invert(1)`) se aplica solo en tema claro, a través del mismo patrón de tres bloques que ya sincroniza el resto de tokens de tema (`globals.css`): `--unal-shield-filter` vale `invert(1)` en `:root` (claro) y `none` en los dos bloques oscuros — como el escudo es un solo color sólido, invertir blanco produce negro exacto, sin artefactos. Aplicado con la sintaxis de propiedad arbitraria de Tailwind v4 (`[filter:var(--unal-shield-filter)]`) en el único lugar donde se usa el escudo, `InstitutionalHeader`.

Verificado con Playwright contra el servidor real: negro y legible en tema claro, blanco como ya estaba en tema oscuro, sin errores de consola. `npx tsc --noEmit` limpio.

### 2026-08-18 (noche) — Plantilla web institucional de la UNAL, en los tres momentos de la app

Pedido explícito de Juan Manuel: adoptar la plantilla oficial de Unimedios (`Plantilla-Pagina-Web_17-07-2026/`, HTML/CSS/JS clásico — jQuery + Bootstrap, sin build system) en portada, login/registro y la app completa — resolviendo, en un sentido, la decisión que el propio `CLAUDE.md` raíz tenía abierta desde el 17 de agosto ("directriz B3 — ¿aplica también después del login?"). Antes de tocar código se resolvieron cuatro decisiones reales con `AskUserQuestion`: agrupación del menú principal, eliminar la fila de "Perfiles", franja de cuenta fija en las tres superficies, y no portar los widgets de la demo (GSAP/Swiper/video.js).

**Arquitectura:** tres route groups nuevos — `(landing)`, `(auth)`, `(app)` — reemplazan a `(public)`/`(app)`, cada uno envolviendo su contenido (sin tocar su lógica interna) en un único `<UnalShell>` (`src/components/unal-template/`), que agrupa header, panel de accesibilidad, franja de cuenta y footer de la plantilla bajo **un solo** contenedor `.unal-chrome`. Esto no fue arbitrario: varias reglas del CSS de la plantilla (`main.detalle`, `footer`, la miga de pan) exigen que header/contenido/footer compartan el mismo ancestro — un `.unal-chrome` por componente, como se intentó primero, no cumple esos selectores.

**El riesgo técnico real, y el hallazgo que se llevó la mayor parte del tiempo:** el CSS de la plantilla se generó con un script nuevo (`scripts/scope-unal-template-css.mjs`, `postcss-prefix-selector`) que antepone `.unal-chrome` a cada selector para no filtrarse al resto de Tailwind — pero eso solo resuelve la mitad del problema:

1. **Tailwind v4 mete todo su CSS en cascade layers** (`@layer theme, base, components, utilities`). En CSS, cualquier regla **sin capa** le gana a **cualquier regla con capa**, sin importar especificidad. Como mis hojas de la plantilla se cargan como `<link>` normales (sin capa), `.unal-chrome h1{font-family:"Ancizar serif"}` le ganaba a cualquier clase de Tailwind puesta en un `<h1>` real de la app — confirmado viendo el título "Inventario" renderizarse en la tipografía equivocada y, en modo oscuro, con el texto casi invisible (`body{color:#212529}` de Bootstrap, heredado hacia todo el árbol porque `body`/`html` se dejaron sin escopear a propósito para que el zoom/contraste/inversión de accesibilidad siguieran afectando toda la página, no solo el cabezote).
2. **La solución no podía ser "meter toda la plantilla en una capa de baja prioridad"** — eso resuelve la fuga hacia el contenido, pero rompe el propio layout del cabezote: el escudo (`position:absolute`, 135px de alto) empezó a solaparse sobre el menú de Sedes, interceptando los clics, porque `#unalTop` perdió la altura que antes le daban reglas de la plantilla que ahora perdían contra el preflight de Tailwind. El script terminó con **dos capas por regla, no una global**: un segmento de selector se clasifica como "genérico puro" (una sola etiqueta HTML, sin clase/id — `h1`, `p`, `a`, el reset universal de Meyer) y va a una capa con **menor** precedencia que Tailwind (registrada en `src/app/unal-template-layer.css`, importada antes de `@import "tailwindcss"` en `globals.css` — el orden de la *primera mención* de una capa nombrada es lo que fija su precedencia, sin importar en qué archivo real se define después). Todo lo demás — `.logo`, `#unalTop`, `.mainMenu`, cualquier selector calificado con una clase/id propio de la plantilla — va **sin capa**, porque nunca coincide por accidente con nada de React y necesita ganar siempre para no romper su propio diseño.
3. `accesibilidad.js` registra el clic de la pestaña vía `window.onload` — que en Next.js ya disparó para cuando el script carga (`next/script` con `afterInteractive` corre tras la hidratación), así que el listener nunca llegaba a engancharse. Se invoca la misma función (`window.accesstab()`, sin tocar el archivo) desde un `onClick` de React en su lugar.

**Contenido nuevo, no solo estructura:** menú principal agrupado (`Panel | Operación ▾ | Inventario ▾ | Administración ▾` + `Sedes ▾`, 5 de 6 permitidos, "Administración" solo visible para `role:admin` vía `menuForRole()`), sin fila de "Perfiles" (eliminada, la directriz B3 lo permite), franja de cuenta (`AccountBar`) con "Iniciar sesión"/"Registrarse" o "Hola, {nombre} · Salir" en el área de contenido de las tres superficies, miga de pan automática por ruta (`Breadcrumb`, se autosuprime en la portada), panel de accesibilidad con una quinta columna "Tema" (Claro/Sistema/Oscuro, reutilizando `applyTheme()`/`getStoredTheme()` de `theme.ts` sin cambios ahí). Favicon reemplazado por el escudo UN de la propia plantilla (obligatorio por B3); `icon.svg` (la marca verde de AKOPIA) retirado. `AppShell` e `InstitutionalHeader`/`Footer` se eliminaron por completo — la guarda de sesión que tenía el primero se extrajo a `useSessionGuard()` (`src/lib/`), reusada tal cual por `(app)/layout.tsx`. `ThemeToggle` quedó huérfano tras el cambio y también se eliminó.

Verificado con Playwright contra el servidor real (dev + PocketBase local), no solo leído: las tres superficies sin errores de consola; panel de accesibilidad abre/cierra y los 5 controles funcionan; dropdown de Sedes y los tres grupos del menú de la app abren correctamente; sesión real (`admin@akopia.org`) navegando `/panel/inventario` — la pantalla más compleja del proyecto — sin ninguna regresión visual, en claro y en oscuro, tras el arreglo de las dos capas. `npx tsc --noEmit` y `npm run build` limpios.
