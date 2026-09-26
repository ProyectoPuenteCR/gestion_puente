import "server-only";

import { inflateRawSync } from "node:zlib";

import type {
  Asistencia,
  BirthdayAutomationMember,
  BirthdayAutomationSettings,
  CodeOfConductAcceptance,
  CodeOfConductUserStatus,
  ConfigCategory,
  ConfigItem,
  Integrante,
  MemberFieldValue,
  MemberRecord,
  PerformanceComment,
  PlatformAccount,
  ScoringColumn,
  ScoringHistoryRecord,
  ScoringMember,
  ScoringPerson,
  SocialFeeMember,
  SocialFeeRecord,
  SocialFeeStatus,
  UserScreen,
  UserRole,
} from "@/lib/portal-types";

type SheetValue = string | number | boolean | null;
type SheetRows = SheetValue[][];
type TokenCache = { value: string; expiresAt: number };
type MetadataCache = { value: Record<string, number>; expiresAt: number };

const globalGoogleCache = globalThis as typeof globalThis & {
  __proyectoPuenteGoogleToken?: TokenCache;
  __proyectoPuenteSheetIds?: MetadataCache;
};

export const MEMBER_HEADERS = [
  "Numero de orden",
  "Numero de Matricula",
  "Apellidos y nombres ( Del integrante )",
  "DNI",
  "email-puente",
  "Confirmo asistencia al ciclo 2026 de Proyecto Puente",
  "Horario en que asisto al proyecto",
  "Conozco el codigo de conducta de Proyecto Puente",
  "Por que me gusta participar del proyecto?",
  "Que me gustaría cambiar del Proyecto",
  "Que actividad te gustaria realizar este año",
  "Cuota Social",
  "Quiero dejar un comentario",
  "CELULAR",
  "Dirección de correo electrónico",
  "Fecha de Nacimiento",
  "Dirección Actual donde vivo",
  "Titulo obtenido o en curso",
  "Estoy estudiando?",
  "Posee Obra social",
  "Si posee obra social indique cual",
  "En caso de emergencia avisar a ( indicar nombre y celular)",
  "Posee algún tipo de enfermedad patología que requiera algún cuidado especial",
  "Edad",
  "Nombre de padre madre o responsable",
  "Dirección del responsable",
  "Teléfono celular del responsable",
  "Tarea que desempeño dentro del Proyecto",
  "Año de ingreso al Proyecto",
  "Marca temporal",
  "Foto",
] as const;

export type MemberHeader = (typeof MEMBER_HEADERS)[number];

export const MEMBER_EMAIL_HEADER: MemberHeader = "email-puente";
export const MEMBER_NAME_HEADER: MemberHeader = "Apellidos y nombres ( Del integrante )";
export const MEMBER_BIRTHDAY_HEADER: MemberHeader = "Fecha de Nacimiento";
export const MEMBER_AGE_HEADER: MemberHeader = "Edad";

const SHEET_RANGES = [
  "Integrantes!A1:AE1000",
  "cumpleaños!A1:M1000",
  "Asistencia!A1:Q5000",
  "scoring!A1:AA1000",
  "Configuracion!A1:F1000",
  "Cuotas!A1:J5000",
  "'Scoring Historial'!A1:J5000",
];
const MANAGEMENT_RANGES = [
  "Integrantes!A1:AE1000",
  "Configuracion!A1:F1000",
  "Usuarios!A1:F1000",
];
const ADMIN_EMAIL_FALLBACK = "brechasdigitales@proyecto-puente.org";
const SYSTEM_FIELDS = new Set<MemberHeader>(["Numero de orden", "Numero de Matricula", "Edad", "Marca temporal"]);
export const SOCIAL_FEE_SELF_REPORT_PERMISSION = "CUOTA_USUARIO_PUEDE_MARCAR_PAGO";
export const MEMBER_SELF_EDIT_PERMISSION = "INTEGRANTES_USUARIO_PUEDE_EDITAR";
export const SOCIAL_FEE_STATUSES: SocialFeeStatus[] = ["", "P", "Debe", "Beca", "Baja", "Exento"];
export const SOCIAL_FEE_MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;
export const DEFAULT_BIRTHDAY_SETTINGS: BirthdayAutomationSettings = {
  enabled: false,
  ccEmail: ADMIN_EMAIL_FALLBACK,
  calendarEmail: ADMIN_EMAIL_FALLBACK,
  subjectTemplate: "¡Feliz cumpleaños, {{nombre}}!",
  messageTemplate: "¡Feliz cumpleaños, {{nombre}}! Todo el equipo de Proyecto Puente te desea un día lleno de alegría y buenos momentos.",
};

const CONFIG_CATEGORIES: ConfigCategory[] = [
  "HORARIO", "TITULO", "ACTIVIDAD", "TAREA", "TEMA_SCORING", "PANTALLA", "PERMISO", "VALOR_CUOTA",
  "CUMPLEANOS_AUTOMATICO", "CUMPLEANOS_COPIA", "CUMPLEANOS_CALENDARIO", "CUMPLEANOS_ASUNTO", "CUMPLEANOS_MENSAJE",
];

function base64UrlFromBytes(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlFromText(value: string) {
  return base64UrlFromBytes(new TextEncoder().encode(value));
}

function normalizePrivateKeyValue(value?: string | null) {
  let normalized = (value ?? "").trim();
  if (
    normalized.length >= 2 &&
    ((normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'")))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized.replace(/\\n/g, "\n").trim();
}

function privateKeyPem() {
  const base64 = normalizePrivateKeyValue(process.env.GOOGLE_PRIVATE_KEY_BASE64);
  if (base64) {
    try {
      const decoded = normalizePrivateKeyValue(atob(base64.replace(/\s/g, "")));
      if (decoded.includes("-----BEGIN PRIVATE KEY-----") && decoded.includes("-----END PRIVATE KEY-----")) {
        return decoded;
      }
    } catch {
      // Si la variable Base64 quedó mal copiada en Vercel, usamos GOOGLE_PRIVATE_KEY como respaldo.
    }
  }

  const direct = normalizePrivateKeyValue(process.env.GOOGLE_PRIVATE_KEY);
  if (direct.includes("-----BEGIN PRIVATE KEY-----") && direct.includes("-----END PRIVATE KEY-----")) {
    return direct;
  }
  return direct;
}

function pemToArrayBuffer(pem: string) {
  const encoded = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

async function createSignedJwt() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const pem = privateKeyPem();
  if (!email || !pem) throw new Error("Faltan credenciales de la cuenta de servicio de Google.");
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlFromText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlFromText(JSON.stringify({
    iss: email,
    scope: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/drive",
    ].join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: now - 30,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64UrlFromBytes(new Uint8Array(signature))}`;
}

export async function getGoogleAccessToken() {
  const cached = globalGoogleCache.__proyectoPuenteGoogleToken;
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;
  const assertion = await createSignedJwt();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { error?: string; error_description?: string } | null;
    const description = (detail?.error_description || detail?.error || "").replace(/\s+/g, " ").trim().slice(0, 300);
    throw new Error(
      description
        ? "Google rechazó la autenticación de la cuenta de servicio: " + description
        : "Google rechazó la autenticación de la cuenta de servicio.",
    );
  }
  const token = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!token.access_token) throw new Error("Google no devolvió un token de acceso válido.");
  globalGoogleCache.__proyectoPuenteGoogleToken = {
    value: token.access_token,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
  };
  return token.access_token;
}

async function driveFolderId() {
  const configured = process.env.GOOGLE_DRIVE_PHOTOS_FOLDER_ID?.trim();
  if (configured) return configured;
  const token = await getGoogleAccessToken();
  const query = encodeURIComponent("name = 'fotos' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
  const lookup = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)&pageSize=1`, {
    headers: { authorization: `Bearer ${token}` }, cache: "no-store",
  });
  if (!lookup.ok) throw new Error("No se pudo buscar la carpeta fotos en Google Drive.");
  const existing = (await lookup.json()) as { files?: Array<{ id: string }> };
  if (existing.files?.[0]?.id) return existing.files[0].id;
  const created = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ name: "fotos", mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!created.ok) throw new Error("No se pudo crear la carpeta fotos en Google Drive.");
  const folder = (await created.json()) as { id?: string };
  if (!folder.id) throw new Error("Google Drive no devolvió el identificador de la carpeta fotos.");
  return folder.id;
}

export async function uploadMemberPhoto(file: File, memberName: string) {
  if (!file.type.startsWith("image/")) throw new Error("Seleccioná una imagen válida.");
  if (file.size > 5 * 1024 * 1024) throw new Error("La foto puede pesar hasta 5 MB.");
  const token = await getGoogleAccessToken();
  const folderId = await driveFolderId();
  const extension = (file.name.split(".").pop() || file.type.split("/").pop() || "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 8);
  const safeName = memberName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "integrante";
  const boundary = `puente_${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: `${safeName}-${Date.now()}.${extension}`, parents: [folderId] });
  const prefix = new TextEncoder().encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`);
  const suffix = new TextEncoder().encode(`\r\n--${boundary}--`);
  const bytes = new Uint8Array(prefix.length + file.size + suffix.length);
  bytes.set(prefix); bytes.set(new Uint8Array(await file.arrayBuffer()), prefix.length); bytes.set(suffix, prefix.length + file.size);
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": `multipart/related; boundary=${boundary}` },
    body: new Blob([bytes]),
  });
  if (!response.ok) throw new Error("No se pudo guardar la foto en Google Drive.");
  const uploaded = (await response.json()) as { id?: string };
  if (!uploaded.id) throw new Error("Google Drive no devolvió el identificador de la foto.");
  return uploaded.id;
}

export async function readMemberPhoto(fileId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) throw new Error("La foto solicitada no es válida.");
  const token = await getGoogleAccessToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
    headers: { authorization: `Bearer ${token}` }, cache: "no-store",
  });
  if (!response.ok) throw new Error("No se pudo leer la foto del integrante.");
  return { bytes: await response.arrayBuffer(), contentType: response.headers.get("content-type") || "image/jpeg" };
}

function spreadsheetId() {
  const value = process.env.GOOGLE_SHEET_ID?.trim();
  if (!value) throw new Error("Falta GOOGLE_SHEET_ID.");
  return value;
}

async function googleRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await getGoogleAccessToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 403 || response.status === 404) {
      throw new Error("La hoja no está compartida con permiso de edición o el ID es incorrecto.");
    }
    throw new Error(`Google Sheets respondió ${response.status}${detail ? ": " + detail.slice(0, 160) : ""}.`);
  }
  return (await response.json()) as T;
}

async function readRanges(ranges: string[]) {
  const params = new URLSearchParams({
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
    majorDimension: "ROWS",
  });
  for (const range of ranges) params.append("ranges", range);
  return googleRequest<{ valueRanges?: Array<{ range?: string; values?: SheetRows }> }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId())}/values:batchGet?${params}`,
  );
}

async function sheetIds() {
  const cached = globalGoogleCache.__proyectoPuenteSheetIds;
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const payload = await googleRequest<{ sheets?: Array<{ properties?: { sheetId?: number; title?: string } }> }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId())}?fields=sheets.properties(sheetId,title)`,
  );
  const ids = Object.fromEntries((payload.sheets ?? []).flatMap((sheet) => {
    const title = sheet.properties?.title;
    const id = sheet.properties?.sheetId;
    return title && typeof id === "number" ? [[title, id]] : [];
  }));
  globalGoogleCache.__proyectoPuenteSheetIds = { value: ids, expiresAt: Date.now() + 5 * 60_000 };
  return ids;
}

