# Propuesta — Captura rápida de inventario

> ## ⚠️ ALCANCE RECORTADO — 17 ago 2026
>
> **Sin variantes, sin marcas, sin lotes y sin código de barras.** El inventario se lleva por producto, como hoy.
>
> Lo que **sí** sigue vigente de este documento, y es lo que se está construyendo:
>
> - **Recientes de la sesión** y **búsqueda** como caminos principales; la jerarquía como red de seguridad.
> - **Borrador local y envío al final**, no artículo por artículo.
> - **Dos disposiciones** para la pantalla de recepción: móvil primero y escritorio.
> - **Atributos por categoría** (vencimiento en alimentos, no en cobijas).
>
> Lo que queda fuera: escáner, marca, presentación y todo el §3.

---

**Cómo debería registrarse una remesa de 40 referencias sin que el sistema estorbe.**

Evaluación de la metodología propuesta (jerarquía grupo → subgrupo → producto → marca → presentación), con los cambios que recomiendo y por qué.

---

## 1. El problema real no es encontrar, es repetir

La pregunta de diseño no es «¿cómo encuentro las lentejas?» sino «¿cuántos gestos me cuesta registrar 40 referencias antes de que el operario decida que es más rápido en papel?».

Ese es el listón. Si registrar una remesa toma más que anotarla en una hoja, el sistema no se usa — y un inventario a medio llenar es peor que no tener inventario, porque la gente confía en él.

Con eso en mente, hay tres cosas que pasan en una recepción real y que conviene tener presentes:

- **Lo que llega viene agrupado.** No son 40 productos distintos: son 12 cajas de lo mismo, luego 8 de otra cosa. La operación dominante es *repetir*, no *buscar*.
- **Las manos están ocupadas.** El operario carga, cuenta y registra. Cada gesto que exige mirar la pantalla cuesta el doble.
- **La conexión falla.** En una bodega, la señal es mala justo donde se descarga.

---

## 2. Lo que dice el catálogo actual

Antes de opinar sobre la jerarquía, medí su forma real:

| | Cantidad |
|---|---|
| Grupos | 11 |
| Categorías | 55 |
| Productos | 123 |
| **Productos por categoría** | **3 en promedio** (máximo 7) |

| Grupo | Categorías | Productos |
|---|---|---|
| Alimentos y Bebidas | 14 | 47 |
| Higiene Personal | 10 | 13 |
| Medicamentos y Botiquines | 5 | 11 |
| Herramientas y Equipos | 3 | 11 |
| Ropa y Calzado | 6 | 9 |
| Limpieza del Hogar | 5 | 7 |
| Mascotas | 2 | 7 |
| Agua | 4 | 6 |
| Materiales de Construcción | 2 | 6 |
| Cobijas y Colchonetas | 3 | 5 |
| **Despensas Armadas** | **0** | **0** |

> **Hallazgo suelto:** «Despensas Armadas» no tiene ni categorías ni productos. O se siembra o se retira, porque hoy es un callejón sin salida en cualquier menú.

### Qué significa esto para la jerarquía

**Tres niveles de navegación para elegir entre 3 opciones no compensan.** El operario toca grupo, toca categoría, y llega a una pantalla con dos o tres productos. Gastó tres gestos para descartar 120 elementos que nunca iba a considerar.

Esto **no** invalida tu metodología. La invalida *para el catálogo de hoy*. En el momento en que agregues marca y presentación —que es lo que pides— el nivel de abajo pasa de 3 a varias decenas, y ahí la jerarquía sí gana. Es decir: **la jerarquía es la estructura correcta para el catálogo que vas a tener, no para el que tienes.**

La conclusión práctica: constrúyela, pero **no la pongas como camino principal**. Debe ser la red de seguridad, no la autopista.

---

## 3. El bloqueante: marca y presentación no existen

