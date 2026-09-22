import { readManagementSnapshot, updatePlatformAccount } from "@/lib/google-sheets";
import type { UserRole } from "@/lib/portal-types";
import { apiError, currentPortalAccess, requireAdmin } from "@/lib/server-access";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const access = await currentPortalAccess();
    requireAdmin(access);
    const snapshot = await readManagementSnapshot();
    return Response.json({ accounts: snapshot.accounts });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await currentPortalAccess();
    requireAdmin(access);
    const body = (await request.json()) as { email?: unknown; role?: UserRole; active?: unknown };
    if (!body.email || !["usuario", "capacitador", "admin"].includes(String(body.role)) || typeof body.active !== "boolean") {
      throw new Error("Los permisos seleccionados no son válidos.");
    }
    await updatePlatformAccount(String(body.email), body.role as UserRole, body.active, access);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