async function writeRequests(requests: Array<Record<string, unknown>>) {
  return googleRequest<{ replies?: unknown[] }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId())}:batchUpdate`,
    { method: "POST", body: JSON.stringify({ requests }) },
  );
}

export function normalizeHeader(value: SheetValue) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeEmail(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function headerIndex(headers: SheetValue[], candidates: string[], fallback: number) {
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates) {
    const exact = normalized.indexOf(normalizeHeader(candidate));
    if (exact >= 0) return exact;
  }
  for (const candidate of candidates) {
    const partial = normalized.findIndex((header) => header.includes(normalizeHeader(candidate)));
    if (partial >= 0) return partial;
  }
  return fallback;
}

function cellText(value: SheetValue) {
  return String(value ?? "").trim();
}

function parseBoolean(value: SheetValue) {
  if (typeof value === "boolean") return value;
  const normalized = normalizeHeader(value);
  return normalized === "true" || normalized === "si" || normalized === "activo";
}

export function parseSheetDate(value: SheetValue): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Math.round((value - 25569) * 86_400_000));
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  const text = cellText(value);
  if (!text) return null;
  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const local = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (local) {
    const year = local[3].length === 2 ? `20${local[3]}` : local[3];
    return `${year}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export function calculateAge(value: SheetValue) {
  const iso = parseSheetDate(value);
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

function memberRecord(row: SheetValue[], index: number): MemberRecord | null {
  const values = Object.fromEntries(MEMBER_HEADERS.map((header, column) => {
    if (header === MEMBER_BIRTHDAY_HEADER) return [header, parseSheetDate(row[column]) ?? ""];
    return [header, cellText(row[column])];
  })) as Record<string, MemberFieldValue>;
  const name = cellText(row[2]);
  const email = normalizeEmail(cellText(row[4]));
  const matricula = cellText(row[1]);
  if (!name && !email && !matricula) return null;
  const age = calculateAge(row[15]);
  values[MEMBER_AGE_HEADER] = age === null ? "" : String(age);
  return {
    id: email || matricula || `fila-${index + 2}`,
    rowNumber: index + 2,
    values,
    age,
    ageStatus: age === null ? "Sin fecha" : age >= 18 ? "Mayor de edad" : "Menor de edad",
  };
}

function parseConfig(rows: SheetRows): ConfigItem[] {
  return rows.slice(1).flatMap((row, index) => {
    const type = cellText(row[0]) as ConfigCategory;
    const value = cellText(row[1]);
    if (!value || !CONFIG_CATEGORIES.includes(type)) return [];
    return [{ rowNumber: index + 2, type, value, active: parseBoolean(row[2]), order: Number(row[3]) || index + 1 }];
  });
}

function parseAccounts(rows: SheetRows): PlatformAccount[] {
  return rows.slice(1).flatMap((row, index) => {
    const email = normalizeEmail(cellText(row[0]));
    if (!email) return [];
    const roleValue = normalizeHeader(row[2]);
    return [{
      rowNumber: index + 2,
      email,
      name: cellText(row[1]) || email,
      role: roleValue === "admin" ? "admin" : roleValue === "capacitador" ? "capacitador" : "usuario",
      active: parseBoolean(row[3]),
    } satisfies PlatformAccount];
  });
}

type ManagementState = {
  rawMembers: SheetRows;
  rawConfig: SheetRows;
  members: MemberRecord[];
  config: ConfigItem[];
  accounts: PlatformAccount[];
};

async function managementState(): Promise<ManagementState> {
  const payload = await readRanges(MANAGEMENT_RANGES);
  const ranges = payload.valueRanges ?? [];
  const rawMembers = ranges[0]?.values ?? [];
  const rawConfig = ranges[1]?.values ?? [];
  return {
    rawMembers,
    rawConfig,
    members: rawMembers.slice(1).flatMap((row, index) => memberRecord(row, index) ?? []),
    config: parseConfig(rawConfig),
    accounts: parseAccounts(ranges[2]?.values ?? []),
  };
}

export async function readManagementSnapshot() {
  const state = await managementState();
  return { members: state.members, config: state.config, accounts: state.accounts };
}

export function birthdayAutomationSettings(config: ConfigItem[]): BirthdayAutomationSettings {
  const value = (type: ConfigCategory, fallback: string) => config.find((item) => item.type === type)?.value || fallback;
  return {
    enabled: config.find((item) => item.type === "CUMPLEANOS_AUTOMATICO")?.active ?? DEFAULT_BIRTHDAY_SETTINGS.enabled,
    ccEmail: value("CUMPLEANOS_COPIA", DEFAULT_BIRTHDAY_SETTINGS.ccEmail),
    calendarEmail: value("CUMPLEANOS_CALENDARIO", DEFAULT_BIRTHDAY_SETTINGS.calendarEmail),
    subjectTemplate: value("CUMPLEANOS_ASUNTO", DEFAULT_BIRTHDAY_SETTINGS.subjectTemplate),
    messageTemplate: value("CUMPLEANOS_MENSAJE", DEFAULT_BIRTHDAY_SETTINGS.messageTemplate),
  };
}

export async function readBirthdayAutomationSnapshot() {
  const state = await managementState();
  const members: BirthdayAutomationMember[] = state.members.flatMap((member) => {
    const name = cellText(member.values[MEMBER_NAME_HEADER]);
    const birthDate = parseSheetDate(member.values[MEMBER_BIRTHDAY_HEADER]);
    if (!name || !birthDate) return [];
    return [{
      id: member.id,
      email: normalizeEmail(String(member.values[MEMBER_EMAIL_HEADER] ?? "")),
      name,
      birthDate,
    }];
  });
  return { settings: birthdayAutomationSettings(state.config), members };
}

function socialFeeStatus(value: SheetValue): SocialFeeStatus {
  const normalized = normalizeHeader(value);
  if (normalized === "p") return "P";
  if (normalized === "debe") return "Debe";
  if (normalized === "beca" || normalized === "becado") return "Beca";
  if (normalized === "baja") return "Baja";
  if (normalized === "exento" || normalized === "exenta") return "Exento";
  return "";
}

function parseSocialFees(rows: SheetRows): SocialFeeRecord[] {
  return rows.slice(1).flatMap((row, index) => {
    const year = Number(row[1]);
    const month = Number(row[3]);
    const name = cellText(row[5]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || !name) return [];
    return [{
      id: cellText(row[0]) || `cuota-${index + 2}`,
      rowNumber: index + 2,
      year,
      month,
      monthName: cellText(row[2]) || SOCIAL_FEE_MONTHS[month - 1],
      email: normalizeEmail(cellText(row[4])),
      name,
      status: socialFeeStatus(row[6]),
      paidAt: cellText(row[7]),
      updatedAt: cellText(row[8]),
      updatedBy: normalizeEmail(cellText(row[9])) || cellText(row[9]),
    } satisfies SocialFeeRecord];
  });
}

function parseScoringHistory(rows: SheetRows): ScoringHistoryRecord[] {
  return rows.slice(1).flatMap((row, index) => {
    const year = Number(row[1]);
    const month = Number(row[2]);
    const name = cellText(row[4]);
    const topic = cellText(row[5]);
    const rawScore = cellText(row[6]);
    const score = rawScore === "" ? null : Number(row[6]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || !name || !topic) return [];
    return [{
      id: cellText(row[0]) || `scoring-historial-${index + 2}`,
      rowNumber: index + 2,
      year,
      month,
      email: normalizeEmail(cellText(row[3])),
      name,
      topic,
      score: score !== null && Number.isFinite(score) ? score : null,
      observation: cellText(row[7]),
      updatedAt: cellText(row[8]),
      updatedBy: normalizeEmail(cellText(row[9])) || cellText(row[9]),
    } satisfies ScoringHistoryRecord];
  });
}

async function scoringState() {
  const [state, payload] = await Promise.all([
    managementState(),
    readRanges(["'Scoring Historial'!A1:J5000"]),
  ]);
  const rawHistory = payload.valueRanges?.[0]?.values ?? [];
  const members: ScoringPerson[] = state.members.map((member) => ({
    id: member.id,
    email: normalizeEmail(String(member.values[MEMBER_EMAIL_HEADER] ?? "")),
    name: cellText(member.values[MEMBER_NAME_HEADER]),
    turno: cellText(member.values["Horario en que asisto al proyecto"]) || "Sin turno",
    matricula: cellText(member.values["Numero de Matricula"]),
  })).filter((member) => member.name).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const emailByName = new Map(members.flatMap((member) => member.email ? [[normalizeHeader(member.name), member.email]] : []));
  const records = parseScoringHistory(rawHistory).map((record) => ({
    ...record,
    email: record.email || emailByName.get(normalizeHeader(record.name)) || "",
  }));
  const topics = state.config
    .filter((item) => item.type === "TEMA_SCORING" && item.active)
    .sort((a, b) => a.order - b.order)
    .map((item) => item.value);
  return { state, rawHistory, members, records, topics };
}

export async function readScoringSnapshot() {
  const snapshot = await scoringState();
  const currentYear = new Date().getFullYear();
  const years = [...new Set([
    currentYear + 1,
    currentYear,
    currentYear - 1,
    ...snapshot.records.map((record) => record.year),
  ])].sort((a, b) => b - a);
  return { members: snapshot.members, records: snapshot.records, topics: snapshot.topics, years };
}

export function canUsersSelfReportSocialFee(config: ConfigItem[]) {
  return config.some((item) =>
    item.type === "PERMISO" && item.active && normalizeHeader(item.value) === normalizeHeader(SOCIAL_FEE_SELF_REPORT_PERMISSION),
  );
}

export function canUsersEditOwnProfile(config: ConfigItem[]) {
  return config.some((item) =>
    item.type === "PERMISO" && item.active && normalizeHeader(item.value) === normalizeHeader(MEMBER_SELF_EDIT_PERMISSION),
  );
}

export function socialFeeAmountForYear(config: ConfigItem[], year: number) {
  const item = config.find((entry) => entry.type === "VALOR_CUOTA" && entry.active && entry.order === year);
  const amount = Number(item?.value ?? 0);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

export async function readSocialFeeSnapshot(year = new Date().getFullYear()) {
  const [state, payload] = await Promise.all([managementState(), readRanges(["Cuotas!A1:J5000"])]);
  const members: SocialFeeMember[] = state.members.flatMap((member) => {
    const email = normalizeEmail(String(member.values[MEMBER_EMAIL_HEADER] ?? ""));
    const name = cellText(member.values[MEMBER_NAME_HEADER]);
    if (!email || !name) return [];
    return [{ id: member.id, email, name }];
  }).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const emailByName = new Map(members.map((member) => [normalizeHeader(member.name), member.email]));
  const records = parseSocialFees(payload.valueRanges?.[0]?.values ?? []).map((record) => ({
    ...record,
    email: record.email || emailByName.get(normalizeHeader(record.name)) || "",
  }));
  return {
    members,
    records,
    config: state.config,
    feeAmount: socialFeeAmountForYear(state.config, year),
    canUsersSelfReport: canUsersSelfReportSocialFee(state.config),
  };
}

function configuredAdminEmails() {
  return new Set((process.env.AUTH_ADMIN_EMAILS ?? ADMIN_EMAIL_FALLBACK).split(",").map(normalizeEmail).filter(Boolean));
}

function requireInstitutionalEmail(email: string) {
  const allowed = (process.env.AUTH_ALLOWED_DOMAIN ?? "proyecto-puente.org").trim().toLowerCase();
  const separator = email.lastIndexOf("@");
  if (separator <= 0 || email.indexOf("@") !== separator || email.slice(separator + 1) !== allowed) {
    throw new Error(`El email-puente debe pertenecer a @${allowed}.`);
  }
}

export async function lookupPlatformAccess(emailValue?: string | null) {
  const email = normalizeEmail(emailValue);
  if (!email) return null;
  if (configuredAdminEmails().has(email)) return { email, role: "admin" as const, active: true };
  if (!hasGoogleSheetsConfig()) return { email, role: "usuario" as const, active: true };
  const state = await managementState();
  const account = state.accounts.find((item) => item.email === email);
  if (account) return account.active ? { email, role: account.role, active: true } : null;
  const member = state.members.find((item) => normalizeEmail(String(item.values[MEMBER_EMAIL_HEADER] ?? "")) === email);
  return member ? { email, role: "usuario" as const, active: true } : null;
}

function cellData(value: SheetValue, numeric = false) {
  if (typeof value === "boolean") return { userEnteredValue: { boolValue: value } };
  if (numeric && value !== "" && Number.isFinite(Number(value))) return { userEnteredValue: { numberValue: Number(value) } };
  return { userEnteredValue: { stringValue: cellText(value) } };
}

function memberCells(values: SheetValue[]) {
  const numericColumns = new Set([0, 1, 23, 28]);
  return values.map((value, index) => {
    if (index === 15 || index === 29) {
      const iso = index === 15 ? parseSheetDate(value) : cellText(value);
      const date = iso ? new Date(index === 15 ? `${iso}T12:00:00Z` : iso) : null;
      if (date && !Number.isNaN(date.getTime())) {
        return { userEnteredValue: { numberValue: date.getTime() / 86_400_000 + 25569 } };
      }
    }
    return cellData(value, numericColumns.has(index));
  });
}

function logRow(
  actor: { email: string; role: UserRole }, action: string, memberEmail: string, memberName: string,
  field: string, previousValue: SheetValue, nextValue: SheetValue,
) {
  return {
    values: [new Date().toISOString(), actor.email, actor.role, action, memberEmail, memberName, field, cellText(previousValue), cellText(nextValue)]
      .map((value) => cellData(value)),
  };
}

function baseRecord(values?: Record<string, MemberFieldValue>) {
  return Object.fromEntries(MEMBER_HEADERS.map((header) => [header, values?.[header] ?? ""])) as Record<MemberHeader, MemberFieldValue>;
}

function normalizeMemberValues(incoming: Record<string, MemberFieldValue>, existing?: Record<string, MemberFieldValue>) {
  const record = baseRecord(existing);
  for (const header of MEMBER_HEADERS) {
    if (SYSTEM_FIELDS.has(header) || !(header in incoming)) continue;
    record[header] = incoming[header];
  }
  record[MEMBER_EMAIL_HEADER] = normalizeEmail(String(record[MEMBER_EMAIL_HEADER] ?? ""));
  const booleanFields: MemberHeader[] = [
    "Confirmo asistencia al ciclo 2026 de Proyecto Puente",
    "Conozco el codigo de conducta de Proyecto Puente",
    "Posee Obra social",
  ];
  for (const field of booleanFields) {
    if (typeof record[field] === "boolean") record[field] = record[field] ? "Sí" : "No";
  }
  if (typeof record["Cuota Social"] === "boolean") {
    record["Cuota Social"] = record["Cuota Social"]
      ? "Estoy de acuerdo a abonar la cuota social antes del día 10 de cada mes"
      : "No puedo abonar la cuota social";
  }
  const birthday = parseSheetDate(record[MEMBER_BIRTHDAY_HEADER]);
  record[MEMBER_BIRTHDAY_HEADER] = birthday ?? "";
  const age = calculateAge(birthday);
  record[MEMBER_AGE_HEADER] = age === null ? "" : String(age);
  record["Marca temporal"] = new Date().toISOString();
  if (!cellText(record["Año de ingreso al Proyecto"])) record["Año de ingreso al Proyecto"] = String(new Date().getFullYear());
  return record;
}

function recordArray(record: Record<MemberHeader, MemberFieldValue>) {
  return MEMBER_HEADERS.map((header) => record[header] ?? "");
}

function requireWriteSheets(ids: Record<string, number>) {
  for (const title of ["Integrantes", "Configuracion", "Usuarios", "Baja", "LOG"]) {
    if (typeof ids[title] !== "number") throw new Error(`Falta la hoja ${title}.`);
  }
}

export async function createMember(incoming: Record<string, MemberFieldValue>, actor: { email: string; role: UserRole }) {
  const state = await managementState();
  const email = normalizeEmail(String(incoming[MEMBER_EMAIL_HEADER] ?? ""));
  const name = cellText(incoming[MEMBER_NAME_HEADER]);
  if (!email || !name) throw new Error("Nombre y email-puente son obligatorios.");
  requireInstitutionalEmail(email);
  if (state.members.some((member) => normalizeEmail(String(member.values[MEMBER_EMAIL_HEADER] ?? "")) === email)) {
    throw new Error("Ya existe un integrante con ese email-puente.");
  }
  const record = normalizeMemberValues(incoming);
  record["Numero de orden"] = String(Math.max(0, ...state.members.map((item) => Number(item.values["Numero de orden"]) || 0)) + 1);
  record["Numero de Matricula"] = String(Math.max(0, ...state.members.map((item) => Number(item.values["Numero de Matricula"]) || 0)) + 1);
  if (!record["Confirmo asistencia al ciclo 2026 de Proyecto Puente"]) record["Confirmo asistencia al ciclo 2026 de Proyecto Puente"] = "Sí";

  const ids = await sheetIds();
  requireWriteSheets(ids);
  const targetRowIndex = Math.max(1, state.rawMembers.length);
  const account = state.accounts.find((item) => item.email === email);
  const requests: Array<Record<string, unknown>> = [
    { updateCells: {
      range: { sheetId: ids.Integrantes, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 30, endColumnIndex: 31 },
      rows: [{ values: [cellData("Foto")] }], fields: "userEnteredValue",
    } },
    { copyPaste: {
      source: { sheetId: ids.Integrantes, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: MEMBER_HEADERS.length },
      destination: { sheetId: ids.Integrantes, startRowIndex: targetRowIndex, endRowIndex: targetRowIndex + 1, startColumnIndex: 0, endColumnIndex: MEMBER_HEADERS.length },
      pasteType: "PASTE_FORMAT", pasteOrientation: "NORMAL",
    } },
    { updateCells: {
      range: { sheetId: ids.Integrantes, startRowIndex: targetRowIndex, endRowIndex: targetRowIndex + 1, startColumnIndex: 0, endColumnIndex: MEMBER_HEADERS.length },
      rows: [{ values: memberCells(recordArray(record)) }], fields: "userEnteredValue",
    } },
  ];
  if (account) {
    requests.push({ updateCells: {
      range: { sheetId: ids.Usuarios, startRowIndex: account.rowNumber - 1, endRowIndex: account.rowNumber, startColumnIndex: 0, endColumnIndex: 6 },
      rows: [{ values: [email, name, account.role, true, new Date().toISOString(), actor.email].map((value) => cellData(value)) }],
      fields: "userEnteredValue",
    } });
  } else {
    requests.push({ appendCells: {
      sheetId: ids.Usuarios,
      rows: [{ values: [email, name, "usuario", true, new Date().toISOString(), actor.email].map((value) => cellData(value)) }],
      fields: "userEnteredValue",
    } });
  }
  requests.push({ appendCells: {
    sheetId: ids.LOG,
    rows: [logRow(actor, "ALTA", email, name, "Integrante", "", "Alta de integrante")],
    fields: "userEnteredValue",
  } });
  await writeRequests(requests);
  return memberRecord(recordArray(record), targetRowIndex - 1);
}

export async function updateMember(
  rowNumber: number, incoming: Record<string, MemberFieldValue>, actor: { email: string; role: UserRole },
) {
  const state = await managementState();
  const member = state.members.find((item) => item.rowNumber === rowNumber);
  if (!member) throw new Error("El integrante ya no existe o cambió de fila.");
  const record = normalizeMemberValues(incoming, member.values);
  if (actor.role !== "admin") record[MEMBER_EMAIL_HEADER] = member.values[MEMBER_EMAIL_HEADER];
  const next = recordArray(record);
  const previous = recordArray(member.values as Record<MemberHeader, MemberFieldValue>);
  const changes = MEMBER_HEADERS.flatMap((header, index) =>
    cellText(previous[index]) === cellText(next[index]) ? [] : [{ header, previous: previous[index], next: next[index] }],
  );
  if (!changes.length) return member;
  const ids = await sheetIds();
  requireWriteSheets(ids);
  const memberEmail = normalizeEmail(String(record[MEMBER_EMAIL_HEADER] ?? ""));
  const memberName = cellText(record[MEMBER_NAME_HEADER]);
  if (!memberEmail || !memberName) throw new Error("Nombre y email-puente son obligatorios.");
  requireInstitutionalEmail(memberEmail);
  const previousEmail = normalizeEmail(String(member.values[MEMBER_EMAIL_HEADER] ?? ""));
  if (memberEmail !== previousEmail && state.members.some((item) => item.rowNumber !== rowNumber && normalizeEmail(String(item.values[MEMBER_EMAIL_HEADER] ?? "")) === memberEmail)) {
    throw new Error("Ya existe otro integrante con ese email-puente.");
  }
  const account = state.accounts.find((item) => item.email === previousEmail);
  if (memberEmail !== previousEmail && state.accounts.some((item) => item.email === memberEmail && item.rowNumber !== account?.rowNumber)) {
    throw new Error("Ese email-puente ya está asignado a otra cuenta de la plataforma.");
  }
  const requests: Array<Record<string, unknown>> = [
    { updateCells: {
      range: { sheetId: ids.Integrantes, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 30, endColumnIndex: 31 },
      rows: [{ values: [cellData("Foto")] }], fields: "userEnteredValue",
    } },
    { updateCells: {
      range: { sheetId: ids.Integrantes, startRowIndex: rowNumber - 1, endRowIndex: rowNumber, startColumnIndex: 0, endColumnIndex: MEMBER_HEADERS.length },
      rows: [{ values: memberCells(next) }], fields: "userEnteredValue",
    } },
    { appendCells: {
      sheetId: ids.LOG,
      rows: changes.map((change) => logRow(actor, "MODIFICACION", memberEmail, memberName, change.header, change.previous, change.next)),
      fields: "userEnteredValue",
    } },
  ];
  if (memberEmail !== previousEmail || memberName !== cellText(member.values[MEMBER_NAME_HEADER])) {
    if (account) {
      requests.push({ updateCells: {
        range: { sheetId: ids.Usuarios, startRowIndex: account.rowNumber - 1, endRowIndex: account.rowNumber, startColumnIndex: 0, endColumnIndex: 6 },
        rows: [{ values: [memberEmail, memberName, account.role, account.active, new Date().toISOString(), actor.email].map((value) => cellData(value)) }],
        fields: "userEnteredValue",
      } });
    } else {
      requests.push({ appendCells: {
        sheetId: ids.Usuarios,
        rows: [{ values: [memberEmail, memberName, "usuario", true, new Date().toISOString(), actor.email].map((value) => cellData(value)) }],
        fields: "userEnteredValue",
      } });
    }
  }
  await writeRequests(requests);
  return memberRecord(next, rowNumber - 2);
}

export async function importMembers(
  incomingRows: Array<Record<string, MemberFieldValue>>,
  actor: { email: string; role: UserRole },
) {
  if (!incomingRows.length) throw new Error("El archivo no contiene integrantes para importar.");
  if (incomingRows.length > 100) throw new Error("Importá como máximo 100 integrantes por archivo.");
  const state = await managementState();
  const ids = await sheetIds();
  requireWriteSheets(ids);
  const membersByEmail = new Map(state.members.map((member) => [normalizeEmail(String(member.values[MEMBER_EMAIL_HEADER] ?? "")), member]));
  const accountsByEmail = new Map(state.accounts.map((account) => [account.email, account]));
  const processed = new Set<string>();
  const requests: Array<Record<string, unknown>> = [];
  const accountRows: Array<{ values: ReturnType<typeof cellData>[] }> = [];
  const auditRows: ReturnType<typeof logRow>[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let nextOrder = Math.max(0, ...state.members.map((item) => Number(item.values["Numero de orden"]) || 0));
  let nextMatricula = Math.max(0, ...state.members.map((item) => Number(item.values["Numero de Matricula"]) || 0));

  for (const incoming of incomingRows) {
    const email = normalizeEmail(String(incoming[MEMBER_EMAIL_HEADER] ?? ""));
    const name = cellText(incoming[MEMBER_NAME_HEADER]);
    if (!email || !name || processed.has(email)) { skipped += 1; continue; }
    try { requireInstitutionalEmail(email); } catch { skipped += 1; continue; }
    processed.add(email);
    const existing = membersByEmail.get(email);
    const record = normalizeMemberValues(incoming, existing?.values);
    record[MEMBER_EMAIL_HEADER] = email;
    record[MEMBER_NAME_HEADER] = name;
    if (!existing) {
      nextOrder += 1;
      nextMatricula += 1;
      record["Numero de orden"] = String(nextOrder);
      record["Numero de Matricula"] = String(nextMatricula);
      if (!record["Confirmo asistencia al ciclo 2026 de Proyecto Puente"]) record["Confirmo asistencia al ciclo 2026 de Proyecto Puente"] = "Sí";
      const targetRowIndex = Math.max(1, state.rawMembers.length + created);
      requests.push(
        { copyPaste: {
          source: { sheetId: ids.Integrantes, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: MEMBER_HEADERS.length },
          destination: { sheetId: ids.Integrantes, startRowIndex: targetRowIndex, endRowIndex: targetRowIndex + 1, startColumnIndex: 0, endColumnIndex: MEMBER_HEADERS.length },
          pasteType: "PASTE_FORMAT", pasteOrientation: "NORMAL",
        } },
        { updateCells: {
          range: { sheetId: ids.Integrantes, startRowIndex: targetRowIndex, endRowIndex: targetRowIndex + 1, startColumnIndex: 0, endColumnIndex: MEMBER_HEADERS.length },
          rows: [{ values: memberCells(recordArray(record)) }], fields: "userEnteredValue",
        } },
      );
      created += 1;
    } else {
      record["Numero de orden"] = existing.values["Numero de orden"];
      record["Numero de Matricula"] = existing.values["Numero de Matricula"];
      requests.push({ updateCells: {
        range: { sheetId: ids.Integrantes, startRowIndex: existing.rowNumber - 1, endRowIndex: existing.rowNumber, startColumnIndex: 0, endColumnIndex: MEMBER_HEADERS.length },
        rows: [{ values: memberCells(recordArray(record)) }], fields: "userEnteredValue",
      } });
      updated += 1;
    }
    const account = accountsByEmail.get(email);
    if (account) {
      requests.push({ updateCells: {
        range: { sheetId: ids.Usuarios, startRowIndex: account.rowNumber - 1, endRowIndex: account.rowNumber, startColumnIndex: 0, endColumnIndex: 6 },
        rows: [{ values: [email, name, account.role, true, new Date().toISOString(), actor.email].map((value) => cellData(value)) }],
        fields: "userEnteredValue",
      } });
    } else {
      accountRows.push({ values: [email, name, "usuario", true, new Date().toISOString(), actor.email].map((value) => cellData(value)) });
    }
    auditRows.push(logRow(actor, existing ? "IMPORTACION_EXCEL_ACTUALIZACION" : "IMPORTACION_EXCEL_ALTA", email, name, "Integrante", "", "Importado desde Excel"));
  }
  if (accountRows.length) requests.push({ appendCells: { sheetId: ids.Usuarios, rows: accountRows, fields: "userEnteredValue" } });
  if (auditRows.length) requests.push({ appendCells: { sheetId: ids.LOG, rows: auditRows, fields: "userEnteredValue" } });
  if (!created && !updated) throw new Error("No se encontró ninguna fila válida. Revisá nombre, email-puente y dominio institucional.");
  await writeRequests(requests);
  return { created, updated, skipped };
}

export async function deactivateMember(
  rowNumber: number, reason: string, actor: { email: string; role: UserRole },
) {
  const state = await managementState();
  const member = state.members.find((item) => item.rowNumber === rowNumber);
  if (!member) throw new Error("El integrante ya no existe o cambió de fila.");
  const ids = await sheetIds();
  requireWriteSheets(ids);
  const memberEmail = normalizeEmail(String(member.values[MEMBER_EMAIL_HEADER] ?? ""));
  const memberName = cellText(member.values[MEMBER_NAME_HEADER]);
  const account = state.accounts.find((item) => item.email === memberEmail);
  const bajaValues = [
    ...recordArray(member.values as Record<MemberHeader, MemberFieldValue>),
    new Date().toISOString(), reason.trim(), actor.email,
  ];
  const requests: Array<Record<string, unknown>> = [
    { appendCells: {
      sheetId: ids.Baja,
      rows: [{ values: bajaValues.map((value, index) => cellData(value, [0, 1, 23, 28].includes(index))) }],
      fields: "userEnteredValue",
    } },
    { deleteDimension: { range: { sheetId: ids.Integrantes, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber } } },
    { appendCells: {
      sheetId: ids.LOG, rows: [logRow(actor, "BAJA", memberEmail, memberName, "Motivo", "", reason.trim())], fields: "userEnteredValue",
    } },
  ];
  if (account) {
    requests.push({ updateCells: {
      range: { sheetId: ids.Usuarios, startRowIndex: account.rowNumber - 1, endRowIndex: account.rowNumber, startColumnIndex: 3, endColumnIndex: 6 },
      rows: [{ values: [false, new Date().toISOString(), actor.email].map((value) => cellData(value)) }],
      fields: "userEnteredValue",
    } });
  }
  await writeRequests(requests);
}

export async function updatePlatformAccount(
  emailValue: string, role: UserRole, active: boolean, actor: { email: string; role: UserRole },
) {
  const email = normalizeEmail(emailValue);
  const state = await managementState();
  const account = state.accounts.find((item) => item.email === email);
  if (!account) throw new Error("La cuenta no existe en la hoja Usuarios.");
  if (email === actor.email && (!active || role !== "admin")) throw new Error("No podés quitarte tu propio acceso de administrador.");
  if (configuredAdminEmails().has(email) && (!active || role !== "admin")) {
    throw new Error("La cuenta administradora inicial debe permanecer activa como recuperación.");
  }
  const ids = await sheetIds();
  requireWriteSheets(ids);
  await writeRequests([
    { updateCells: {
      range: { sheetId: ids.Usuarios, startRowIndex: account.rowNumber - 1, endRowIndex: account.rowNumber, startColumnIndex: 2, endColumnIndex: 6 },
      rows: [{ values: [role, active, new Date().toISOString(), actor.email].map((value) => cellData(value)) }],
      fields: "userEnteredValue",
    } },
    { appendCells: {
      sheetId: ids.LOG,
      rows: [
        logRow(actor, "ROL_USUARIO", email, account.name, "ROL", account.role, role),
        logRow(actor, "ESTADO_USUARIO", email, account.name, "ACTIVO", account.active, active),
      ],
      fields: "userEnteredValue",
    } },
  ]);
}

export async function addConfigItem(type: ConfigCategory, value: string, actor: { email: string; role: UserRole }) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) throw new Error("El valor no puede quedar vacío.");
  const state = await managementState();
  if (state.config.some((item) => item.type === type && normalizeHeader(item.value) === normalizeHeader(clean))) {
    throw new Error("La opción ya existe en esa categoría.");
  }
  const order = Math.max(0, ...state.config.filter((item) => item.type === type).map((item) => item.order)) + 1;
  const blankIndex = state.rawConfig.slice(1).findIndex((row) => !cellText(row[0]) && !cellText(row[1]));
  const rowNumber = blankIndex >= 0 ? blankIndex + 2 : Math.max(2, state.rawConfig.length + 1);
  const ids = await sheetIds();
  requireWriteSheets(ids);
  await writeRequests([
    { updateCells: {
      range: { sheetId: ids.Configuracion, startRowIndex: rowNumber - 1, endRowIndex: rowNumber, startColumnIndex: 0, endColumnIndex: 6 },
      rows: [{ values: [cellData(type), cellData(clean), cellData(true), cellData(order, true), cellData(new Date().toISOString()), cellData(actor.email)] }],
      fields: "userEnteredValue",
    } },
    { appendCells: {
      sheetId: ids.LOG, rows: [logRow(actor, "CONFIGURACION_ALTA", "", "Configuración", type, "", clean)], fields: "userEnteredValue",
    } },
  ]);
}

export async function setSocialFeeAmount(
  year: number,
  amount: number,
  actor: { email: string; role: UserRole },
) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("El año del valor de cuota no es válido.");
  if (!Number.isFinite(amount) || amount < 0) throw new Error("El valor de la cuota debe ser un importe igual o mayor que cero.");

  const roundedAmount = Math.round(amount * 100) / 100;
  const state = await managementState();
  const existing = state.config.find((item) => item.type === "VALOR_CUOTA" && item.order === year);
  const blankIndex = state.rawConfig.slice(1).findIndex((row) => !cellText(row[0]) && !cellText(row[1]));
  const rowNumber = existing?.rowNumber ?? (blankIndex >= 0 ? blankIndex + 2 : Math.max(2, state.rawConfig.length + 1));
  const ids = await sheetIds();
  if (typeof ids.Configuracion !== "number" || typeof ids.LOG !== "number") throw new Error("Falta la hoja Configuracion o LOG.");
  const now = new Date().toISOString();

  await writeRequests([
    { updateCells: {
      range: { sheetId: ids.Configuracion, startRowIndex: rowNumber - 1, endRowIndex: rowNumber, startColumnIndex: 0, endColumnIndex: 6 },
      rows: [{ values: [
        cellData("VALOR_CUOTA"),
        cellData(String(roundedAmount)),
        cellData(true),
        cellData(year, true),
        cellData(now),
        cellData(actor.email),
      ] }],
      fields: "userEnteredValue",
    } },
    { appendCells: {
      sheetId: ids.LOG,
      rows: [logRow(actor, existing ? "VALOR_CUOTA_MODIFICACION" : "VALOR_CUOTA_ALTA", "", "Configuración", `Cuota social ${year}`, existing?.value ?? "Sin configurar", roundedAmount)],
      fields: "userEnteredValue",
    } },
  ]);
  return { year, amount: roundedAmount };
}

