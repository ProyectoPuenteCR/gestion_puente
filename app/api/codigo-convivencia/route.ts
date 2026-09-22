import { acceptCodeOfConduct, readCodeOfConductSnapshot } from "@/lib/google-sheets";
import { apiError, currentPortalAccess } from "@/lib/server-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const access = await currentPortalAccess();
    const rawYear = Number(new URL(request.url).searchParams.get("year"));
    const year = Number.isInteger(rawYear) ? rawYear : new Date().getFullYear();
    const snapshot = await readCodeOfConductSnapshot(access, year);
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