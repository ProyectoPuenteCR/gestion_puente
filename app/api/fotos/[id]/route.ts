import { MEMBER_EMAIL_HEADER, readManagementSnapshot, readMemberPhoto } from "@/lib/google-sheets";
import { AccessError, currentPortalAccess } from "@/lib/server-access";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await currentPortalAccess();
    const { id } = await context.params;
    const snapshot = await readManagementSnapshot();
    const owner = snapshot.members.find((member) => String(member.values.Foto ?? "") === id);
    if (!owner || (access.role !== "admin" && String(owner.values[MEMBER_EMAIL_HEADER] ?? "").trim().toLowerCase() !== access.email)) {
      throw new AccessError("No tenés acceso a esta foto.", 403);
    }
    const photo = await readMemberPhoto(id);
    return new Response(photo.bytes, { headers: { "content-type": photo.contentType, "cache-control": "private, max-age=3600" } });
  } catch {
    return new Response("Foto no disponible", { status: 404 });
  }
}