export async function setBirthdayAutomationSettings(
  incoming: BirthdayAutomationSettings,
  actor: { email: string; role: UserRole },
) {
  const ccEmail = normalizeEmail(incoming.ccEmail);
  const calendarEmail = normalizeEmail(incoming.calendarEmail);
  const subjectTemplate = incoming.subjectTemplate.replace(/\s+/g, " ").trim();
  const messageTemplate = incoming.messageTemplate.trim();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!validEmail.test(ccEmail)) throw new Error("Ingresá una casilla válida para recibir la copia.");
  if (!validEmail.test(calendarEmail)) throw new Error("Ingresá una cuenta válida de Google Calendar.");
  if (subjectTemplate.length < 5 || subjectTemplate.length > 160) throw new Error("El asunto debe tener entre 5 y 160 caracteres.");
  if (messageTemplate.length < 20 || messageTemplate.length > 2000) throw new Error("El mensaje debe tener entre 20 y 2000 caracteres.");

  const settings: BirthdayAutomationSettings = {
    enabled: Boolean(incoming.enabled),
    ccEmail,
    calendarEmail,
    subjectTemplate,
    messageTemplate,
  };
  const state = await managementState();
  const ids = await sheetIds();
  requireWriteSheets(ids);
  let nextRowNumber = Math.max(2, state.rawConfig.length + 1);
  const entries: Array<{ type: ConfigCategory; value: string; active: boolean }> = [
    { type: "CUMPLEANOS_AUTOMATICO", value: "Saludo automático", active: settings.enabled },
    { type: "CUMPLEANOS_COPIA", value: settings.ccEmail, active: true },
    { type: "CUMPLEANOS_CALENDARIO", value: settings.calendarEmail, active: true },
    { type: "CUMPLEANOS_ASUNTO", value: settings.subjectTemplate, active: true },
    { type: "CUMPLEANOS_MENSAJE", value: settings.messageTemplate, active: true },
  ];
  const now = new Date().toISOString();
  const requests: Array<Record<string, unknown>> = entries.map((entry) => {
    const existing = state.config.find((item) => item.type === entry.type);
    const rowNumber = existing?.rowNumber ?? nextRowNumber++;
    return { updateCells: {
      range: { sheetId: ids.Configuracion, startRowIndex: rowNumber - 1, endRowIndex: rowNumber, startColumnIndex: 0, endColumnIndex: 6 },
      rows: [{ values: [
        cellData(entry.type),
        cellData(entry.value),
        cellData(entry.active),
        cellData(1, true),
        cellData(now),
        cellData(actor.email),
      ] }],
      fields: "userEnteredValue",
    } };
  });
  requests.push({ appendCells: {
    sheetId: ids.LOG,
    rows: [logRow(actor, "CONFIGURACION_CUMPLEANOS", "", "Configuración", "Saludo automático", "", settings.enabled ? "Activado" : "Desactivado")],
    fields: "userEnteredValue",
  } });
  await writeRequests(requests);
  return settings;
}

