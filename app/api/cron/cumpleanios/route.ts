import { runBirthdayAutomation } from "@/lib/birthday-automation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  const result = await runBirthdayAutomation();
  const errors = [...(result.calendar?.errors ?? []), ...(result.email?.errors ?? [])];
  return Response.json({ ok: errors.length === 0, ...result, errors }, { status: errors.length ? 500 : 200 });
}
