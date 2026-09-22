import { acceptCodeOfConduct, readCodeOfConductSnapshot } from "@/lib/google-sheets";
import { apiError, currentPortalAccess } from "@/lib/server-access";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const access = await currentPortalAccess();
    const snapshot = await readCodeOfConductSnapshot(access);
    return Response.json(snapshot, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await currentPortalAccess();
    const body = (await request.json()) as {
      dni?: unknown;
      acceptsCode?: unknown;
      acceptsImages?: unknown;
      acceptsFee?: unknown;
      feeReason?: unknown;
    };
    const acceptance = await acceptCodeOfConduct(
      {
        dni: String(body.dni ?? ""),
        acceptsCode: body.acceptsCode === true,
        acceptsImages: body.acceptsImages === true,
        acceptsFee: body.acceptsFee === true,
        feeReason: String(body.feeReason ?? ""),
      },
      access,
    );
    return Response.json({ acceptance }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}