export async function setConfigItemActive(
  rowNumber: number, active: boolean, actor: { email: string; role: UserRole },
) {
  const state = await managementState();
  const item = state.config.find((entry) => entry.rowNumber === rowNumber);
  if (!item) throw new Error("La opción ya no existe.");
  if (item.type === "PANTALLA" && ["cumpleanios", "desempenos"].includes(item.value) && !active) {
    throw new Error("Cumpleaños y Desempeños deben permanecer visibles para todos los usuarios.");
  }
  if (item.type === "PANTALLA" && !active) {
    const visibleScreens = state.config.filter((entry) => entry.type === "PANTALLA" && entry.active);
    if (visibleScreens.length <= 1 && item.active) throw new Error("Los usuarios deben conservar al menos una pantalla visible.");
  }
  const ids = await sheetIds();
  requireWriteSheets(ids);
  await writeRequests([
    { updateCells: {
      range: { sheetId: ids.Configuracion, startRowIndex: rowNumber - 1, endRowIndex: rowNumber, startColumnIndex: 2, endColumnIndex: 3 },
      rows: [{ values: [cellData(active)] }], fields: "userEnteredValue",
    } },
    { appendCells: {
      sheetId: ids.LOG,
      rows: [logRow(actor, "CONFIGURACION_ESTADO", "", "Configuración", item.type, item.active, active)],
      fields: "userEnteredValue",
    } },
  ]);
}

