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
