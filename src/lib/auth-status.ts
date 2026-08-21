export interface EmailStatus {
  exists: boolean;
  linked: boolean;
  fullName: string | null;
}

/*
 * Consulta /api/auth/email-status. Se usa en /login (tras un fallo, para
 * dar un mensaje concreto) y en /registro (al perder foco el correo,
 * para saber si hay que heredar un nombre ya asignado o avisar que la
 * cuenta ya existe) — ver el comentario del propio endpoint para el
 * porqué de esta forma en particular.
 */
export async function checkEmailStatus(email: string): Promise<EmailStatus> {
  const response = await fetch("/api/auth/email-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    return { exists: false, linked: false, fullName: null };
  }

  return response.json();
}
