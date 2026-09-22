import { readBirthdayAutomationSnapshot } from "@/lib/google-sheets";
import { sendBirthdayEmailTest, syncBirthdayCalendar } from "@/lib/birthday-automation";
import { apiError, currentPortalAccess, requireAdmin } from "@/lib/server-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const access = await currentPortalAccess();
    requireAdmin(access);
    const body = (await request.json()) as { action?: "sync-calendar" | "test-email" };
    const snapshot = await readBirthdayAutomationSnapshot();
    if (body.action === "test-email") {
      const result = await sendBirthdayEmailTest(snapshot.settings);
      return Response.json({ result, message: `Correo de prueba enviado a ${result.recipient}.` });
    }
    if (body.action === "sync-calendar") {
      const result = await syncBirthdayCalendar(snapshot.settings, snapshot.members);
      if (result.errors.length) throw new Error(`Se sincronizaron ${result.succeeded} de ${result.processed} cumpleaños. ${result.errors[0]}`);
      return Response.json({ result, message: `${result.succeeded} cumpleaños sincronizados y ${result.deleted ?? 0} eventos de bajas retirados de Google Calendar.` });
    }
    throw new Error("La acción de cumpleaños no es válida.");
  } catch (error) {
    return apiError(error);
  }
}
