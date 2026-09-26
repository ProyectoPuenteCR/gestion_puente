import {
  approveNewMemberRequest,
  createNewMemberInvitation,
  incorporateApprovedNewMember,
  readNewMemberRequests,
  rejectNewMemberRequest,
  syncApprovedNewMemberRequests,
} from "@/lib/google-sheets";
import { apiError, currentPortalAccess, requireAdmin } from "@/lib/server-access";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const access = await currentPortalAccess();
    requireAdmin(access);
    const rosterSynced = await syncApprovedNewMemberRequests(access);
    return Response.json(
      { requests: await readNewMemberRequests(), rosterSynced },
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
    const body = (await request.json()) as {
      action?: unknown;
      id?: unknown;
      reason?: unknown;
      email?: unknown;
    };
    const action = String(body.action ?? "");

    if (action === "create_invitation") {
      return Response.json(await createNewMemberInvitation(access), { status: 201 });
    }
    if (action === "approve") {
      return Response.json(await approveNewMemberRequest(String(body.id ?? ""), access));
    }
    if (action === "reject") {
      return Response.json(await rejectNewMemberRequest(String(body.id ?? ""), String(body.reason ?? ""), access));
    }
    if (action === "incorporate") {
      return Response.json(await incorporateApprovedNewMember(String(body.id ?? ""), String(body.email ?? ""), access));
    }
    throw new Error("La acción solicitada no es válida.");
  } catch (error) {
    return apiError(error);
  }
}
