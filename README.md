# AKOPIA — Frontend

Interfaz web del sistema de gestión del **Centro de Acopio de la Universidad Nacional de Colombia, sede Manizales**. Next.js 16 + TypeScript + Tailwind v4, contra un backend [PocketBase](https://github.com/fcenwebunal/akopia-backend).

> 🚀 **¿Primera vez?** Empieza por **[PUESTA-EN-MARCHA.md](PUESTA-EN-MARCHA.md)**: levanta el frontend y el backend juntos, y comprueba que se están hablando. Unos 15 minutos.
>
> 🖥️ **¿Vas a desplegar?** Mientras no haya acceso al servidor de la UNAL, el despliegue real vive en hosting público — ver **[DEPLOY-PROVISIONAL.md](DEPLOY-PROVISIONAL.md)** (Railway + Vercel).
>
> Este README es la referencia del frontend: identidad visual, estructura de pantallas y cómo aportar código.

---

## Índice

1. [Qué es AKOPIA y para qué sirve](#1-qué-es-akopia-y-para-qué-sirve)
2. [El stack, y por qué](#2-el-stack-y-por-qué)
3. [Instalación paso a paso](#3-instalación-paso-a-paso)
4. [Cómo está organizado el proyecto](#4-cómo-está-organizado-el-proyecto)
5. [Identidad visual UNAL: lo que no se negocia](#5-identidad-visual-unal-lo-que-no-se-negocia)
6. [Hablar con el backend](#6-hablar-con-el-backend)
7. [Cómo aportamos código](#7-cómo-aportamos-código)
8. [Estado actual y hoja de ruta](#8-estado-actual-y-hoja-de-ruta)
9. [Solución de problemas](#9-solución-de-problemas)

---

## 1. Qué es AKOPIA y para qué sirve

Un centro de acopio recibe donaciones, las clasifica, las guarda y las entrega a quien las necesita. Cuando eso se lleva en papel o en una hoja de cálculo compartida fallan siempre tres cosas: no se sabe qué hay realmente en bodega, no se sabe quién movió qué, y lo que se le prometió a alguien puede haberse entregado ya a otro.

AKOPIA cubre el flujo completo:

```
recepción → clasificación → inventario → solicitud → reserva → despacho → entrega
```

Este repositorio es **la interfaz**. La lógica de negocio —los saldos de inventario, las validaciones, la auditoría— vive en el backend y no se replica aquí. Ver [§6](#6-hablar-con-el-backend).

**Contexto institucional.** Proyecto de la Facultad de Ciencias Exactas y Naturales (FCEN) de la UNAL Manizales. El sitio público debe cumplir las directrices de identidad de Unimedios. El despliegue final va a infraestructura de la Universidad, bajo el subdominio propuesto `acopio.manizales.unal.edu.co`.

### Dos superficies, un mismo proyecto

Esta distinción atraviesa todo el código y conviene tenerla clara antes de escribir una línea:

| | Sitio público | App de bodega |
|---|---|---|
| **Rutas** | `/`, `/login`, `/registro` | tras el login |
| **Grupo** | `src/app/(public)/` | `src/app/(app)/` |
| **Quién lo ve** | Cualquiera | Operadores autenticados |
| **Diseño** | Identidad institucional completa: escudo, Ancízar, verde UNAL, pie de Gobierno en Línea | Layout propio, **móvil primero**, pensado para usarse de pie en la bodega |

Se separan con [grupos de rutas](https://nextjs.org/docs/app/building-your-application/routing/route-groups) para que cada superficie tenga su propio `layout.tsx` y la plantilla institucional nunca condicione el diseño de las pantallas de operación.

---

## 2. El stack, y por qué

| Pieza | Elección | Por qué |
|---|---|---|
| Framework | **Next.js 16** (App Router) | Es lo que ya usaba la maqueta. Renderizado estático para el sitio público, cliente para la app |
| Lenguaje | **TypeScript**, estricto | Los tipos del backend se generan (§6): un cambio de esquema rompe la compilación en vez de romper producción |
| Estilos | **Tailwind v4** | Los colores institucionales se declaran una vez como tokens en `globals.css` y se usan como `bg-unal-green-dark` |
| Tipografía | **Ancízar**, auto-hospedada con `next/font/local` | Es la tipografía institucional. Ningún CDN la distribuye, y la red de la Universidad no siempre deja salir a uno |
| Backend | **SDK oficial de PocketBase** | Autenticación, CRUD y tiempo real por SSE, sin capa intermedia |

> **No agregues dependencias sin discutirlo.** Nada de librerías de componentes, gestores de estado ni clientes HTTP: Next, Tailwind y el SDK de PocketBase cubren lo que este proyecto necesita. Si algo parece requerir una pieza nueva, abre un issue antes.

---

## 3. Instalación paso a paso

### Requisitos

- **Node.js 20 o superior** — comprueba con `node --version`
- **git**
- **El backend corriendo en local.** Sin él la app carga pero no puedes autenticarte. Sigue el [README del backend](https://github.com/fcenwebunal/akopia-backend) primero.

### Paso 0 — Dónde clonar

> ⚠️ **No clones dentro de una carpeta sincronizada con Google Drive, OneDrive o Dropbox.** Sincronizan archivo por archivo y corrompen tanto `.git/` como `node_modules/`. Usa una ruta local.

### Paso 1 — Clonar e instalar

```bash
git clone https://github.com/fcenwebunal/akopia-frontend.git
cd akopia-frontend
npm install
```

### Paso 2 — Configurar la URL del backend

```bash
cp .env.example .env.local
```

`.env.local` está en `.gitignore` y no se commitea. Su contenido por defecto ya apunta al backend local:

```bash
NEXT_PUBLIC_PB_URL=http://127.0.0.1:8090
```

> **Ningún dominio se escribe en el código.** El mismo build tiene que servir en local, en el Ubuntu de pruebas y en la infraestructura de la UNAL. Si alguna vez ves una URL literal en un `.tsx`, es un bug.

### Paso 3 — Levantar

```bash
npm run dev
```

La app queda en `http://localhost:3000`.

### Paso 4 — Verificar que quedó bien

1. **`http://localhost:3000`** — carga el sitio público con el escudo de la UNAL, el verde institucional y la tipografía Ancízar. Si ves una tipografía genérica del sistema, las fuentes no están cargando (§9).
2. **`http://localhost:3000/login`** — entra con `admin@akopia.org` y la contraseña que pusiste en el `.env` del backend. Debe autenticarte contra PocketBase.
3. Si el login responde *«No se pudo conectar con el servidor»*, el backend no está corriendo o `NEXT_PUBLIC_PB_URL` apunta a otro lado.

### Comandos disponibles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Build de producción. **Debe pasar antes de cualquier PR** |
| `npm run start` | Sirve el build de producción |
| `npm run lint` | ESLint |

---

## 4. Cómo está organizado el proyecto

```
akopia-frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx           # raíz: fuentes, metadatos, <html lang="es">
│   │   ├── globals.css          # tokens de identidad UNAL + Tailwind
│   │   ├── (public)/            # ── SITIO PÚBLICO ──
│   │   │   ├── layout.tsx       # cabecera y pie institucionales
│   │   │   ├── page.tsx         # portada
│   │   │   ├── login/
│   │   │   └── registro/
│   │   └── (app)/               # ── APP DE BODEGA (tras el login) ──
│   │       ├── layout.tsx       # guarda de sesión y cromo propio
│   │       └── panel/
│   │           ├── page.tsx     # resumen del día
│   │           ├── donaciones/
│   │           └── inventario/
│   ├── components/
│   │   ├── unal/                # piezas de identidad institucional
│   │   │   ├── institutional-header.tsx
│   │   │   └── institutional-footer.tsx
│   │   └── app/
│   │       └── app-shell.tsx    # guarda de sesión + navegación de la app
│   ├── lib/
│   │   ├── pb.ts                # cliente de PocketBase, tipos y errores
│   │   ├── use-async-data.ts    # carga de datos en componentes de cliente
│   │   └── fonts.ts             # Ancízar Sans y Serif
│   └── fonts/                   # .woff2 de la plantilla oficial
├── public/unal/                 # escudo UNAL y sello de Colombia
└── .env.local                   # NEXT_PUBLIC_PB_URL (no se commitea)
```

### Convenciones

- **Archivos en `kebab-case`**, componentes en `PascalCase`.
- **Código en inglés** —identificadores, comentarios, commits—; **texto visible en español**, porque lo lee un operador de bodega.
- **Comentarios solo cuando la lógica no es evidente**, y explicando el *porqué*, no el *qué*.
- **`rem` para medidas CSS**; píxeles solo para bordes y sombras. Con Tailwind esto ya se cumple: su escala está en `rem`.

---

## 5. Identidad visual UNAL: lo que no se negocia

Fuentes: [guía de identidad visual](https://identidad.unal.edu.co/guia-identidad-visual/b-directrices-y-especificaciones/b1-elementos-de-identidad-visual/) y [directrices web](https://identidad.unal.edu.co/guia-web/b-directrices-y-especificaciones/).

### Colores

Declarados una sola vez en `src/app/globals.css`. **Úsalos siempre por su token**, nunca escribiendo el hex a mano.

| Token Tailwind | Hex | Uso |
|---|---|---|
| `unal-green` | `#94B43B` | Color institucional. Acentos, bordes, indicadores |
| `unal-green-dark` | `#6F8A24` | Variante para texto y botones — el verde puro no alcanza contraste AA sobre blanco |
| `unal-green-soft` | `#EEF3E0` | Fondos suaves |
| `unal-orange` | `#E15E42` | Complementario |
| `unal-red` | `#DC313A` | Complementario. Errores |
| `unal-yellow` | `#F8C21C` | Complementario. Avisos |
| `unal-aqua` | `#33B3BC` | Complementario. Información |

> El verde institucional `#94B43B` sobre blanco da una relación de contraste de ~2.1:1, por debajo del 4.5:1 que exige WCAG AA para texto. Por eso existe `unal-green-dark`: **el verde puro se usa para superficies y acentos, no para texto pequeño.**

### Tipografía

**Ancízar** es la tipografía institucional exclusiva de la Universidad. Los `.woff2` de `src/fonts/` vienen de la plantilla oficial de Unimedios y se sirven desde el propio dominio.

- `font-sans` → **Ancízar Sans** (300, 400, 700, 800, 900) — todo el texto de interfaz
- `font-serif` → **Ancízar Serif** (400, 700) — citas y textos destacados

No sustituyas Ancízar por una similar de Google Fonts, y no la cargues desde un CDN.

### Escudo y sello

En `public/unal/`. El escudo:

- Enlaza siempre a `https://unal.edu.co`
- Conserva su área de protección (¼ de su altura)
- **No se recorta, no se recolorea, no se le aplican sombras ni perspectiva**
- No se mezcla ni se compone con el logotipo de AKOPIA: son marcas distintas y van separadas

### Accesibilidad (directriz B6)

- `lang="es"` en `<html>`
- Enlace «Saltar al contenido principal» al inicio de cada página pública
- El foco visible nunca se elimina, solo se rediseña
- `prefers-reduced-motion` respetado globalmente
- Etiquetas asociadas a cada campo de formulario; errores con `role="alert"`

### Directriz B3 — pendiente de confirmación

Falta confirmar por escrito con la Oficina de Medios Digitales si la plantilla institucional completa aplica **también después del login** o si basta una barra institucional reducida.

Mientras tanto, la decisión tomada es: **identidad completa en el sitio público, layout propio en la app de bodega.** Si Unimedios exige la plantilla completa en todas partes, cambia el diseño de todas las pantallas de operación — por eso conviene resolverlo antes de construirlas.

---

## 6. Hablar con el backend

### El cliente

Uno solo, en [`src/lib/pb.ts`](src/lib/pb.ts). No instancies `new PocketBase(...)` en ningún otro sitio.

```ts
import { pb, errorMessage } from "@/lib/pb";

const auth = await pb.collection("users").authWithPassword(email, password);
const items = await pb.collection("donations").getList(1, 20, { sort: "-created" });
```

El SDK persiste la sesión en `pb.authStore` y renueva el token solo.

### La regla que hay que entender antes de escribir una pantalla

> **La lógica de negocio vive en el backend. El frontend no la replica.**

El backend mantiene tres saldos por producto y ubicación —`available_qty`, `reserved_qty`, `quarantine_qty`— y **nunca se editan directamente**: se crea un registro y los hooks del servidor generan el movimiento y ajustan el saldo, todo dentro de una misma transacción.

En la práctica, desde el frontend:

| ❌ No hagas esto | ✅ Haz esto |
|---|---|
| `PATCH /inventory` para restar cantidad | `PATCH /donation_items` cambiando `classification_status` |
| Calcular el saldo sumando movimientos | Leer `inventory.available_qty` |
| Validar en el cliente y confiar en eso | Validar en el cliente **para la experiencia**, y mostrar el error del servidor cuando llegue |
| Generar el código `DON-000001` | Omitir `code`: el servidor lo asigna |

Los mensajes de error del backend **ya vienen en español** y están escritos para un operador de bodega. `errorMessage()` los extrae; muéstralos tal cual en vez de sustituirlos por un texto genérico.

### Tipos generados, no escritos a mano

Con el backend corriendo y su `pb_data` a mano:

```bash
npx pocketbase-typegen --db ../akopia-backend/pb_data/data.db --out ./src/types/pb.ts
```

Así un cambio de esquema rompe la compilación aquí en vez de romperse en producción.

### Renderizado en servidor

`pb.authStore` vive en el navegador. Un componente de servidor **no** ve la sesión del usuario a menos que le pases la cookie de auth explícitamente en cada petición. Es el punto donde más se tropieza al integrar Next con PocketBase: si una pantalla necesita datos autenticados, o es un componente de cliente, o reenvía la cookie a mano.

---

## 7. Cómo aportamos código

### Ramas

`main` siempre desplegable. Todo sale de `main` y vuelve por Pull Request.

| Prefijo | Para | Ejemplo |
|---|---|---|
| `feat/` | Funcionalidad nueva | `feat/pantalla-recepcion` |
| `fix/` | Corregir algo roto | `fix/contraste-boton-verde` |
| `docs/` | Documentación | `docs/guia-identidad` |
| `chore/` | Herramientas, configuración | `chore/eslint-a11y` |

### Commits

*Conventional Commits*: `tipo(alcance): descripción en imperativo`. El cuerpo explica el **porqué**, no el **qué**.

```
feat(donations): add the donation intake screen

First real integration against the backend hooks: creating a donation
without a code must come back with DON-000001 assigned by the server.
```

### El ciclo completo

```bash
git switch main
git pull origin main
git switch -c feat/pantalla-recepcion

# … trabajar, con el backend corriendo en local …

npm run build          # debe pasar
git add src/
git commit -m "feat(donations): add the donation intake screen"
git push -u origin feat/pantalla-recepcion
gh pr create --fill
```

### Cinco reglas del repositorio

1. **`npm run build` debe pasar antes de abrir el PR.** TypeScript está en estricto y el build falla con cualquier error de tipos.
2. **Ningún dominio ni URL en el código.** Todo por `NEXT_PUBLIC_PB_URL`.
3. **Los colores y la tipografía se usan por token.** Si escribes `#94B43B` a mano en un componente, el siguiente cambio de identidad no te va a encontrar.
4. **Nada de lógica de inventario en el cliente.** Si te ves calculando saldos, la operación le corresponde al backend.
5. **Documenta lo que cambió el contrato.** Si tocas la estructura de rutas, los tokens de identidad o la forma de hablar con el backend, actualiza este README y el `CLAUDE.md` en el mismo PR.

### Si trabajas con un asistente de IA

Lee [`CLAUDE.md`](CLAUDE.md) — resume el contexto, el estado actual y las restricciones que no se pueden inferir del código.

---

## 8. Estado actual y hoja de ruta

### Implementado

- ✅ Sitio público con identidad institucional: cabecera con escudo, pie de Gobierno en Línea, Ancízar auto-hospedada, paleta UNAL como tokens
- ✅ Portada, con el contenido de la maqueta original
- ✅ `/login` funcional contra la colección `users` de PocketBase
- ✅ `/registro` — ver la nota de abajo
- ✅ Cliente de PocketBase con manejo de errores en español
- ✅ Accesibilidad base: saltar al contenido, foco visible, `prefers-reduced-motion`, formularios etiquetados
- ✅ **App de bodega** en `(app)/`, con guarda de sesión y layout móvil primero:
  - `/panel` — resumen del día con datos reales: donaciones de hoy, artículos por clasificar, solicitudes pendientes, productos con saldo y productos en cuarentena
  - `/panel/donaciones` — últimas donaciones con su código, donante y operador
  - `/panel/inventario` — los tres saldos por producto y ubicación

### Cómo se cargan los datos

Todas las pantallas de la app usan [`useAsyncData`](src/lib/use-async-data.ts). Existe por una razón concreta: la regla `react-hooks/set-state-in-effect` marca cualquier función que acabe llamando a `setState` desde un efecto, aunque lo haga después de un `await`. Pedir datos a un servicio externo es justo para lo que sirve un efecto, así que la excepción se justifica **una vez** en ese hook en vez de repetirse en cada pantalla.

El `fetcher` que se le pasa **tiene que venir envuelto en `useCallback`**, o el efecto se dispara en cada render.

### Nota sobre `/registro`

La maqueta original ofrecía registro público, pero `users.createRule` en el backend es `@request.auth.role = 'admin'`: **solo un administrador puede crear usuarios.** Un formulario de registro fallaría con 400 en cada envío.

La página explica el procedimiento real en vez de simular uno que no funciona. **Es una decisión de producto pendiente:** o se abre el registro en el backend, o esta pantalla se queda como está. Para un centro de acopio con operadores acreditados, lo segundo parece lo correcto.

### Siguiente, en orden

Las pantallas van en el orden del flujo real, porque cada una cierra su historia de usuario y se puede demostrar sola:

1. **Recepción de donación** — la primera integración real contra los hooks
2. **Clasificación** — la que dispara los movimientos de entrada y cuarentena; es la que confirma que el inventario cuadra
3. **Consulta de inventario** — los tres saldos por producto y ubicación
4. **Solicitud de ayuda** → **reserva** → **despacho** → **confirmación de entrega**

Antes o en paralelo:

- Tipos generados desde el esquema, como script de npm
- Confirmar la directriz B3 con Medios Digitales

---

## 9. Solución de problemas

| Síntoma | Causa y solución |
|---|---|
| *«No se pudo conectar con el servidor»* al entrar | El backend no está corriendo. Levanta PocketBase en `127.0.0.1:8090` |
| El login responde 400 | Contraseña incorrecta, o la migración `023` del backend nunca corrió. Revisa el `.env` del backend |
| La tipografía se ve genérica | Faltan los `.woff2` en `src/fonts/`. Vienen de la plantilla oficial de Unimedios |
| `Module not found: @/lib/pb` | Falta `npm install`, o el alias `@/*` se rompió en `tsconfig.json` |
| Cambios en `.env.local` que no surten efecto | Las variables `NEXT_PUBLIC_*` se incrustan en el build: reinicia `npm run dev` |
| El build pasa pero producción se ve distinta | Casi siempre son clases de Tailwind construidas por concatenación. Escribe la clase completa o usa un mapa de clases |
| Corrupción rara de `node_modules` o `.git` | ¿El repositorio está en Google Drive u OneDrive? Muévelo a una ruta local |

---

## Documentos relacionados

- [`CLAUDE.md`](CLAUDE.md) — contexto del proyecto y bitácora de avances
- [Backend](https://github.com/fcenwebunal/akopia-backend)
- [Guía de identidad visual UNAL](https://identidad.unal.edu.co/guia-identidad-visual/b-directrices-y-especificaciones/b1-elementos-de-identidad-visual/)
- [Directrices web UNAL](https://identidad.unal.edu.co/guia-web/b-directrices-y-especificaciones/)
- [Documentación de Next.js](https://nextjs.org/docs) · [SDK de PocketBase](https://github.com/pocketbase/js-sdk)
