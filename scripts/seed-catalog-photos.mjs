#!/usr/bin/env node
/*
 * Pone una foto a cada grupo y categoría del catálogo, buscando en
 * Wikimedia Commons (todo con licencia libre — nada de riesgo de
 * derechos de autor en un catálogo que puede volverse público) y
 * subiendo el resultado a Cloudinary.
 *
 * No toca `products`: son 123, mucho más ruidoso de acertar por
 * búsqueda automática ("Arroz" el producto necesita una foto más
 * específica que "Arroz y Legumbres" la categoría), y el explorador ya
 * se ve bien con solo grupos y categorías ilustrados — los productos
 * dentro de una categoría ya identificada no necesitan tanto la imagen.
 *
 * Uso:
 *   node scripts/seed-catalog-photos.mjs --dry-run        # solo mira qué elegiría
 *   node scripts/seed-catalog-photos.mjs                  # sube y guarda
 *   node scripts/seed-catalog-photos.mjs --overwrite       # también re-elige las que ya tienen foto
 *   node scripts/seed-catalog-photos.mjs --only=groups     # o --only=categories
 *
 * Variables de entorno esperadas (léelas de .env.local con --env-file):
 *   NEXT_PUBLIC_PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD,
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 */
import { v2 as cloudinary } from "cloudinary";
import PocketBase from "pocketbase";
import { GROUP_QUERIES, CATEGORY_QUERIES } from "./catalog-queries.mjs";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const OVERWRITE = args.has("--overwrite");
const ONLY = [...args].find((a) => a.startsWith("--only="))?.split("=")[1];

const PB_URL = process.env.NEXT_PUBLIC_PB_URL ?? "http://127.0.0.1:8090";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

// Wikimedia pide identificarse con un User-Agent descriptivo en vez del
// genérico por defecto — es parte de su etiqueta de uso de la API, no
// un capricho.
const USER_AGENT =
  "AKOPIA-CatalogPhotoSeeder/1.0 (https://github.com/fcenwebunal/akopia-backend; centro de acopio UNAL Manizales)";

// Descarta resultados que casi seguro no son la foto de un producto:
// mapas, diagramas, logos, sellos, capturas de pantalla… y un patrón que
// salió mucho al revisar la primera pasada: fotos documentales de
// contexto militar o histórico que mencionan el objeto de pasada (un
// marinero doblando una cobija, una enfermera de guerra con vendas) —
// exactas para la búsqueda, pero nada parecidas a la foto limpia de un
// producto que hace falta aquí.
const REJECT_WORDS = [
  "map", "diagram", "chart", "logo", "flag", "coin", "stamp",
  "poster", "screenshot", "postcard", "montage", "comparison",
  "graph", "chemical structure", "molecule",
  "navy", "marines", "marine corps", "sailors", "sailor", "army",
  "soldier", "military", "war ", " war", "wwii", "world war",
  "binding", "historical", "vintage",
  // No negociable: este catálogo lo ve cualquiera, incluidos menores de
  // edad en la red de la Universidad. Un "Folded Nude.png" salió como
  // primer resultado real para "blanket" en la primera pasada — el
  // filtro anterior no tenía ni la palabra "nude". Esto va antes que
  // cualquier otro criterio de calidad.
  "nude", "naked", "nudity", "erotic", "erotica", "sex ", " sex",
  "sexual", "porn", "nsfw", "topless", "lingerie model", "fetish",
  // Escaneos de libros o documentos antiguos: técnicamente pasan el
  // filtro de tamaño y proporción, pero no son la foto de un producto.
  "treatise", "manuscript", "yearbook", "facsimile",
];

// Palabras de 4+ letras del término de búsqueda, para exigir que el
// TÍTULO de la foto de verdad tenga algo que ver — no solo su
// descripción, donde una lista larga de objetos (una mochila de
// excursionista, un inventario de bodega) puede mencionar "water
// bottle" o "sunscreen" de pasada sin que la foto sea de eso.
function significantWords(query) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length >= 4);
}

async function searchCommons(query) {
  const url = new URL(COMMONS_API);
  url.search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: query,
    gsrlimit: "10",
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "800",
    format: "json",
    origin: "*",
  }).toString();

  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) return [];

  const data = await response.json();
  const pages = Object.values(data.query?.pages ?? {});
  const words = significantWords(query);

  const candidates = pages
    .map((page) => {
      const info = page.imageinfo?.[0];
      const meta = info?.extmetadata ?? {};
      return {
        title: page.title ?? "",
        info,
        // Se revisa título + descripción + categorías juntos: una
        // palabra prohibida en cualquiera de los tres descarta la
        // imagen, no solo si aparece en el nombre del archivo.
        haystack: [
          page.title,
          meta.ImageDescription?.value,
          meta.Categories?.value,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      };
    })
    .filter(({ info, haystack }) => {
      if (!info) return false;
      if (!["image/jpeg", "image/png"].includes(info.mime)) return false;
      if (info.width < 300) return false;
      const ratio = info.width / info.height;
      if (ratio < 0.45 || ratio > 2.3) return false;
      return !REJECT_WORDS.some((word) => haystack.includes(word));
    });

  // Exige que el propio TÍTULO tenga una palabra relevante — nada de
  // "si no hay nada mejor, sirve cualquiera". Un castillo en Jersey
  // salió como foto de "Mascotas" antes de este cambio, porque su
  // descripción mencionaba una mascota de pasada: coincidía con la
  // búsqueda de texto completo, pero el título no tenía nada que ver.
  // Mejor devolver "sin resultado" y dejarlo para elegir a mano que
  // subir una foto segura pero equivocada.
  const titleMatches = candidates.filter(({ title }) => {
    const lowerTitle = title.toLowerCase();
    return words.some((word) => lowerTitle.includes(word));
  });

  return titleMatches.map(({ title, info }) => ({
    title,
    url: info.thumburl ?? info.url,
  }));
}

