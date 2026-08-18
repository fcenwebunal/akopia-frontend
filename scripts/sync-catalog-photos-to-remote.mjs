#!/usr/bin/env node
/*
 * Copia SOLO `photo_url` de grupos, categorías y productos desde una
 * instancia de origen (por defecto, la local) hacia una de destino (el
 * despliegue provisional en Railway) — nada de donaciones, solicitudes,
 * inventario, usuarios ni auditoría. Existe porque restaurar un
 * respaldo completo (Settings → Backups) trae TODO, y el destino debe
 * arrancar limpio salvo por el catálogo con sus fotos.
 *
 * El catálogo (nombres, categorías, unidades) ya está sembrado igual en
 * destino por las propias migraciones — lo único que falta ahí es
 * `photo_url`, que se cargó después a mano/con Cloudinary y no vive en
 * ninguna migración. Empareja por nombre (y por el nombre del padre,
 * para no confundir dos categorías del mismo nombre en grupos
 * distintos, si las hubiera) — los ids no sirven para emparejar: cada
 * instancia los generó por su cuenta al sembrar.
 *
 * Uso:
 *   node scripts/sync-catalog-photos-to-remote.mjs --dry-run
 *   node scripts/sync-catalog-photos-to-remote.mjs
 *
 * Variables esperadas:
 *   SOURCE_PB_URL           (opcional, por defecto http://127.0.0.1:8090)
 *   SOURCE_ADMIN_EMAIL / SOURCE_ADMIN_PASSWORD   (login de `users`, rol admin)
 *   REMOTE_PB_URL           (el dominio de Railway)
 *   REMOTE_SUPERUSER_EMAIL / REMOTE_SUPERUSER_PASSWORD  (el superusuario
 *     de servicio ya creado ahí — el mismo que usa el puente de Firebase)
 */
import PocketBase from "pocketbase";

const DRY_RUN = process.argv.includes("--dry-run");

const SOURCE_URL = process.env.SOURCE_PB_URL ?? "http://127.0.0.1:8090";
const REMOTE_URL = process.env.REMOTE_PB_URL;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Falta la variable ${name}.`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const sourceEmail = requireEnv("SOURCE_ADMIN_EMAIL");
  const sourcePassword = requireEnv("SOURCE_ADMIN_PASSWORD");
  const remoteUrl = REMOTE_URL ?? requireEnv("REMOTE_PB_URL");
  const remoteEmail = requireEnv("REMOTE_SUPERUSER_EMAIL");
  const remotePassword = requireEnv("REMOTE_SUPERUSER_PASSWORD");

  const source = new PocketBase(SOURCE_URL);
  await source.collection("users").authWithPassword(sourceEmail, sourcePassword);

  const remote = new PocketBase(remoteUrl);
  await remote.collection("_superusers").authWithPassword(remoteEmail, remotePassword);

  console.log(`${DRY_RUN ? "[dry-run] " : ""}Origen: ${SOURCE_URL}  →  Destino: ${remoteUrl}\n`);

  const [srcGroups, srcCategories, srcProducts] = await Promise.all([
    source.collection("groups").getFullList({ sort: "name" }),
    source.collection("categories").getFullList({ sort: "name" }),
    source.collection("products").getFullList({ sort: "name" }),
  ]);
  const [dstGroups, dstCategories, dstProducts] = await Promise.all([
    remote.collection("groups").getFullList({ sort: "name" }),
    remote.collection("categories").getFullList({ sort: "name" }),
    remote.collection("products").getFullList({ sort: "name" }),
  ]);

  const dstGroupByName = new Map(dstGroups.map((g) => [g.name.trim().toLowerCase(), g]));
  const srcGroupById = new Map(srcGroups.map((g) => [g.id, g]));
  const srcCategoryById = new Map(srcCategories.map((c) => [c.id, c]));

  // Categoría emparejada por su propio nombre + el nombre de su grupo,
  // no por id — dos instancias distintas nunca comparten ids aunque el
  // catálogo sea "el mismo" lógicamente.
  const dstCategoryByKey = new Map(
    dstCategories.map((c) => {
      const groupName = dstGroups.find((g) => g.id === c.group_id)?.name ?? "";
      return [`${groupName.trim().toLowerCase()}::${c.name.trim().toLowerCase()}`, c];
    })
  );
  const dstProductByKey = new Map(
    dstProducts.map((p) => {
      const categoryName = dstCategories.find((c) => c.id === p.category_id)?.name ?? "";
      return [`${categoryName.trim().toLowerCase()}::${p.name.trim().toLowerCase()}`, p];
    })
  );

  const stats = { updated: 0, skippedNoPhoto: 0, skippedSame: 0, noMatch: 0 };

  async function sync(collection, srcRecord, dstRecord, label) {
    if (!srcRecord.photo_url) {
      stats.skippedNoPhoto++;
      return;
    }
    if (!dstRecord) {
      console.log(`  ✕  ${label} — sin equivalente en destino`);
      stats.noMatch++;
      return;
    }
    if (dstRecord.photo_url === srcRecord.photo_url) {
      stats.skippedSame++;
      return;
    }

    console.log(`  →  ${label}`);
    stats.updated++;
    if (DRY_RUN) return;

    await remote.collection(collection).update(dstRecord.id, { photo_url: srcRecord.photo_url });
  }

  for (const g of srcGroups) {
    const dst = dstGroupByName.get(g.name.trim().toLowerCase());
    await sync("groups", g, dst, `grupo: ${g.name}`);
  }

  for (const c of srcCategories) {
    const groupName = srcGroupById.get(c.group_id)?.name ?? "";
    const dst = dstCategoryByKey.get(`${groupName.trim().toLowerCase()}::${c.name.trim().toLowerCase()}`);
    await sync("categories", c, dst, `categoría: ${groupName} → ${c.name}`);
  }

  for (const p of srcProducts) {
    const categoryName = srcCategoryById.get(p.category_id)?.name ?? "";
    const dst = dstProductByKey.get(`${categoryName.trim().toLowerCase()}::${p.name.trim().toLowerCase()}`);
    await sync("products", p, dst, `producto: ${categoryName} → ${p.name}`);
  }

  console.log(
    `\n${stats.updated} actualizados, ${stats.skippedSame} ya iguales, ${stats.skippedNoPhoto} sin foto en origen, ${stats.noMatch} sin equivalente en destino.`
  );
}

main().catch((err) => {
  console.error("Falló:", err.message);
  process.exit(1);
});
