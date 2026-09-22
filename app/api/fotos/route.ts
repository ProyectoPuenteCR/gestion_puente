import { canUsersEditOwnProfile, readManagementSnapshot, uploadMemberPhoto } from "@/lib/google-sheets";
import { AccessError, apiError, currentPortalAccess } from "@/lib/server-access";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const access = await currentPortalAccess();
    if (access.role !== "admin") {
      const snapshot = await readManagementSnapshot();
      if (access.role !== "usuario" || !canUsersEditOwnProfile(snapshot.config)) throw new AccessError("La edición de fotos está deshabilitada.", 403);
    }
    const data = await request.formData();
    const file = data.get("foto");
    if (!(file instanceof File)) throw new Error("No se recibió ninguna foto.");
    const id = await uploadMemberPhoto(file, String(data.get("nombre") ?? "integrante"));
    return Response.json({ id });
  } catch (error) {
    return apiError(error);
  }
}
