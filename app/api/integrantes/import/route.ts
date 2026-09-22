import { importMembers } from "@/lib/google-sheets";
import type { MemberFieldValue } from "@/lib/portal-types";
import { apiError, currentPortalAccess, requireAdmin } from "@/lib/server-access";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const access = await currentPortalAccess();
    requireAdmin(access);
    const body = (await request.json()) as { rows?: unknown };
    if (!Array.isArray(body.rows)) throw new Error("El contenido del archivo no es válido.");
    const rows = body.rows.map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("Una fila del archivo no es válida.");
      return row as Record<string, MemberFieldValue>;
    });
    return Response.json(await importMembers(rows, access));
  } catch (error) {
    return apiError(error);
  }
}
