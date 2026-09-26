import { MEMBER_HEADERS, readHistoricalMembers } from "@/lib/google-sheets";
import { apiError, currentPortalAccess, requireAdmin } from "@/lib/server-access";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const access = await currentPortalAccess();
    requireAdmin(access);
    const rows = await readHistoricalMembers();
    return Response.json(
      {
        headers: [...MEMBER_HEADERS],
        rows,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}