function parseIntegrantes(rows: SheetRows): Integrante[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  const matriculaIndex = headerIndex(headers, ["Numero de Matricula", "Matrícula"], 1);
  const nombreIndex = headerIndex(headers, ["Apellidos y nombres", "Integrante"], 2);
  const emailIndex = headerIndex(headers, ["email-puente"], 4);
  const confirmadoIndex = headerIndex(headers, ["Confirmo asistencia al ciclo"], 5);
  const turnoIndex = headerIndex(headers, ["Horario en que asisto", "Turno"], 6);
  const nacimientoIndex = headerIndex(headers, ["Fecha de Nacimiento"], 15);
  const ingresoIndex = headerIndex(headers, ["Año de ingreso"], 28);
  const fotoIndex = headerIndex(headers, ["Foto"], 30);
  return rows.slice(1).flatMap((row, rowIndex) => {
    const nombre = cellText(row[nombreIndex]);
    if (!nombre) return [];
    const matricula = cellText(row[matriculaIndex]) || String(rowIndex + 1);
    const confirmado = normalizeHeader(row[confirmadoIndex]);
    return [{
      id: `integrante-${matricula}-${rowIndex + 2}`,
      matricula,
      nombre,
      email: normalizeEmail(cellText(row[emailIndex])),
      turno: cellText(row[turnoIndex]) || "Sin turno",
      anioIngreso: cellText(row[ingresoIndex]) || "—",
      estado: confirmado === "si" || confirmado.startsWith("si ") ? "Activo" : "Pendiente",
      fechaNacimiento: parseSheetDate(row[nacimientoIndex]),
      foto: cellText(row[fotoIndex]),
    } satisfies Integrante];
  });
}

function parseAsistencias(rows: SheetRows): Asistencia[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  const nombreIndex = headerIndex(headers, ["Apellido y Nombres", "Integrante"], 3);
  const fechaIndex = headerIndex(headers, ["Fecha de la ASISTENCIA", "Fecha asistencia"], 4);
  const timestampIndex = headerIndex(headers, ["Marca temporal"], 0);
  const asistioIndex = headerIndex(headers, ["Asisti a las actividades", "Asistencia"], 7);
  const motivoIndex = headerIndex(headers, ["Motivo de falta"], 2);
  const turnoIndex = headerIndex(headers, ["Turno"], 8);
  return rows.slice(1).flatMap((row, rowIndex) => {
    const nombre = cellText(row[nombreIndex]);
    if (!nombre) return [];
    const estado = normalizeHeader(row[asistioIndex] || row[7]);
    return [{
      id: `asistencia-${rowIndex + 2}`,
      nombre,
      fecha: parseSheetDate(row[fechaIndex] || row[timestampIndex]),
      asistio: estado.includes("si") && !estado.includes("no"),
      turno: cellText(row[turnoIndex]) || "Sin turno",
      motivo: cellText(row[motivoIndex]),
    } satisfies Asistencia];
  });
}

function parseScoring(rows: SheetRows) {
  if (rows.length < 5) {
    return { categorias: [] as string[], registros: 0, columnas: [] as ScoringColumn[], integrantes: [] as ScoringMember[] };
  }
  const areaRow = rows[0] ?? [];
  const monthRow = rows[1] ?? [];
  const taskRow = rows[2] ?? [];
  const headerRow = rows[3] ?? [];
  const columnas: ScoringColumn[] = [];
  let currentArea = "Evaluación";
  let finalIndex = -1;

  for (let column = 2; column < Math.max(...rows.slice(0, 4).map((row) => row.length)); column += 1) {
    const header = normalizeHeader(headerRow[column]);
    if (header === "final") {
      finalIndex = column;
      continue;
    }
    if (!header.includes("calificacion")) continue;
    const explicitArea = cellText(areaRow[column]) || cellText(areaRow[column + 1]);
    if (explicitArea) currentArea = explicitArea;
    const mes = cellText(monthRow[column]) || cellText(monthRow[column + 1]) || "Sin mes";
    const tarea = cellText(taskRow[column]) || cellText(taskRow[column + 1]) || "Sin tarea";
    columnas.push({
      id: `scoring-${column}`,
      area: currentArea,
      mes,
      tarea,
      scoreColumn: column,
      observationColumn: column + 1,
    });
  }

  const integrantes = rows.slice(4).flatMap((row, index) => {
    const nombre = cellText(row[0]);
    if (!nombre) return [];
    return [{
      id: `scoring-integrante-${index + 5}`,
      rowNumber: index + 5,
      nombre,
      turno: cellText(row[1]) || "—",
      resultados: columnas.map((column) => {
        const scoreIndex = column.scoreColumn;
        const scoreValue = Number(row[scoreIndex]);
        return {
          columnId: column.id,
          calificacion: Number.isFinite(scoreValue) && cellText(row[scoreIndex]) !== "" ? scoreValue : null,
          observacion: cellText(row[scoreIndex + 1]),
        };
      }),
      final: finalIndex >= 0 ? cellText(row[finalIndex]) : "",
      finalColumn: finalIndex,
    } satisfies ScoringMember];
  });
  const categorias = [...new Set(columnas.map((column) => column.area).filter(Boolean))];
  return { categorias, registros: integrantes.length, columnas, integrantes };
}

export function hasGoogleSheetsConfig() {
  return Boolean(
    process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      (process.env.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY_BASE64),
  );
}

