import { addConfigItem, readManagementSnapshot, setBirthdayAutomationSettings, setConfigItemActive, setSocialFeeAmount } from "@/lib/google-sheets";
import type { BirthdayAutomationSettings, ConfigCategory } from "@/lib/portal-types";
import { apiError, currentPortalAccess, requireAdmin } from "@/lib/server-access";

const CONFIG_TYPES = new Set<ConfigCategory>(["HORARIO", "TITULO", "ACTIVIDAD", "TAREA", "TEMA_SCORING", "PERMISO"]);

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const access = await currentPortalAccess();
    requireAdmin(access);
    const snapshot = await readManagementSnapshot();
    return Response.json({ items: snapshot.config });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await currentPortalAccess();
    requireAdmin(access);
    const body = (await request.json()) as {
      type?: ConfigCategory | "CUMPLEANOS_CONFIG";
      value?: unknown;
      year?: unknown;
      amount?: unknown;
      settings?: BirthdayAutomationSettings;
    };
    if (body.type === "CUMPLEANOS_CONFIG") {
      if (!body.settings) throw new Error("Falta la configuración de cumpleaños.");
      const settings = await setBirthdayAutomationSettings(body.settings, access);
      return Response.json({ settings });
    }
    if (body.type === "VALOR_CUOTA") {
      const result = await setSocialFeeAmount(Number(body.year), Number(body.amount), access);
      return Response.json(result, { status: 201 });
    }
    if (!body.type || !CONFIG_TYPES.has(body.type)) throw new Error("La categoría no es válida.");
    await addConfigItem(body.type, String(body.value ?? ""), access);
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await currentPortalAccess();
    requireAdmin(access);
    const body = (await request.json()) as { rowNumber?: unknown; active?: unknown };
    const rowNumber = Number(body.rowNumber);
    if (!Number.isInteger(rowNumber) || rowNumber < 2 || typeof body.active !== "boolean") throw new Error("La opción no es válida.");
    await setConfigItemActive(rowNumber, body.active, access);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
