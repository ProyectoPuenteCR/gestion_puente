import { readScoringSnapshot, updateScoringHistory } from "@/lib/google-sheets";
import { apiError, currentPortalAccess, requireScoringEditor } from "@/lib/server-access";

export const dynamic = "force-dynamic";

type ScoringEntryInput = {
  topic?: unknown;
  score?: unknown;
  observation?: unknown;
};

export async function GET() {
  try {
    const access = await currentPortalAccess();
    requireScoringEditor(access);
    return Response.json(await readScoringSnapshot());
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await currentPortalAccess();
    requireScoringEditor(access);
    const body = (await request.json()) as {
      memberId?: unknown;
      year?: unknown;
      month?: unknown;
      entries?: ScoringEntryInput[];
    };
    const memberId = String(body.memberId ?? "").trim();
    const year = Number(body.year);
    const month = Number(body.month);
    if (!memberId || !Array.isArray(body.entries)) throw new Error("El scoring enviado no es válido.");
    const entries = body.entries.map((item) => {
      const rawScore = item.score;
      const score = rawScore === "" || rawScore === null || rawScore === undefined ? null : Number(rawScore);
      if (!String(item.topic ?? "").trim() || (score !== null && !Number.isFinite(score))) throw new Error("Una calificación no es válida.");
      return {
        topic: String(item.topic),
        score,
        observation: String(item.observation ?? ""),
      };
    });
    const result = await updateScoringHistory(memberId, year, month, entries, access);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