export async function readGoogleSheetsData() {
  const payload = await readRanges(SHEET_RANGES);
  const ranges = payload.valueRanges ?? [];
  const integrantes = parseIntegrantes(ranges[0]?.values ?? []);
  const turnosPorNombre = new Map(integrantes.map((item) => [normalizeHeader(item.nombre), item.turno]));
  const asistencias = parseAsistencias(ranges[2]?.values ?? []).map((item) => ({
    ...item,
    turno: item.turno === "Sin turno" ? turnosPorNombre.get(normalizeHeader(item.nombre)) ?? item.turno : item.turno,
  }));
  const scoring = parseScoring(ranges[3]?.values ?? []);
  const scoringHistory = parseScoringHistory(ranges[6]?.values ?? []);
  const cuotas = parseSocialFees(ranges[5]?.values ?? []);
  const emailByName = new Map<string, string>();
  const seenNames = new Set<string>();
  for (const member of integrantes) {
    const name = normalizeHeader(member.nombre);
    if (seenNames.has(name)) {
      emailByName.delete(name);
    } else if (member.email) {
      emailByName.set(name, member.email);
    }
    seenNames.add(name);
  }
  const normalizedCuotas = cuotas.map((item) => ({
    ...item,
    email: item.email || emailByName.get(normalizeHeader(item.name)) || "",
  }));
  const allowedScreens = new Set<UserScreen>(["inicio", "convivencia", "integrantes", "asistencia", "cumpleanios", "cuota", "reportes"]);
  const config = parseConfig(ranges[4]?.values ?? []);
  const configuredScreens = config
    .filter((item) => item.type === "PANTALLA" && item.active && allowedScreens.has(item.value as UserScreen))
    .sort((a, b) => a.order - b.order)
    .map((item) => item.value as UserScreen);
  return {
    integrantes,
    asistencias,
    cuotas: normalizedCuotas,
    habilidades: scoring,
    scoringHistory: scoringHistory.map((record) => ({
      ...record,
      email: record.email || emailByName.get(normalizeHeader(record.name)) || "",
    })),
    scoringTopics: config
      .filter((item) => item.type === "TEMA_SCORING" && item.active)
      .sort((a, b) => a.order - b.order)
      .map((item) => item.value),
    userScreens: configuredScreens.length ? configuredScreens : [...allowedScreens],
  };
}

type SocialFeeUpdate = {
  email: string;
  year: number;
  month: number;
  status: SocialFeeStatus;
};

