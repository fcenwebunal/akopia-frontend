#!/usr/bin/env node
/*
 * Sube fotos locales (por ejemplo, las que Juan Manuel ya había elegido
 * a mano y guardado en su Descargas) y las enlaza al grupo o categoría
 * cuyo nombre se le parezca más, por solapamiento de palabras — sin
 * depender de que el nombre del archivo sea idéntico al del catálogo
 * ("cloro.avif" debe encontrar "Cloro y Desinfectantes").
 *
 * Existe porque una recreación de `pb_data` dejó sin `photo_url` a
 * los 66 grupos/categorías que ya lo tenían, mientras las imágenes
 * seguían intactas en Cloudinary (no se pierden ahí, solo el enlace
 * en PocketBase). Este script reconstruye el enlace desde archivos
 * locales; `seed-catalog-photos.mjs` sigue siendo la vía para lo que
 * no tenga una foto local propia.
 *
 * Uso:
 *   node scripts/link-local-photos.mjs --dir="C:\...\Downloads" --dry-run
 *   node scripts/link-local-photos.mjs --dir="C:\...\Downloads"
 *
 * Variables esperadas (léelas de .env.local con --env-file):
 *   NEXT_PUBLIC_PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD,
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 */
import { v2 as cloudinary } from "cloudinary";
import PocketBase from "pocketbase";
import { readdirSync, readFileSync } from "node:fs";
import { extname, basename, join } from "node:path";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const dirArg = [...args].find((a) => a.startsWith("--dir="))?.split("=")[1];
const DIR = dirArg ?? "C:\\Users\\Juan Manuel\\Downloads";

const PB_URL = process.env.NEXT_PUBLIC_PB_URL ?? "http://127.0.0.1:8090";
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const MIN_SCORE = 0.4;

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ");
}

const STOPWORDS = new Set(["y", "de", "del", "la", "el", "los", "las", "para", "en"]);

// Quita una "s" final de 4+ letras para que "desinfectante" empate con
// "desinfectantes" sin arrastrar un stemmer real por un solo caso.
function singularize(word) {
  return word.length > 4 && word.endsWith("s") ? word.slice(0, -1) : word;
}

function words(text) {
  return normalize(text)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    .map(singularize);
}

// Solapamiento de palabras entre archivo y candidato, sobre el
// tamaño del más corto — así "cloro" contra "Cloro y Desinfectantes"
// puntúa alto aunque el candidato tenga más palabras.
function score(fileWords, candidateWords) {
  if (fileWords.length === 0 || candidateWords.length === 0) return 0;
  const set = new Set(candidateWords);
  const shared = fileWords.filter((w) => set.has(w)).length;
  return shared / Math.min(fileWords.length, candidateWords.length);
}

function bestMatch(fileName, candidates) {
  const fWords = words(fileName);
  let best = null;
  for (const candidate of candidates) {
    const s = score(fWords, words(candidate.name));
    if (s >= MIN_SCORE && (!best || s > best.score)) {
      best = { ...candidate, score: s };
    }
  }
  return best;
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

  const pb = new PocketBase(PB_URL);
  await pb.collection("users").authWithPassword(email, password);

  const [groups, categories] = await Promise.all([
    pb.collection("groups").getFullList({ sort: "name" }),
    pb.collection("categories").getFullList({ sort: "name" }),
  ]);

  const candidates = [
    ...groups.map((g) => ({ collection: "groups", folder: "akopia/groups", id: g.id, name: g.name, photo_url: g.photo_url })),
    ...categories.map((c) => ({ collection: "categories", folder: "akopia/categories", id: c.id, name: c.name, photo_url: c.photo_url })),
  ];

  const files = readdirSync(DIR).filter((f) => IMAGE_EXT.has(extname(f).toLowerCase()));
  console.log(`${DRY_RUN ? "[dry-run] " : ""}${files.length} imágenes en ${DIR}\n`);

  const claimed = new Set();
  let linked = 0;
  let skippedHadPhoto = 0;
  let noMatch = 0;
  let failed = 0;

  for (const file of files) {
    const stem = basename(file, extname(file));
    const match = bestMatch(stem, candidates);

    if (!match) {
      console.log(`  ✕  ${file} — sin candidato parecido`);
      noMatch++;
      continue;
    }

    const claimKey = `${match.collection}:${match.id}`;
    if (claimed.has(claimKey)) {
      console.log(`  =  ${file} — "${match.name}" ya recibió otra foto en esta corrida, se salta`);
      continue;
    }

    if (match.photo_url) {
      console.log(`  =  ${file} — "${match.name}" ya tenía foto, se conserva (usa --overwrite manual desde la interfaz si quieres cambiarla)`);
      skippedHadPhoto++;
      continue;
    }

    console.log(`  →  ${file}  ⇒  ${match.collection}/${match.name}  (score ${match.score.toFixed(2)})`);

    if (DRY_RUN) {
      claimed.add(claimKey);
      linked++;
      continue;
    }

    try {
      const buffer = readFileSync(join(DIR, file));
      const dataUri = `data:image/${extname(file).slice(1)};base64,${buffer.toString("base64")}`;
      const uploaded = await cloudinary.uploader.upload(dataUri, {
        folder: match.folder,
        timeout: 60000,
      });
      await pb.collection(match.collection).update(match.id, {
        photo_url: uploaded.secure_url,
      });
      claimed.add(claimKey);
      linked++;
    } catch (err) {
      console.log(`     ✕  falló: ${err.message}`);
      failed++;
    }
  }

  console.log(
    `\n${linked} enlazadas, ${skippedHadPhoto} ya tenían foto, ${noMatch} sin candidato, ${failed} con error.`
  );
}

main();