async function pickPhoto(query) {
  const candidates = await searchCommons(query);
  return candidates[0] ?? null;
}

async function main() {
  const email = process.env.PB_ADMIN_EMAIL;
  const password = process.env.PB_ADMIN_PASSWORD;
  if (!email || !password) {
    console.error("Faltan PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD.");
    process.exit(1);
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!DRY_RUN && (!cloudName || !apiKey || !apiSecret)) {
    console.error("Faltan credenciales de Cloudinary.");
    process.exit(1);
  }
  if (!DRY_RUN) {
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  }

  // Leer groups/categories también exige sesión (listRule las protege
  // como al resto del catálogo), así que la autenticación no se puede
  // saltar ni en modo de prueba.
  const pb = new PocketBase(PB_URL);
  await pb.collection("users").authWithPassword(email, password);

  const jobs = [];
  if (!ONLY || ONLY === "groups") {
    for (const [name, query] of Object.entries(GROUP_QUERIES)) {
      jobs.push({ collection: "groups", folder: "akopia/groups", name, query });
    }
  }
  if (!ONLY || ONLY === "categories") {
    for (const [name, query] of Object.entries(CATEGORY_QUERIES)) {
      jobs.push({ collection: "categories", folder: "akopia/categories", name, query });
    }
  }

  console.log(`${DRY_RUN ? "[dry-run] " : ""}${jobs.length} elementos a procesar\n`);

  let ok = 0;
  let skipped = 0;
  let noMatch = 0;
  let failed = 0;

  for (const job of jobs) {
    let record;
    try {
      record = await pb
        .collection(job.collection)
        .getFirstListItem(pb.filter("name = {:name}", { name: job.name }));
    } catch {
      console.log(`  ?  ${job.name} — no existe en ${job.collection}, se salta`);
      failed++;
      continue;
    }

    if (record.photo_url && !OVERWRITE) {
      console.log(`  =  ${job.name} — ya tiene foto, se conserva`);
      skipped++;
      continue;
    }

    const photo = await pickPhoto(job.query);
    if (!photo) {
      console.log(`  ✕  ${job.name} — sin resultado decente para "${job.query}"`);
      noMatch++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  →  ${job.name} — ${photo.title}`);
      ok++;
      continue;
    }

    try {
      // Cloudinary también sabe pedirle la imagen directo a la URL
      // remota, pero eso hizo que Wikimedia empezara a devolver 429 a
      // los pocos intentos: sus servidores no distinguen mi ritmo de
      // pedidos del de cualquier otro cliente de Cloudinary pidiendo al
      // mismo tiempo. Se descarga aquí, con la misma pausa entre
      // elementos, y se sube el contenido ya en mano.
      const imageResponse = await fetch(photo.url, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!imageResponse.ok) {
        throw new Error(`Wikimedia respondió ${imageResponse.status}`);
      }
      const buffer = Buffer.from(await imageResponse.arrayBuffer());
      const mime = imageResponse.headers.get("content-type") ?? "image/jpeg";
      const dataUri = `data:${mime};base64,${buffer.toString("base64")}`;

      const uploaded = await cloudinary.uploader.upload(dataUri, {
        folder: job.folder,
        timeout: 60000,
      });
      await pb.collection(job.collection).update(record.id, {
        photo_url: uploaded.secure_url,
      });
      console.log(`  ✓  ${job.name} — ${photo.title}`);
      ok++;
    } catch (err) {
      console.log(`  ✕  ${job.name} — falló la subida: ${err.message}`);
      failed++;
    }

    // Pausa entre elementos, ahora la que de verdad importa: la que
    // respeta Wikimedia, no Cloudinary. Es una API de uso público y
    // compartido, no pensada para descargar decenas de archivos seguidos.
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  console.log(
    `\n${ok} con foto, ${skipped} ya tenían, ${noMatch} sin resultado decente, ${failed} con error.`
  );
  if (noMatch > 0) {
    console.log(
      "Las que no tuvieron resultado decente ajusta su búsqueda en catalog-queries.mjs, o ponles la foto a mano desde la interfaz (ícono de cámara, solo admin)."
    );
  }
}

main();
