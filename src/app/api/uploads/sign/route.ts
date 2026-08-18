import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { requireAdmin, UnauthorizedError } from "@/lib/pb-server";

export const runtime = "nodejs";

/*
 * Firma una subida a Cloudinary sin exponer el API secret al navegador.
 *
 * El SDK de Cloudinary en el cliente necesitaría el secret para armar la
 * firma él mismo — inaceptable, cualquiera con acceso al bundle podría
 * subir lo que quisiera a la cuenta. En vez de eso: el servidor firma
 * solo los parámetros exactos que el cliente va a mandar, con una
 * validez de minutos (el timestamp), y el cliente sube directo a
 * Cloudinary con esa firma. El secret nunca sale de aquí.
 *
 * Solo admin: subir fotos de categorías o productos es una operación de
 * catálogo, igual que crearlos o editarlos (`categories`/`products`
 * `updateRule` ya son admin-only en el backend).
 */

const FOLDERS: Record<string, string> = {
  categories: "akopia/categories",
  products: "akopia/products",
  groups: "akopia/groups",
};

export async function POST(request: NextRequest) {
  const token = request.headers.get("Authorization");

  try {
    await requireAdmin(token);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ message: err.message }, { status: 403 });
    }
    throw err;
  }

  const body = await request.json().catch(() => ({}));
  const kind = typeof body.kind === "string" ? body.kind : "";
  const folder = FOLDERS[kind];

  if (!folder) {
    return NextResponse.json(
      { message: "kind debe ser 'categories', 'products' o 'groups'." },
      { status: 400 }
    );
  }

  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  if (!apiKey || !apiSecret || !cloudName) {
    console.error("Faltan credenciales de Cloudinary en el servidor.");
    return NextResponse.json(
      { message: "La subida de imágenes no está configurada." },
      { status: 500 }
    );
  }

  const timestamp = Math.round(Date.now() / 1000);

  // Todo lo que se firma aquí, el cliente lo tiene que mandar EXACTO en
  // la subida — un parámetro de más o de menos invalida la firma.
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    apiSecret
  );

  return NextResponse.json({
    signature,
    timestamp,
    apiKey,
    cloudName,
    folder,
  });
}