export async function updateSocialFees(
  incomingUpdates: SocialFeeUpdate[],
  actor: { email: string; role: UserRole },
) {
  if (!incomingUpdates.length) throw new Error("No se seleccionaron cuotas para actualizar.");
  if (incomingUpdates.length > 1000) throw new Error("Podés actualizar hasta 1000 cuotas por operación.");

  const snapshot = await readSocialFeeSnapshot();
  if (actor.role !== "admin" && !snapshot.canUsersSelfReport) {
    throw new Error("La carga de cuotas por usuarios está deshabilitada en Configuración.");
  }

  const membersByEmail = new Map(snapshot.members.map((member) => [member.email, member]));
  const recordsByKey = new Map(snapshot.records.map((record) => [`${record.email}|${record.year}|${record.month}`, record]));
  const recordsByNameKey = new Map(snapshot.records.map((record) => [`${normalizeHeader(record.name)}|${record.year}|${record.month}`, record]));
  const ids = await sheetIds();
  if (typeof ids.Cuotas !== "number" || typeof ids.LOG !== "number") throw new Error("Falta la hoja Cuotas o LOG.");

  const seen = new Set<string>();
  const requests: Array<Record<string, unknown>> = [];
  const appendedRows: Array<{ values: ReturnType<typeof cellData>[] }> = [];
  const auditRows: ReturnType<typeof logRow>[] = [];
  const now = new Date().toISOString();
  let updated = 0;

  for (const incoming of incomingUpdates) {
    const email = normalizeEmail(incoming.email);
    const member = membersByEmail.get(email);
    if (!member) throw new Error(`No se encontró un integrante activo para ${email || "el email indicado"}.`);
    if (!Number.isInteger(incoming.year) || incoming.year < 2000 || incoming.year > 2100) throw new Error("El año de la cuota no es válido.");
    if (!Number.isInteger(incoming.month) || incoming.month < 1 || incoming.month > 12) throw new Error("El mes de la cuota no es válido.");
    if (!SOCIAL_FEE_STATUSES.includes(incoming.status)) throw new Error("El estado de la cuota no es válido.");
    if (actor.role !== "admin" && (email !== actor.email || incoming.status !== "P")) {
      throw new Error("Los usuarios sólo pueden informar su propia cuota como pagada.");
    }

    const key = `${email}|${incoming.year}|${incoming.month}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const existing = recordsByKey.get(key) ?? recordsByNameKey.get(`${normalizeHeader(member.name)}|${incoming.year}|${incoming.month}`);
    const previousStatus = existing?.status ?? "";
    if (previousStatus === incoming.status && existing?.email === email) continue;
    const paidAt = incoming.status === "P" ? existing?.paidAt || now : "";
    const values: SheetValue[] = [
      existing?.id || crypto.randomUUID(),
      incoming.year,
      SOCIAL_FEE_MONTHS[incoming.month - 1],
      incoming.month,
      email,
      member.name,
      incoming.status,
      paidAt,
      now,
      actor.email,
    ];
    if (existing) {
      requests.push({ updateCells: {
        range: {
          sheetId: ids.Cuotas,
          startRowIndex: existing.rowNumber - 1,
          endRowIndex: existing.rowNumber,
          startColumnIndex: 0,
          endColumnIndex: 10,
        },
        rows: [{ values: values.map((value, index) => cellData(value, index === 1 || index === 3)) }],
        fields: "userEnteredValue",
      } });
    } else {
      appendedRows.push({ values: values.map((value, index) => cellData(value, index === 1 || index === 3)) });
    }
    auditRows.push(logRow(
      actor,
      incomingUpdates.length > 1 ? "CUOTA_CARGA_MASIVA" : "CUOTA_MODIFICACION",
      email,
      member.name,
      `Cuota ${SOCIAL_FEE_MONTHS[incoming.month - 1]} ${incoming.year}`,
      previousStatus || "Sin cargar",
      incoming.status || "Sin cargar",
    ));
    updated += 1;
  }

  if (!updated) return { updated: 0 };
  if (appendedRows.length) requests.push({ appendCells: { sheetId: ids.Cuotas, rows: appendedRows, fields: "userEnteredValue" } });
  requests.push({ appendCells: { sheetId: ids.LOG, rows: auditRows, fields: "userEnteredValue" } });
  await writeRequests(requests);
  return { updated };
}

export async function updateScoringMember(
  rowNumber: number,
  updates: Array<{ columnId: string; calificacion: number | null; observacion: string }>,
  final: string,
  actor: { email: string; role: UserRole },
) {
  const payload = await readRanges(["scoring!A1:AA1000"]);
  const scoring = parseScoring(payload.valueRanges?.[0]?.values ?? []);
  const member = scoring.integrantes.find((item) => item.rowNumber === rowNumber);
  if (!member) throw new Error("El integrante ya no existe en la hoja scoring.");
  const ids = await sheetIds();
  if (typeof ids.scoring !== "number" || typeof ids.LOG !== "number") throw new Error("Falta la hoja scoring o LOG.");
  const requests: Array<Record<string, unknown>> = [];
  const auditRows: ReturnType<typeof logRow>[] = [];

  for (const update of updates) {
    const column = scoring.columnas.find((item) => item.id === update.columnId);
    if (!column) throw new Error("Una columna del scoring ya no existe.");
    if (update.calificacion !== null && (!Number.isFinite(update.calificacion) || update.calificacion < 0 || update.calificacion > 10)) {
      throw new Error("Las calificaciones deben estar entre 0 y 10.");
    }
    const observation = update.observacion.replace(/\s+/g, " ").trim().slice(0, 500);
    const previous = member.resultados.find((item) => item.columnId === column.id);
    const previousText = `${previous?.calificacion ?? ""} | ${previous?.observacion ?? ""}`;
    const nextText = `${update.calificacion ?? ""} | ${observation}`;
    if (previousText === nextText) continue;
    requests.push({ updateCells: {
      range: {
        sheetId: ids.scoring,
        startRowIndex: rowNumber - 1,
        endRowIndex: rowNumber,
        startColumnIndex: column.scoreColumn,
        endColumnIndex: column.observationColumn + 1,
      },
      rows: [{ values: [cellData(update.calificacion ?? "", true), cellData(observation)] }],
      fields: "userEnteredValue",
    } });
    auditRows.push(logRow(actor, "SCORING_MODIFICACION", "", member.nombre, `${column.mes} · ${column.tarea}`, previousText, nextText));
  }

  const cleanFinal = final.replace(/\s+/g, " ").trim().slice(0, 100);
  if (member.finalColumn >= 0 && cleanFinal !== member.final) {
    requests.push({ updateCells: {
      range: {
        sheetId: ids.scoring,
        startRowIndex: rowNumber - 1,
        endRowIndex: rowNumber,
        startColumnIndex: member.finalColumn,
        endColumnIndex: member.finalColumn + 1,
      },
      rows: [{ values: [cellData(cleanFinal, true)] }],
      fields: "userEnteredValue",
    } });
    auditRows.push(logRow(actor, "SCORING_MODIFICACION", "", member.nombre, "FINAL", member.final, cleanFinal));
  }
  if (!requests.length) return;
  requests.push({ appendCells: { sheetId: ids.LOG, rows: auditRows, fields: "userEnteredValue" } });
  await writeRequests(requests);
}

export async function updateScoringHistory(
  memberId: string,
  year: number,
  month: number,
  entries: Array<{ topic: string; score: number | null; observation: string }>,
  actor: { email: string; role: UserRole },
) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("El año del scoring no es válido.");
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("El mes del scoring no es válido.");
  if (!entries.length || entries.length > 100) throw new Error("No se enviaron temas para guardar.");

  const snapshot = await scoringState();
  const member = snapshot.members.find((item) => item.id === memberId);
  if (!member) throw new Error("El integrante ya no está activo o fue dado de baja.");
  const activeTopics = new Map(snapshot.topics.map((topic) => [normalizeHeader(topic), topic]));
  const ids = await sheetIds();
  if (typeof ids["Scoring Historial"] !== "number" || typeof ids.LOG !== "number") {
    throw new Error("Falta la hoja Scoring Historial o LOG.");
  }

  const memberKey = member.email || normalizeHeader(member.name);
  const existingByKey = new Map<string, ScoringHistoryRecord>();
  for (const record of snapshot.records) {
    const recordMemberKey = record.email || normalizeHeader(record.name);
    if (recordMemberKey !== memberKey) continue;
    existingByKey.set(`${record.year}|${record.month}|${normalizeHeader(record.topic)}`, record);
  }

  const blankRows = snapshot.rawHistory.slice(1).flatMap((row, index) =>
    row.every((value) => cellText(value) === "") ? [index + 2] : [],
  );
  let nextRowNumber = Math.max(2, snapshot.rawHistory.length + 1);
  const takeRowNumber = () => blankRows.shift() ?? nextRowNumber++;
  const requests: Array<Record<string, unknown>> = [];
  const auditRows: ReturnType<typeof logRow>[] = [];
  const now = new Date().toISOString();
  let updated = 0;

  for (const entry of entries) {
    const topicKey = normalizeHeader(entry.topic);
    const configuredTopic = activeTopics.get(topicKey);
    if (!configuredTopic) throw new Error(`El tema ${entry.topic || "indicado"} no está activo en Configuración.`);
    if (entry.score !== null && (!Number.isFinite(entry.score) || entry.score < 0 || entry.score > 10)) {
      throw new Error("Las calificaciones deben estar entre 0 y 10.");
    }
    const observation = entry.observation.replace(/\s+/g, " ").trim().slice(0, 500);
    const existing = existingByKey.get(`${year}|${month}|${topicKey}`);
    if (!existing && entry.score === null && !observation) continue;
    if (existing && existing.score === entry.score && existing.observation === observation) continue;

    const rowNumber = existing?.rowNumber ?? takeRowNumber();
    const values: SheetValue[] = [
      existing?.id || crypto.randomUUID(),
      year,
      month,
      member.email,
      member.name,
      configuredTopic,
      entry.score ?? "",
      observation,
      now,
      actor.email,
    ];
    requests.push({ updateCells: {
      range: {
        sheetId: ids["Scoring Historial"],
        startRowIndex: rowNumber - 1,
        endRowIndex: rowNumber,
        startColumnIndex: 0,
        endColumnIndex: 10,
      },
      rows: [{ values: values.map((value, index) => cellData(value, index === 1 || index === 2 || index === 6)) }],
      fields: "userEnteredValue",
    } });
    auditRows.push(logRow(
      actor,
      existing ? "SCORING_HISTORIAL_MODIFICACION" : "SCORING_HISTORIAL_ALTA",
      member.email,
      member.name,
      `${SOCIAL_FEE_MONTHS[month - 1]} ${year} · ${configuredTopic}`,
      existing ? `${existing.score ?? ""} | ${existing.observation}` : "",
      `${entry.score ?? ""} | ${observation}`,
    ));
    updated += 1;
  }

  if (!updated) return { updated: 0 };
  requests.push({ appendCells: { sheetId: ids.LOG, rows: auditRows, fields: "userEnteredValue" } });
  await writeRequests(requests);
  return { updated };
}

export async function readPerformanceComments(emailValue?: string, yearValue?: number) {
  const email = normalizeEmail(emailValue);
  const payload = await readRanges(["Desempeños!A1:H2000"]);
  const rows = payload.valueRanges?.[0]?.values ?? [];
  return rows.slice(1).flatMap((row) => {
    const createdYear = Number(cellText(row[1]).slice(0, 4)) || new Date().getFullYear();
    const item: PerformanceComment = {
      id: cellText(row[0]),
      fecha: cellText(row[1]),
      emailIntegrante: normalizeEmail(cellText(row[2])),
      integrante: cellText(row[3]),
      comentario: cellText(row[4]),
      creadoPor: normalizeEmail(cellText(row[5])),
      rolAutor: normalizeHeader(row[6]) === "admin" ? "admin" : "usuario",
      anio: Number(row[7]) || createdYear,
    };
    if (!item.id || !item.comentario || (email && item.emailIntegrante !== email) || (yearValue && item.anio !== yearValue)) return [];
    return [item];
  }).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export async function addPerformanceComment(
  emailValue: string,
  commentValue: string,
  yearValue: number,
  actor: { email: string; role: UserRole },
) {
  const email = normalizeEmail(emailValue);
  const comment = commentValue.replace(/\s+/g, " ").trim();
  if (!email || !comment) throw new Error("Elegí un integrante y escribí un comentario.");
  if (comment.length > 1500) throw new Error("El comentario puede tener hasta 1500 caracteres.");
  if (!Number.isInteger(yearValue) || yearValue < 2000 || yearValue > 2100) throw new Error("El año del desempeño no es válido.");
  const state = await managementState();
  const member = state.members.find((item) => normalizeEmail(String(item.values[MEMBER_EMAIL_HEADER] ?? "")) === email);
  if (!member) throw new Error("El integrante no existe en la hoja Integrantes.");
  const name = cellText(member.values[MEMBER_NAME_HEADER]);
  const ids = await sheetIds();
  if (typeof ids["Desempeños"] !== "number" || typeof ids.LOG !== "number") throw new Error("Falta la hoja Desempeños o LOG.");
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await writeRequests([
    { appendCells: {
      sheetId: ids["Desempeños"],
      rows: [{ values: [id, now, email, name, comment, actor.email, actor.role, yearValue].map((value, index) => cellData(value, index === 7)) }],
      fields: "userEnteredValue",
    } },
    { appendCells: {
      sheetId: ids.LOG,
      rows: [logRow(actor, "DESEMPENO_COMENTARIO", email, name, `Comentario ${yearValue}`, "", comment)],
      fields: "userEnteredValue",
    } },
  ]);
  return { id, fecha: now, emailIntegrante: email, integrante: name, comentario: comment, creadoPor: actor.email, rolAutor: actor.role, anio: yearValue } satisfies PerformanceComment;
}

const CODE_OF_CONDUCT_SHEET = "Aceptaciones Codigo";
const CODE_OF_CONDUCT_FILE_ID = process.env.GOOGLE_DRIVE_CONDUCT_CODE_FILE_ID?.trim() || "1MdWwVC43y7fk2SG4Gaw-FiqHNSgFDEGY";
const CODE_OF_CONDUCT_REVISION = "2026";
const CODE_OF_CONDUCT_DATE = "08-02-2026";
const CODE_OF_CONDUCT_START_YEAR = 2026;
const CODE_OF_CONDUCT_DEFAULT_NAME = "COD CONVIVENCIA 2026 .docx";
const CODE_OF_CONDUCT_HEADERS = [
  "ID",
  "Email",
  "Integrante",
  "DNI",
  "Rol",
  "Documento",
  "Version",
  "DriveModifiedTime",
  "FechaAceptacion",
  "AceptoCodigo",
  "AceptoImagenes",
  "AceptoCuota",
  "MotivoCuotaNo",
  "RequiereFirmaTutor",
  "AnioAceptacion",
] as const;

type CodeOfConductDocument = {
  fileId: string;
  name: string;
  revision: string;
  documentDate: string;
  modifiedTime: string;
  html: string;
  viewUrl: string;
};

function currentAcceptanceYear() {
  return new Date().getFullYear();
}

async function ensureCodeOfConductSheet() {
  let ids = await sheetIds();
  if (typeof ids[CODE_OF_CONDUCT_SHEET] !== "number") {
    await writeRequests([{
      addSheet: {
        properties: {
          title: CODE_OF_CONDUCT_SHEET,
          gridProperties: { rowCount: 5000, columnCount: CODE_OF_CONDUCT_HEADERS.length, frozenRowCount: 1 },
        },
      },
    }]);
    globalGoogleCache.__proyectoPuenteSheetIds = undefined;
    ids = await sheetIds();
  }

  const sheetId = ids[CODE_OF_CONDUCT_SHEET];
  if (typeof sheetId !== "number") throw new Error("No se pudo crear la hoja de aceptaciones del Código de Convivencia.");

  await writeRequests([
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { columnCount: CODE_OF_CONDUCT_HEADERS.length } },
        fields: "gridProperties.columnCount",
      },
    },
    {
      updateCells: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: CODE_OF_CONDUCT_HEADERS.length,
        },
        rows: [{ values: CODE_OF_CONDUCT_HEADERS.map((value) => cellData(value)) }],
        fields: "userEnteredValue",
      },
    },
  ]);
  return sheetId;
}

function zipEntry(bytes: Uint8Array, wantedName: string) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minOffset = Math.max(0, bytes.byteLength - 65_557);
  let eocd = -1;
  for (let offset = bytes.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error("El archivo Word no contiene un ZIP válido.");

  const entries = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();

  for (let index = 0; index < entries; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) break;
    const compression = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));

    if (name === wantedName) {
      if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("El documento Word está dañado.");
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
      if (compression === 0) return compressed;
      if (compression === 8) return new Uint8Array(inflateRawSync(compressed));
      throw new Error("El documento Word usa una compresión no compatible.");
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error("No se encontró el contenido principal dentro del archivo Word.");
}

function xmlText(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function htmlText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paragraphRunHtml(paragraphXml: string) {
  const runs = [...paragraphXml.matchAll(/<w:r\b[\s\S]*?<\/w:r>/g)];
  if (!runs.length) {
    return [...paragraphXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map((match) => htmlText(xmlText(match[1] ?? "")))
      .join("");
  }
  return runs.map((match) => {
    const run = match[0];
    let text = "";
    const tokens = run.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>/g);
    for (const token of tokens) {
      if (token[1] !== undefined) text += htmlText(xmlText(token[1]));
      else if (token[0].startsWith("<w:tab")) text += "&emsp;";
      else text += "<br />";
    }
    if (!text) return "";
    if (/<w:u\b/.test(run)) text = "<u>" + text + "</u>";
    if (/<w:i\b/.test(run)) text = "<em>" + text + "</em>";
    if (/<w:b\b/.test(run)) text = "<strong>" + text + "</strong>";
    return text;
  }).join("");
}

function paragraphPlainText(paragraphXml: string) {
  return [...paragraphXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => xmlText(match[1] ?? ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function docxToHtml(bytes: Uint8Array) {
  const xml = new TextDecoder("utf-8").decode(zipEntry(bytes, "word/document.xml"));
  const paragraphs = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((match) => match[0]);
  const output: string[] = [];
  let listOpen = false;

  const closeList = () => {
    if (listOpen) {
      output.push("</ul>");
      listOpen = false;
    }
  };

  for (const paragraph of paragraphs) {
    const plain = paragraphPlainText(paragraph);
    if (!plain) continue;
    const runHtml = paragraphRunHtml(paragraph) || htmlText(plain);
    const isList = /<w:numPr\b/.test(paragraph);

    if (isList) {
      if (!listOpen) {
        output.push("<ul>");
        listOpen = true;
      }
      output.push("<li>" + runHtml + "</li>");
      continue;
    }

    closeList();
    if (/^NORMAS DE CONVIVENCIA Y C[ÓO]DIGO DE CONDUCTA$/i.test(plain)) {
      output.push("<h1>" + runHtml + "</h1>");
    } else if (/^\d{1,2}\.\s+/.test(plain)) {
      output.push("<h2>" + runHtml + "</h2>");
    } else if (/^Proyecto Puente\s*[–-]\s*Revisi[oó]n/i.test(plain)) {
      output.push("<p><strong>" + runHtml + "</strong></p>");
    } else {
      output.push("<p>" + runHtml + "</p>");
    }
  }
  closeList();
  return output.join("\n");
}

async function readCodeOfConductDocument(includeHtml = true): Promise<CodeOfConductDocument> {
  const token = await getGoogleAccessToken();
  const fields = encodeURIComponent("id,name,mimeType,modifiedTime,webViewLink");
  const metadataResponse = await fetch(
    "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(CODE_OF_CONDUCT_FILE_ID) + "?fields=" + fields + "&supportsAllDrives=true",
    { headers: { authorization: "Bearer " + token }, cache: "no-store" },
  );
  if (!metadataResponse.ok) throw new Error("No se pudo leer el Código de Convivencia desde Google Drive.");
  const metadata = await metadataResponse.json() as { name?: string; modifiedTime?: string; webViewLink?: string };

  let html = "";
  if (includeHtml) {
    const contentResponse = await fetch(
      "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(CODE_OF_CONDUCT_FILE_ID) + "?alt=media&supportsAllDrives=true",
      { headers: { authorization: "Bearer " + token }, cache: "no-store" },
    );
    if (!contentResponse.ok) throw new Error("No se pudo descargar el contenido vigente del Código de Convivencia.");
    html = docxToHtml(new Uint8Array(await contentResponse.arrayBuffer()));
    if (!html.trim()) throw new Error("El Código de Convivencia no contiene texto legible.");
  }

  return {
    fileId: CODE_OF_CONDUCT_FILE_ID,
    name: metadata.name || CODE_OF_CONDUCT_DEFAULT_NAME,
    revision: CODE_OF_CONDUCT_REVISION,
    documentDate: CODE_OF_CONDUCT_DATE,
    modifiedTime: metadata.modifiedTime || "",
    html,
    viewUrl: metadata.webViewLink || "https://drive.google.com/file/d/" + CODE_OF_CONDUCT_FILE_ID + "/view",
  };
}

function acceptanceYearFromRow(row: SheetValue[]) {
  const explicit = Number(row[14]);
  if (Number.isInteger(explicit) && explicit >= CODE_OF_CONDUCT_START_YEAR && explicit <= 2100) return explicit;
  const acceptedAt = cellText(row[8]);
  const inferred = Number(acceptedAt.slice(0, 4));
  return Number.isInteger(inferred) && inferred >= CODE_OF_CONDUCT_START_YEAR ? inferred : CODE_OF_CONDUCT_START_YEAR;
}

function parseCodeOfConductAcceptances(rows: SheetRows): CodeOfConductAcceptance[] {
  return rows.slice(1).flatMap((row) => {
    const id = cellText(row[0]);
    const email = normalizeEmail(cellText(row[1]));
    const name = cellText(row[2]);
    if (!id || !email || !name) return [];
    const roleValue = normalizeHeader(row[4]);
    const role: UserRole = roleValue === "admin" ? "admin" : roleValue === "capacitador" ? "capacitador" : "usuario";
    return [{
      id,
      email,
      name,
      dni: cellText(row[3]),
      role,
      documentName: cellText(row[5]) || CODE_OF_CONDUCT_DEFAULT_NAME,
      revision: cellText(row[6]) || CODE_OF_CONDUCT_REVISION,
      driveModifiedTime: cellText(row[7]),
      acceptedAt: cellText(row[8]),
      acceptanceYear: acceptanceYearFromRow(row),
      acceptsCode: parseBoolean(row[9]),
      acceptsImages: parseBoolean(row[10]),
      acceptsFee: parseBoolean(row[11]),
      feeReason: cellText(row[12]),
      requiresTutorSignature: parseBoolean(row[13]),
    } satisfies CodeOfConductAcceptance];
  }).sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt));
}

async function readCodeOfConductRows() {
  await ensureCodeOfConductSheet();
  const payload = await readRanges(["'" + CODE_OF_CONDUCT_SHEET + "'!A1:O5000"]);
  return parseCodeOfConductAcceptances(payload.valueRanges?.[0]?.values ?? []);
}

function isCurrentCodeAcceptance(record: CodeOfConductAcceptance, document: CodeOfConductDocument, year = currentAcceptanceYear()) {
  if (!record.acceptsCode || record.acceptanceYear !== year) return false;
  if (document.modifiedTime) return record.driveModifiedTime === document.modifiedTime;
  return record.revision === document.revision;
}

function platformUsersForCode(state: ManagementState) {
  const people = new Map<string, { email: string; name: string; role: UserRole }>();
  for (const member of state.members) {
    const email = normalizeEmail(String(member.values[MEMBER_EMAIL_HEADER] ?? ""));
    const name = cellText(member.values[MEMBER_NAME_HEADER]);
    if (!email) continue;
    people.set(email, { email, name: name || email, role: "usuario" });
  }
  for (const account of state.accounts) {
    if (!account.active) continue;
    const current = people.get(account.email);
    people.set(account.email, {
      email: account.email,
      name: account.name || current?.name || account.email,
      role: account.role,
    });
  }
  for (const email of configuredAdminEmails()) {
    const current = people.get(email);
    people.set(email, { email, name: current?.name || email, role: "admin" });
  }
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

function acceptanceYears(records: CodeOfConductAcceptance[]) {
  const currentYear = currentAcceptanceYear();
  const years = new Set<number>();
  for (let year = CODE_OF_CONDUCT_START_YEAR; year <= currentYear; year += 1) years.add(year);
  for (const record of records) years.add(record.acceptanceYear);
  return [...years].filter((year) => year >= CODE_OF_CONDUCT_START_YEAR && year <= 2100).sort((a, b) => b - a);
}

export async function readCodeOfConductSnapshot(
  viewer: { email: string; role: UserRole },
  requestedYear = currentAcceptanceYear(),
) {
  const [document, state, records] = await Promise.all([
    readCodeOfConductDocument(true),
    managementState(),
    readCodeOfConductRows(),
  ]);
  const currentYear = currentAcceptanceYear();
  const selectedYear = Number.isInteger(requestedYear) && requestedYear >= CODE_OF_CONDUCT_START_YEAR && requestedYear <= 2100
    ? requestedYear
    : currentYear;
  const viewerEmail = normalizeEmail(viewer.email);
  const ownRecords = records.filter((record) => record.email === viewerEmail);
  const acceptance = ownRecords.find((record) => isCurrentCodeAcceptance(record, document, currentYear)) ?? null;
  const previousAcceptance = ownRecords.find((record) =>
    record.acceptanceYear === currentYear && !isCurrentCodeAcceptance(record, document, currentYear),
  ) ?? ownRecords.find((record) => record.acceptanceYear < currentYear) ?? null;

  let admin: {
    selectedYear: number;
    years: number[];
    summary: { total: number; accepted: number; pending: number; outdated: number };
    users: CodeOfConductUserStatus[];
  } | null = null;

  if (viewer.role === "admin") {
    const users = platformUsersForCode(state).map((person) => {
      const yearRecords = records.filter((record) => record.email === person.email && record.acceptanceYear === selectedYear);
      const current = selectedYear === currentYear
        ? yearRecords.find((record) => isCurrentCodeAcceptance(record, document, selectedYear))
        : yearRecords.find((record) => record.acceptsCode);
      const latest = current ?? yearRecords[0];
      const outdated = selectedYear === currentYear && Boolean(latest) && !current;
      return {
        email: person.email,
        name: person.name,
        role: person.role,
        status: current ? "accepted" : outdated ? "outdated" : "pending",
        acceptedAt: latest?.acceptedAt ?? "",
        dni: latest?.dni ?? "",
        requiresTutorSignature: latest?.requiresTutorSignature ?? false,
      } satisfies CodeOfConductUserStatus;
    });
    const accepted = users.filter((item) => item.status === "accepted").length;
    const outdated = users.filter((item) => item.status === "outdated").length;
    admin = {
      selectedYear,
      years: acceptanceYears(records),
      summary: { total: users.length, accepted, outdated, pending: users.length - accepted - outdated },
      users,
    };
  }

  return { document, acceptance, previousAcceptance, canSign: true, admin };
}

export async function hasAcceptedCurrentCode(email: string) {
  const [document, records] = await Promise.all([
    readCodeOfConductDocument(false),
    readCodeOfConductRows(),
  ]);
  const normalizedEmail = normalizeEmail(email);
  return records.some((record) =>
    record.email === normalizedEmail && isCurrentCodeAcceptance(record, document, currentAcceptanceYear()),
  );
}

export async function acceptCodeOfConduct(
  input: {
    dni: string;
    acceptsCode: boolean;
    acceptsImages: boolean;
    acceptsFee: boolean;
    feeReason?: string;
  },
  actor: { email: string; role: UserRole },
) {
  if (input.acceptsCode !== true) throw new Error("Debés confirmar que leíste y aceptás el Código de Convivencia.");
  if (typeof input.acceptsImages !== "boolean") throw new Error("Indicá si aceptás el uso institucional de imágenes.");
  if (typeof input.acceptsFee !== "boolean") throw new Error("Indicá si aceptás cumplir con la cuota societaria.");

  const dni = String(input.dni ?? "").replace(/\D/g, "");
  if (dni.length < 7 || dni.length > 9) throw new Error("Ingresá un DNI válido, sólo con números.");
  const feeReason = String(input.feeReason ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
  if (!input.acceptsFee && !feeReason) throw new Error("Si no aceptás la cuota, explicá la causa para que sea evaluada por la Comisión.");

  const [document, state, records, acceptanceSheetId] = await Promise.all([
    readCodeOfConductDocument(false),
    managementState(),
    readCodeOfConductRows(),
    ensureCodeOfConductSheet(),
  ]);
  const email = normalizeEmail(actor.email);
  const member = state.members.find((item) => normalizeEmail(String(item.values[MEMBER_EMAIL_HEADER] ?? "")) === email);
  const account = state.accounts.find((item) => item.email === email && item.active);
  const name = member ? cellText(member.values[MEMBER_NAME_HEADER]) : account?.name || email;

  const storedDni = member ? String(member.values["DNI"] ?? "").replace(/\D/g, "") : "";
  if (storedDni && storedDni !== dni) throw new Error("El DNI ingresado no coincide con el DNI registrado en tu ficha.");

  const acceptanceYear = currentAcceptanceYear();
  const existing = records.find((record) =>
    record.email === email && isCurrentCodeAcceptance(record, document, acceptanceYear),
  );
  if (existing) return existing;

  const requiresTutorSignature = Boolean(member && member.age !== null && member.age < 18);
  const id = crypto.randomUUID();
  const acceptedAt = new Date().toISOString();
  const record: CodeOfConductAcceptance = {
    id,
    email,
    name,
    dni,
    role: actor.role,
    documentName: document.name,
    revision: document.revision,
    driveModifiedTime: document.modifiedTime,
    acceptedAt,
    acceptanceYear,
    acceptsCode: true,
    acceptsImages: input.acceptsImages,
    acceptsFee: input.acceptsFee,
    feeReason,
    requiresTutorSignature,
  };

  const requests: Array<Record<string, unknown>> = [{
    appendCells: {
      sheetId: acceptanceSheetId,
      rows: [{
        values: [
          record.id,
          record.email,
          record.name,
          record.dni,
          record.role,
          record.documentName,
          record.revision,
          record.driveModifiedTime,
          record.acceptedAt,
          record.acceptsCode,
          record.acceptsImages,
          record.acceptsFee,
          record.feeReason,
          record.requiresTutorSignature,
          record.acceptanceYear,
        ].map((value, index) => cellData(value, index === 14)),
      }],
      fields: "userEnteredValue",
    },
  }];

  const ids = await sheetIds();
  if (member && typeof ids.Integrantes === "number") {
    const conductColumn = MEMBER_HEADERS.indexOf("Conozco el codigo de conducta de Proyecto Puente");
    requests.push({
      updateCells: {
        range: {
          sheetId: ids.Integrantes,
          startRowIndex: member.rowNumber - 1,
          endRowIndex: member.rowNumber,
          startColumnIndex: conductColumn,
          endColumnIndex: conductColumn + 1,
        },
        rows: [{ values: [cellData("Sí")] }],
        fields: "userEnteredValue",
      },
    });
  }
  if (typeof ids.LOG === "number") {
    requests.push({
      appendCells: {
        sheetId: ids.LOG,
        rows: [logRow(
          actor,
          "CODIGO_CONVIVENCIA_ACEPTADO",
          email,
          name,
          "Código de Convivencia " + acceptanceYear + " · REV " + document.revision,
          "",
          "Aceptado",
        )],
        fields: "userEnteredValue",
      },
    });
  }
  await writeRequests(requests);
  return record;
}
