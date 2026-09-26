import { readPublicNewMemberInvitation, submitNewMemberApplication } from "@/lib/google-sheets";
import type { MemberFieldValue } from "@/lib/portal-types";

export const dynamic = "force-dynamic";

function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : "No se pudo completar la solicitud.";
  return Response.json({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    const payload = await readPublicNewMemberInvitation(token);
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return publicError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: unknown;
      values?: unknown;
    };
    if (!body.values || typeof body.values !== "object" || Array.isArray(body.values)) {
      throw new Error("Los datos enviados no son válidos.");
    }
    const result = await submitNewMemberApplication(
      String(body.token ?? ""),
      body.values as Record<string, MemberFieldValue>,
    );
    return Response.json(result, { status: 201 });
  } catch (error) {
    return publicError(error);
  }
}
