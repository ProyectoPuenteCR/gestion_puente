import "server-only";

import { Resend } from "resend";
import { getGoogleAccessToken, readBirthdayAutomationSnapshot } from "@/lib/google-sheets";
import type { BirthdayAutomationMember, BirthdayAutomationSettings } from "@/lib/portal-types";

type AutomationResult = {
  processed: number;
  succeeded: number;
  deleted?: number;
  errors: string[];
};

function argentinaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { year: value("year"), month: value("month"), day: value("day") };
}

function templateValue(template: string, member: Pick<BirthdayAutomationMember, "name">) {
  const commaName = member.name.includes(",") ? member.name.split(",")[1]?.trim().split(/\s+/)[0] : "";
  const friendlyName = commaName || member.name;
  return template
    .replaceAll("{{nombre_completo}}", member.name)
    .replaceAll("{{nombre}}", friendlyName);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

function emailHtml(message: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#17324d"><div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:18px;padding:32px;border:1px solid #dfe8f1"><div style="font-size:34px">🎂</div><h1 style="font-size:24px;margin:14px 0;color:#087f83">Proyecto Puente</h1><p style="font-size:16px;line-height:1.65;white-space:pre-line">${escapeHtml(message)}</p><p style="margin-top:28px;font-size:13px;color:#718297">Con afecto,<br><strong>Equipo de Proyecto Puente</strong></p></div></body></html>`;
}

function resendClient() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error("Falta RESEND_API_KEY en Vercel.");
  return new Resend(apiKey);
}

function fromAddress() {
  return process.env.BIRTHDAY_FROM_EMAIL?.trim() || "Proyecto Puente <cumpleanios@proyecto-puente.org>";
}

export async function sendBirthdayEmailTest(settings: BirthdayAutomationSettings) {
  const message = templateValue(settings.messageTemplate, { name: "Integrante de prueba" });
  const subject = `[PRUEBA] ${templateValue(settings.subjectTemplate, { name: "Integrante de prueba" })}`;
  const { data, error } = await resendClient().emails.send({
    from: fromAddress(),
    to: settings.ccEmail,
    subject,
    text: message,
    html: emailHtml(message),
  }, { idempotencyKey: `puente-cumple-prueba-${Date.now()}` });
  if (error) throw new Error(`Resend rechazó el correo de prueba: ${error.message}`);
  return { id: data?.id ?? "", recipient: settings.ccEmail };
}

export async function sendBirthdayGreetings(settings: BirthdayAutomationSettings, members: BirthdayAutomationMember[]): Promise<AutomationResult> {
  const today = argentinaDateParts();
  const todaysMembers = members.filter((member) => {
    const [, month, day] = member.birthDate.split("-");
    return month === today.month && day === today.day && member.email;
  });
  const result: AutomationResult = { processed: todaysMembers.length, succeeded: 0, errors: [] };
  const resend = resendClient();

  for (const member of todaysMembers) {
    const message = templateValue(settings.messageTemplate, member);
    const subject = templateValue(settings.subjectTemplate, member);
    const cc = settings.ccEmail && settings.ccEmail !== member.email ? settings.ccEmail : undefined;
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to: member.email,
      ...(cc ? { cc } : {}),
      subject,
      text: message,
      html: emailHtml(message),
    }, { idempotencyKey: `puente-cumple-${today.year}-${today.month}-${today.day}-${member.id}`.slice(0, 256) });
    if (error) result.errors.push(`${member.name}: ${error.message}`);
    else result.succeeded += 1;
  }
  return result;
}

async function calendarEventId(member: BirthdayAutomationMember) {
  const bytes = new TextEncoder().encode(`proyecto-puente:${member.id}:${member.email}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `puentecumple${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 40)}`;
}

function calendarEvent(member: BirthdayAutomationMember) {
  const [, month, day] = member.birthDate.split("-");
  const startDate = `2000-${month}-${day}`;
  const end = new Date(`${startDate}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    summary: `Cumpleaños de ${member.name}`,
    description: "Cumpleaños registrado en el Sistema de Gestión de Proyecto Puente.",
    start: { date: startDate },
    end: { date: end.toISOString().slice(0, 10) },
    recurrence: ["RRULE:FREQ=YEARLY"],
    transparency: "transparent",
    extendedProperties: { private: { proyectoPuenteSource: "gestion", proyectoPuenteMemberId: member.id } },
  };
}

