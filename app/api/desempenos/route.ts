import { addPerformanceComment, readPerformanceComments } from "@/lib/google-sheets";
import { AccessError, apiError, currentPortalAccess, requireAdmin } from "@/lib/server-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const access = await currentPortalAccess();
    const params = new URL(request.url).searchParams;
    const email = params.get("email") ?? "";
    if (access.role !== "admin" && email.trim().toLowerCase() !== access.email) {
      throw new AccessError("Sólo podés consultar tu propio reporte.", 403);
    }
    const rawYear = params.get("year");
    const year = rawYear ? Number(rawYear) : undefined;
    return Response.json({ comments: await readPerformanceComments(email, year !== undefined && Number.isInteger(year) ? year : undefined) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await currentPortalAccess();
    requireAdmin(access);
    const body = (await request.json()) as { email?: unknown; comment?: unknown; year?: unknown };
    const comment = await addPerformanceComment(String(body.email ?? ""), String(body.comment ?? ""), Number(body.year), access);
    return Response.json({ comment }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
