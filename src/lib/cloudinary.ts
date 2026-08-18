"use client";

import { pb } from "./pb";

export type PhotoKind = "categories" | "products" | "groups" | "locations";

export class UploadError extends Error {}

/*
 * Sube una imagen a Cloudinary y devuelve su URL segura.
 *
 * En dos pasos: primero se pide una firma al propio backend (que
 * comprueba que quien pide sea admin y guarda el API secret), y con esa
 * firma se sube directo a Cloudinary desde el navegador — el archivo no
 * pasa por nuestro servidor, así que no hay límite de tamaño de Next.js
 * de por medio.
 */
export async function uploadPhoto(file: File, kind: PhotoKind): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new UploadError("Solo se pueden subir imágenes.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new UploadError("La imagen no puede pesar más de 8 MB.");
  }

  const signResponse = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: pb.authStore.token,
    },
    body: JSON.stringify({ kind }),
  });

  if (!signResponse.ok) {
    const data = await signResponse.json().catch(() => ({}));
    throw new UploadError(data.message ?? "No se pudo autorizar la subida.");
  }

  const { signature, timestamp, apiKey, cloudName, folder } =
    await signResponse.json();

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", folder);

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: form }
  );

  const uploaded = await uploadResponse.json().catch(() => ({}));

  if (!uploadResponse.ok) {
    throw new UploadError(uploaded.error?.message ?? "La subida a Cloudinary falló.");
  }

  return uploaded.secure_url as string;
}
