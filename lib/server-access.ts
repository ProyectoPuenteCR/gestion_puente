import "server-only";

import { auth } from "@/auth";
import { lookupPlatformAccess } from "@/lib/google-sheets";
import type { UserRole } from "@/lib/portal-types";

export class AccessError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "AccessError";
    this.status = status;
  }
}

export async function currentPortalAccess(): Promise<{ email: string; role: UserRole }> {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) throw new AccessError("Tenés que iniciar sesión.", 401);
  const access = await lookupPlatformAccess(email);
  if (!access?.active) throw new AccessError("Tu cuenta no está habilitada para usar la plataforma.", 403);
  return { email, role: access.role };
}

export function requireAdmin(access: { role: UserRole }) {
  if (access.role !== "admin") throw new AccessError("Esta acción requiere permisos de administrador.", 403);
}

export function requireScoringEditor(access: { role: UserRole }) {
  if (access.role !== "admin" && access.role !== "capacitador") {
    throw new AccessError("Esta acción requiere permisos de administrador o capacitador.", 403);
  }
}

export function apiError(error: unknown) {
  const status = error instanceof AccessError ? error.status : 400;
  const message = error instanceof Error ? error.message : "No se pudo completar la operación.";
  return Response.json({ error: message }, { status });
}
