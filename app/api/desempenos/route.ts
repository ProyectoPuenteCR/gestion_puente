import { addPerformanceComment, readPerformanceComments } from "@/lib/google-sheets";
import { AccessError, apiError, currentPortalAccess, requireAdmin } from "@/lib/server-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const access = await currentPortalAccess();
    const params = new URL(request.url).searchParams;
    const requestedEmail = (params.get("email") ?? "").trim().toLowerCase();
    if (access.role !== "admin" && requestedEmail && requestedEmail !== access.email) {
      throw new AccessError("Sólo podés consultar tu propio reporte.", 403);
    }
    const email = access.role === "admin" ? requestedEmail : access.email;
    const rawYear = params.get("year");
    const year = rawYear ? Number(rawYear) : undefined;
    return Response.json(
      { comments: await readPerformanceComments(email, year !== undefined && Number.isInteger(year) ? year : undefined) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
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