Tu flujo dice «busco la marca y presentación (peso, libra, caja, unidad)». Eso hoy **no se puede construir**, y no es un detalle de interfaz.

`products` tiene: `name`, `category_id`, `default_unit_id`, `description`, `min_stock_alert`, `requires_batch`, `requires_expiry`, `requires_quarantine`, `is_fragile`, `is_hazardous`, `active`.

No hay marca. No hay presentación. **No hay código de barras.** Sin eso no hay escáner, ni distinción entre una bolsa de 500 g y una de 1 kg.

### La propuesta: separar producto de variante

```
grupo         Alimentos y Bebidas        11        ← taxonomía, la fija el admin
  categoría   Granos y Cereales          55
    producto  Lentejas                  123        ← el catálogo maestro actual
      variante  Marca X · bolsa 500 g   ~2000      ← nuevo: lo que realmente se recibe
                Marca X · bolsa 1 kg
                Marca Y · caja 12×500 g
```

Una colección nueva, `product_variants`:

| Campo | Para qué |
|---|---|
| `product_id` | A qué producto del catálogo pertenece |
| `brand` | Marca. Vacío para lo que no la tiene (ropa donada, granel) |
| `presentation` | «Bolsa 500 g», «Caja 12 unidades» |
| `content_qty` + `content_unit_id` | 500 + gramos. Permite convertir a la unidad base |
| `barcode` | EAN-13 / UPC, con índice único. **La llave del escáner** |
| `attributes` | JSON para lo que cambia según la categoría (§7) |
| `created_by` | Quién la creó, para revisar altas de operarios |

### La decisión que hay que tomar ahora, no después

**¿El inventario se lleva por producto o por variante?**

Recomiendo **por variante**, y conviene decidirlo ya: hoy hay 0 registros reales de inventario, así que el cambio es una migración. Con datos cargados, es una migración de datos.

| | Por producto (hoy) | Por variante (propuesto) |
|---|---|---|
| «¿Cuánto arroz tengo?» | Directo | Suma de variantes — ya lo hace `/api/inventory/summary` |
| «¿Cuántas bolsas de 1 kg?» | **Imposible** | Directo |
| Vencimiento y lote | Ambiguo: ¿de cuál bolsa? | Del paquete concreto |
| Alistar un despacho | «12 kg de arroz» — el operario tiene que decidir | «12 bolsas de 1 kg» |

Un centro de acopio **entrega paquetes, no kilogramos**. Quien alista un despacho toma unidades de un estante. Si el sistema solo sabe kilos, la persona hace la conversión mental cada vez, y ahí es donde aparecen los errores.

---

## 4. Cuatro caminos de entrada, no uno

La jerarquía como único camino es el error a evitar. Propongo cuatro, ordenados por velocidad, todos desembocando en la misma pantalla de cantidad:

### 1. Escáner — 1 gesto

El código de barras **no es una función aparte: es un atajo que colapsa la jerarquía entera**. Un escaneo resuelve grupo, categoría, producto y variante de una vez. Es la diferencia entre 5 gestos y 1.

### 2. Recientes — 1 toque

En una remesa se repiten las mismas 10 referencias. La pantalla arranca con lo último registrado *en esta sesión*, en botones grandes. La segunda caja de lentejas debería ser un toque, no cinco.

**Esta es la mejora de mayor impacto y la más barata de construir.** No necesita esquema nuevo ni escáner: es memoria de la sesión.

### 3. Búsqueda — escribir 3 letras

Un campo que busca a la vez en producto, marca y presentación. «lent» devuelve las variantes de lentejas. Para 123 productos esto ya es más rápido que navegar; con 2000 variantes sigue siéndolo si los resultados se ordenan por frecuencia de uso.

### 4. Jerarquía — la red de seguridad

Para quien no sabe cómo se llama lo que tiene en la mano, o es su primer día. Nunca desaparece, pero no es el camino por defecto.

