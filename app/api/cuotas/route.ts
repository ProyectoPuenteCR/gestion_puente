import { readSocialFeeSnapshot, SOCIAL_FEE_STATUSES, updateSocialFees } from "@/lib/google-sheets";
import type { SocialFeeStatus } from "@/lib/portal-types";
import { apiError, currentPortalAccess, requireAdmin } from "@/lib/server-access";

export const dynamic = "force-dynamic";

function validYear(value: unknown) {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("El año no es válido.");
  return year;
}

function validMonth(value: unknown) {
  const month = Number(value);
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("El mes no es válido.");
  return month;
}

function validStatus(value: unknown) {
  const status = String(value ?? "") as SocialFeeStatus;
  if (!SOCIAL_FEE_STATUSES.includes(status)) throw new Error("El estado no es válido.");
  return status;
}

export async function GET(request: Request) {
  try {
    const access = await currentPortalAccess();
    const requestedYear = Number(new URL(request.url).searchParams.get("year"));
    const selectedYear = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100
      ? requestedYear
      : new Date().getFullYear();
    const snapshot = await readSocialFeeSnapshot(selectedYear);
    const members = access.role === "admin"
      ? snapshot.members
      : snapshot.members.filter((member) => member.email === access.email);
    const allowedEmails = new Set(members.map((member) => member.email));
    const records = access.role === "admin"
      ? snapshot.records
      : snapshot.records.filter((record) => allowedEmails.has(record.email));
    const currentYear = new Date().getFullYear();
    const years = [...new Set([
      currentYear + 1,
      currentYear,
      currentYear - 1,
      currentYear - 2,
      Number.isInteger(requestedYear) ? requestedYear : currentYear,
      ...records.map((record) => record.year),
      ...snapshot.config.filter((item) => item.type === "VALOR_CUOTA").map((item) => item.order),
    ])].sort((a, b) => b - a);
    return Response.json({
      members,
      records,
      years,
      canManage: access.role === "admin",
      canSelfReport: access.role === "admin" || snapshot.canUsersSelfReport,
      currentEmail: access.email,
      feeAmount: snapshot.feeAmount,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await currentPortalAccess();
    const body = (await request.json()) as {
      action?: unknown;
      email?: unknown;
      emails?: unknown;
      year?: unknown;
      month?: unknown;
      status?: unknown;
      scope?: unknown;
    };
    const year = validYear(body.year);
    const month = validMonth(body.month);

    const scope = body.scope === "year" ? "year" : "month";
    const months = scope === "year" ? Array.from({ length: 12 }, (_, index) => index + 1) : [month];

    if (body.action === "bulk_set" || body.action === "bulk_paid") {
      requireAdmin(access);
      if (!Array.isArray(body.emails)) throw new Error("La selección de integrantes no es válida.");
      const emails = [...new Set(body.emails.map((email) => String(email).trim().toLowerCase()).filter(Boolean))];
      const status = body.action === "bulk_paid" ? "P" as const : validStatus(body.status);
      const result = await updateSocialFees(
        emails.flatMap((email) => months.map((selectedMonth) => ({ email, year, month: selectedMonth, status }))),
        access,
      );
      return Response.json(result);
    }

    const email = access.role === "admin" ? String(body.email ?? "") : access.email;
    const status = validStatus(body.status);
    const selectedMonths = access.role === "admin" ? months : [month];
    const result = await updateSocialFees(selectedMonths.map((selectedMonth) => ({ email, year, month: selectedMonth, status })), access);
    return Response.json(result);
  } catch (error) {
    return apiError(error);
  }
}