async function upsertCalendarEvent(calendarEmail: string, member: BirthdayAutomationMember, token: string) {
  const eventId = await calendarEventId(member);
  const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarEmail)}/events`;
  const event = calendarEvent(member);
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const update = await fetch(`${baseUrl}/${eventId}?sendUpdates=none`, { method: "PUT", headers, body: JSON.stringify(event), cache: "no-store" });
  if (update.ok) return;
  if (update.status !== 404) {
    const detail = await update.text().catch(() => "");
    throw new Error(`Google Calendar respondió ${update.status}${detail ? `: ${detail.slice(0, 140)}` : ""}`);
  }
  const create = await fetch(`${baseUrl}?sendUpdates=none`, {
    method: "POST",
    headers,
    body: JSON.stringify({ id: eventId, ...event }),
    cache: "no-store",
  });
  if (!create.ok && create.status !== 409) {
    const detail = await create.text().catch(() => "");
    throw new Error(`Google Calendar respondió ${create.status}${detail ? `: ${detail.slice(0, 140)}` : ""}`);
  }
}

async function removeInactiveCalendarEvents(calendarEmail: string, activeEventIds: Set<string>, token: string) {
  const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarEmail)}/events`;
  const headers = { authorization: `Bearer ${token}` };
  let pageToken = "";
  let deleted = 0;
  do {
    const params = new URLSearchParams({
      maxResults: "2500",
      showDeleted: "false",
      singleEvents: "false",
      privateExtendedProperty: "proyectoPuenteSource=gestion",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch(`${baseUrl}?${params}`, { headers, cache: "no-store" });
    if (!response.ok) throw new Error(`Google Calendar no permitió revisar eventos anteriores (${response.status}).`);
    const payload = await response.json() as { items?: Array<{ id?: string }>; nextPageToken?: string };
    for (const event of payload.items ?? []) {
      if (!event.id || activeEventIds.has(event.id)) continue;
      const removal = await fetch(`${baseUrl}/${encodeURIComponent(event.id)}?sendUpdates=none`, { method: "DELETE", headers, cache: "no-store" });
      if (removal.ok || removal.status === 404 || removal.status === 410) deleted += 1;
      else throw new Error(`Google Calendar no permitió eliminar un cumpleaños inactivo (${removal.status}).`);
    }
    pageToken = payload.nextPageToken ?? "";
  } while (pageToken);
  return deleted;
}

export async function syncBirthdayCalendar(settings: BirthdayAutomationSettings, members: BirthdayAutomationMember[]): Promise<AutomationResult> {
  const token = await getGoogleAccessToken();
  const result: AutomationResult = { processed: members.length, succeeded: 0, deleted: 0, errors: [] };
  const activeEventIds = new Set(await Promise.all(members.map((member) => calendarEventId(member))));
  const batchSize = 8;
  for (let index = 0; index < members.length; index += batchSize) {
    const batch = members.slice(index, index + batchSize);
    const settled = await Promise.allSettled(batch.map((member) => upsertCalendarEvent(settings.calendarEmail, member, token)));
    settled.forEach((entry, entryIndex) => {
      if (entry.status === "fulfilled") result.succeeded += 1;
      else result.errors.push(`${batch[entryIndex].name}: ${entry.reason instanceof Error ? entry.reason.message : "No se pudo sincronizar"}`);
    });
  }
  try {
    result.deleted = await removeInactiveCalendarEvents(settings.calendarEmail, activeEventIds, token);
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : "No se pudieron retirar cumpleaños inactivos del calendario.");
  }
  return result;
}

export async function runBirthdayAutomation() {
  const { settings, members } = await readBirthdayAutomationSnapshot();
  if (!settings.enabled) return { enabled: false, calendar: null, email: null };
  const [calendar, email] = await Promise.all([
    syncBirthdayCalendar(settings, members).catch((error: unknown) => ({ processed: members.length, succeeded: 0, errors: [error instanceof Error ? error.message : "Falló Google Calendar"] })),
    sendBirthdayGreetings(settings, members).catch((error: unknown) => ({ processed: 0, succeeded: 0, errors: [error instanceof Error ? error.message : "Falló el envío de correo"] })),
  ]);
  return { enabled: true, calendar, email };
}