> **Regla de diseño:** los cuatro caminos terminan en la misma pantalla de captura. Nadie tiene que aprender dos flujos.

---

## 5. La pantalla de recepción: dos disposiciones, no una

«Mobile first con soporte de PC» normalmente significa un layout que se estira. **Para esta pantalla no debería serlo**, porque el PC tiene un escáner y eso cambia el gesto dominante.

### Móvil — el pulgar manda

```
┌─────────────────────────────┐
│ ← Remesa DON-000042    ⋮    │
├─────────────────────────────┤
│  🔍 Buscar o escanear   [📷]│
├─────────────────────────────┤
│  RECIENTES                  │
│  ┌─────────┐ ┌─────────┐    │
│  │ Lentejas│ │  Arroz  │    │  ← toque = repetir
│  │ 500 g   │ │  1 kg   │    │
│  │ ×12     │ │  ×8     │    │
│  └─────────┘ └─────────┘    │
│                             │
│  EN ESTA REMESA        24   │
│  Lentejas 500 g       ×12 ✎ │
│  Arroz 1 kg            ×8 ✎ │
│  Aceite 1 L            ×4 ✎ │
│                             │
├─────────────────────────────┤
│  [ Explorar categorías ]    │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃   Guardar remesa (24) ┃  │  ← pulgar, siempre visible
│  ┗━━━━━━━━━━━━━━━━━━━━━━━┛  │
└─────────────────────────────┘
```

- Acciones primarias en el **tercio inferior**, que es donde llega el pulgar.
- Objetivos de **44 px mínimo**, porque se usa de pie y a veces con guantes.
- El contador de la remesa siempre visible: dice cuánto lleva y cuánto falta.

### PC con escáner — el foco no se mueve

