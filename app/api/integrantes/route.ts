import {
  createMember,
  canUsersEditOwnProfile,
  deactivateMembers,
  MEMBER_EMAIL_HEADER,
  MEMBER_HEADERS,
  readManagementSnapshot,
  updateMember,
} from "@/lib/google-sheets";
import type { MemberFieldValue } from "@/lib/portal-types";
import { AccessError, apiError, currentPortalAccess, requireAdmin } from "@/lib/server-access";

export const dynamic = "force-dynamic";

function memberEmail(values: Record<string, MemberFieldValue>) {
  return String(values[MEMBER_EMAIL_HEADER] ?? "").trim().toLowerCase();
}

function recordFrom(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Los datos del integrante no son válidos.");
  return value as Record<string, MemberFieldValue>;
}

export async function GET() {
  try {
    const access = await currentPortalAccess();
    const snapshot = await readManagementSnapshot();
    const rows = access.role === "admin"
      ? snapshot.members
      : snapshot.members.filter((member) => memberEmail(member.values) === access.email);
    return Response.json({
      headers: [...MEMBER_HEADERS],
      rows,
      config: snapshot.config,
      accounts: access.role === "admin" ? snapshot.accounts : [],
      canManage: access.role === "admin",
      canEdit: access.role === "admin" || (access.role === "usuario" && canUsersEditOwnProfile(snapshot.config)),
      currentEmail: access.email,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await currentPortalAccess();
    requireAdmin(access);
    const body = (await request.json()) as { values?: unknown };
    const member = await createMember(recordFrom(body.values), access);
    return Response.json({ member }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await currentPortalAccess();
    const body = (await request.json()) as { rowNumber?: unknown; values?: unknown };
    const rowNumber = Number(body.rowNumber);
    if (!Number.isInteger(rowNumber) || rowNumber < 2) throw new Error("La fila seleccionada no es válida.");
    const values = recordFrom(body.values);
    if (access.role !== "admin") {
      const snapshot = await readManagementSnapshot();
      if (access.role !== "usuario" || !canUsersEditOwnProfile(snapshot.config)) {
        throw new AccessError("La edición de datos personales está deshabilitada por el administrador.", 403);
      }
      const own = snapshot.members.find((member) => member.rowNumber === rowNumber && memberEmail(member.values) === access.email);
      if (!own) throw new Error("Sólo podés modificar tu propia ficha.");
    }
    const member = await updateMember(rowNumber, values, access);
    return Response.json({ member });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const access = await currentPortalAccess();
    requireAdmin(access);
    const body = (await request.json()) as { rowNumber?: unknown; rowNumbers?: unknown; reason?: unknown };
    const rawRows = Array.isArray(body.rowNumbers) ? body.rowNumbers : [body.rowNumber];
    const rowNumbers = rawRows.map((value) => Number(value));
    if (!rowNumbers.length || rowNumbers.some((value) => !Number.isInteger(value) || value < 2)) {
      throw new Error("La selección de integrantes no es válida.");
    }
    const reason = String(body.reason ?? "").trim();
    if (!reason) throw new Error("Indicá el motivo de la baja.");
    const result = await deactivateMembers(rowNumbers, reason, access);
    return Response.json({ ok: true, count: result.count });
  } catch (error) {
    return apiError(error);
  }
}