Un lector USB **se comporta como un teclado**: escribe los dígitos y manda un Enter. No hay drivers, ni permisos, ni API. Funciona hoy. Lo único que hay que respetar es que **el foco nunca salga del campo de escaneo**.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Remesa DON-000042 · Donante: Fundación X          24 artículos      │
├──────────────────────────────────────────────────────────────────────┤
│  ESCANEAR  ┃ 7701234567890▮                                          │
│            ┗━ el cursor vuelve aquí solo, después de cada línea      │
├──────────────────────────────────────────────────────────────────────┤
│  Producto              Presentación    Cant.  Vence      Lote        │
│  Lentejas              Bolsa 500 g     [ 12]  [30/06/27] [L-4471]  ✕ │
│  Arroz                 Bolsa 1 kg      [  8]  [12/09/27] [—]       ✕ │
│  Aceite girasol        Botella 1 L     [  4]  [01/03/27] [—]       ✕ │
│  ▸ escanea o escribe para agregar…                                   │
├──────────────────────────────────────────────────────────────────────┤
│  Tab/Enter avanza · F2 duplica línea · Supr elimina                   │
│                                    [ Cancelar ]  [ Guardar remesa ]  │
└──────────────────────────────────────────────────────────────────────┘
```

- **Un escaneo del mismo código incrementa la cantidad** en vez de crear otra línea. Es el gesto natural: pasar 12 cajas por el lector.
- **Todo con teclado.** Quien captura con escáner no debería tocar el ratón.
- La tabla es editable en sitio: corregir una cantidad no abre un diálogo.

Comparten componentes y modelo de datos; solo cambia la disposición. Es una decisión deliberada, no una inconsistencia.

---

## 6. Guardar al final, no artículo por artículo

Hoy cada artículo sería un `POST` independiente. En una bodega con mala señal, eso significa que la remesa 30 falla y nadie sabe si entró.

**Propuesta:** la remesa se arma como borrador en el dispositivo y se envía **en una sola llamada** al final.

Ventajas concretas:

- Se puede corregir antes de comprometer nada.
- Un solo punto de fallo en vez de 40.
- Sobrevive a que se caiga la señal a mitad de la descarga.
- La transacción del backend garantiza que entra todo o no entra nada — el mismo principio de las rutas ya construidas.

Implica una ruta nueva:

```
POST /api/donations/{id}/items/batch
{ "items": [ { "variant_id": "...", "quantity": 12, "expiry_date": "2027-06-30", "batch_code": "L-4471" }, ... ] }
```

**No propongo modo offline completo.** Sincronizar cambios hechos sin conexión trae conflictos que cuestan más de lo que resuelven aquí. Un borrador local que se envía entero cubre el 95 % del problema por el 10 % del trabajo.

---

## 7. Cada grupo pide datos distintos

Lo pediste explícitamente y es correcto: no tiene sentido preguntar la fecha de vencimiento de una cobija.

**Recomendación:** un esquema de atributos por categoría, guardado como configuración, que la interfaz lee para dibujar el formulario.

| Grupo | Qué se pregunta al recibir |
|---|---|
| Alimentos, Agua | Vencimiento **(obligatorio)**, lote, ¿cadena de frío? |
| Medicamentos | Vencimiento **(obligatorio)**, lote **(obligatorio)**, registro INVIMA |
| Ropa y Calzado | Talla, género, edad, estado (nuevo / usado en buen estado) |
| Cobijas, Colchonetas | Tamaño, estado |
| Higiene, Limpieza | Vencimiento (opcional), contenido |
| Herramientas | Estado, ¿funciona? |
| Materiales | Dimensiones |

Dos formas de implementarlo:

1. **Campos fijos opcionales** en la variante. Simple, tipado, pero cada grupo nuevo pide una migración.
2. **JSON `attributes` + configuración por categoría.** Flexible, sin migración por cambio, pero sin validación de tipos en la base.

Recomiendo **la segunda con validación en el hook**: la configuración vive en `pb_hooks/utils/config.js` —donde ya está la de códigos y auditoría— y el hook valida contra ella antes de guardar. Se gana flexibilidad sin renunciar a que los datos entren correctos.

`requires_expiry`, `requires_batch` y `requires_quarantine` ya existen en `products` y deben seguir mandando: si el producto lo exige, el campo es obligatorio aunque la categoría lo tenga como opcional.

---

## 8. Crear sobre la marcha sin pudrir el catálogo

Pediste poder registrar lo que no existe. Es imprescindible: un operario bloqueado a mitad de una remesa abandona el sistema.

Pero hay una tensión real. Si cualquiera crea entradas libremente, en dos meses el catálogo tiene «Lentejas», «lenteja», «LENTEJAS 500» y «Lentejas marca x», y el inventario deja de sumar.

**Propuesta: dividir según el riesgo.**

| Quién | Puede crear | Por qué |
|---|---|---|
| Operario | **Variantes** de un producto existente | Agregar «Lentejas Marca Y 1 kg» es seguro: cuelga de una rama ya validada |
| Admin | Productos, categorías, grupos | La taxonomía define cómo se reporta todo. Ahí sí duele el desorden |

Con dos salvaguardas:

- **Buscar antes de crear.** El formulario de alta muestra las variantes parecidas mientras se escribe. La mayoría de duplicados se crean por no encontrar lo que ya estaba.
- **Marcar para revisión.** Las variantes creadas por un operario quedan señaladas; el admin las repasa después. No bloquea la operación y mantiene el catálogo bajo control.

Cuando de verdad no existe el producto base, el operario registra contra el producto genérico de la categoría con una nota, y el admin lo normaliza luego. **Nunca se detiene la recepción.**

---

## 9. Lo que el código de barras NO resuelve

Conviene tenerlo claro antes de construir expectativas:

- **Un EAN-13 no contiene fecha de vencimiento ni lote.** Solo identifica el producto. Los códigos que sí los llevan (GS1-128, DataMatrix) están en cajas de mayorista, no en el empaque de consumo. **El vencimiento se seguirá tecleando** — por eso el selector de fecha tiene que ser bueno: teclado numérico, formato corto, y accesos a «6 meses», «1 año».
- **Mucho de lo donado no tiene código**, o lo tiene en mal estado, o es de otro país. Los otros tres caminos no son opcionales.
- **La primera vez que se escanea un código, no está en el sistema.** El flujo tiene que ser: escaneo → no existe → abre el alta con el código ya rellenado. Cada escaneo enseña al sistema.
- **La cámara del móvil exige HTTPS.** `getUserMedia` y `BarcodeDetector` solo funcionan en contexto seguro. Sobre `http://172.23.177.12` **no van a funcionar**. Además `BarcodeDetector` no existe en Safari ni Firefox: en iPhone hace falta una librería WASM de respaldo.

> **Consecuencia para el despliegue:** el certificado TLS que está pendiente con OTIC no es un adorno. Sin dominio y sin HTTPS no hay escáner por cámara — solo lector USB en PC. Vale la pena decírselo a Carlos con ese argumento.

---

## 10. Resumen de cambios propuestos

| # | Cambio | Impacto | Coste |
|---|---|---|---|
| 1 | **Variantes** (`product_variants`) con marca, presentación y código de barras | Habilita todo lo demás | Migración + hooks |
| 2 | **Inventario por variante** | Permite alistar por unidades y fechar por paquete | Migración. **Barato ahora, caro después** |
| 3 | **Recientes en la sesión** | La mejora más grande por el menor esfuerzo | Solo frontend |
| 4 | **Búsqueda como camino principal**, jerarquía como red | Menos gestos por artículo | Solo frontend |
| 5 | **Lector USB en PC** | Un escaneo reemplaza cinco toques | Solo frontend, sin drivers |
| 6 | **Borrador + envío en lote** | Sobrevive a la mala señal | Ruta nueva |
| 7 | **Atributos por categoría** | Ropa y alimentos dejan de compartir formulario | Configuración + hook |
| 8 | **Operario crea variantes, admin la taxonomía** | Nadie se bloquea, el catálogo no se pudre | Reglas de acceso |
| 9 | **Cámara en móvil** | Escáner sin hardware | Requiere HTTPS |

### Orden sugerido

**Primero lo que no depende de nada:** recientes, búsqueda y borrador con envío en lote se pueden construir contra el modelo actual y ya quitan la mayor parte de la fricción.

**En paralelo, la decisión de variantes**, porque cuanto más se tarde más cuesta: hoy son dos migraciones sobre tablas vacías.

**Al final el escáner**, que es el que depende de que exista `barcode` y de que haya HTTPS.

---

## 11. Preguntas que hay que resolver antes de construir

1. **¿El inventario va por producto o por variante?** Es la decisión estructural. Mi recomendación es variante, pero condiciona los hooks y todas las pantallas.
2. **¿La marca importa para la operación?** Si a la bodega le da igual la marca y solo le importa «lentejas 500 g», la variante se simplifica a presentación y el catálogo crece mucho menos.
3. **¿Qué se hace con «Despensas Armadas»?** Un grupo vacío que probablemente sea un producto compuesto — varias cosas empacadas juntas—, y eso es un modelo distinto.
4. **¿Hay lector USB disponible, o el escaneo será solo por cámara?** Cambia qué se construye primero, y si el HTTPS es bloqueante o no.
5. **¿Quién normaliza el catálogo?** Alguien tiene que revisar lo que crean los operarios, o la salvaguarda no sirve de nada.

---

## Documentos relacionados

- [`CLAUDE.md`](CLAUDE.md) — contexto del frontend y decisiones tomadas
- [README del backend](https://github.com/fcenwebunal/akopia-backend#readme) — modelo de datos y reglas de acceso
- [Barcode Detection API](https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API) · [soporte por navegador](https://caniuse.com/mdn-api_barcodedetector) · [polyfill](https://github.com/gruhn/barcode-detector-polyfill)
