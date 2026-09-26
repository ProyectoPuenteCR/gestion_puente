"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AtSign,
  Baby,
  Ban,
  BarChart3,
  BriefcaseBusiness,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Columns3,
  Download,
  FileDown,
  ImagePlus,
  LayoutGrid,
  Link2,
  ListFilter,
  LoaderCircle,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  TableProperties,
  Upload,
  UserMinus,
  UserRound,
  UserRoundCheck,
  UsersRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NewMembersManager } from "@/components/new-members-manager";
import { memberReportHtml } from "@/lib/member-report";
import type { ConfigCategory, MemberFieldValue, MemberManagementPayload, MemberRecord, PerformanceComment, PortalData } from "@/lib/portal-types";

const NAME = "Apellidos y nombres ( Del integrante )";
const EMAIL = "email-puente";
const BIRTHDAY = "Fecha de Nacimiento";
const AGE = "Edad";
const SCHEDULE = "Horario en que asisto al proyecto";
const ACTIVITY = "Que actividad te gustaria realizar este año";
const SOCIAL_FEE = "Cuota Social";
const TITLE = "Titulo obtenido o en curso";
const TASK = "Tarea que desempeño dentro del Proyecto";
const ENTRY_YEAR = "Año de ingreso al Proyecto";
const PHOTO = "Foto";

const READ_ONLY = new Set(["Numero de orden", "Numero de Matricula", AGE, "Marca temporal"]);
const CHECKBOX_FIELDS = new Set([
  "Confirmo asistencia al ciclo 2026 de Proyecto Puente",
  "Conozco el codigo de conducta de Proyecto Puente",
  SOCIAL_FEE,
  "Posee Obra social",
]);
const TEXTAREA_FIELDS = new Set([
  "Por que me gusta participar del proyecto?",
  "Que me gustaría cambiar del Proyecto",
  "Quiero dejar un comentario",
  "Dirección Actual donde vivo",
  "Estoy estudiando?",
  "Si posee obra social indique cual",
  "En caso de emergencia avisar a ( indicar nombre y celular)",
  "Posee algún tipo de enfermedad patología que requiera algún cuidado especial",
  "Dirección del responsable",
]);

function normalized(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function isChecked(value: MemberFieldValue | undefined, field: string) {
  if (typeof value === "boolean") return value;
  const text = normalized(value);
  if (field === SOCIAL_FEE) return text.includes("estoy de acuerdo") || text === "si";
  return text === "si" || text === "sí" || text === "true";
}

function apiMessage(value: unknown) {
  if (value && typeof value === "object" && "error" in value) return String((value as { error: unknown }).error);
  return "No se pudo completar la operación.";
}

function prettyHeader(header: string) {
  const names: Record<string, string> = {
    "Numero de orden": "N.º de orden",
    "Numero de Matricula": "N.º de matrícula",
    [NAME]: "Apellidos y nombres",
    [EMAIL]: "Email Puente",
    [SCHEDULE]: "Horario de asistencia",
    [ACTIVITY]: "Actividades de interés",
    [BIRTHDAY]: "Fecha de nacimiento",
    [TITLE]: "Título obtenido o en curso",
    [ENTRY_YEAR]: "Año de ingreso",
  };
  return names[header] ?? header;
}

function columnLetter(index: number) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function columnWidth(header: string) {
  if (["Numero de orden", "Numero de Matricula", "DNI", AGE, ENTRY_YEAR].includes(header)) return 130;
  if ([NAME, EMAIL, SCHEDULE, BIRTHDAY, "CELULAR", "Dirección de correo electrónico"].includes(header)) return 235;
  if ([ACTIVITY, TITLE, "Dirección Actual donde vivo", "En caso de emergencia avisar a ( indicar nombre y celular)"].includes(header)) return 330;
  if (header.length > 48) return 300;
  if (header.length > 28) return 245;
  return 190;
}

function configValues(payload: MemberManagementPayload, type: ConfigCategory) {
  return payload.config.filter((item) => item.type === type && item.active).sort((a, b) => a.order - b.order).map((item) => item.value);
}

function Field({
  header,
  value,
  payload,
  disabled,
  onChange,
}: {
  header: string;
  value: MemberFieldValue | undefined;
  payload: MemberManagementPayload;
  disabled: boolean;
  onChange: (value: MemberFieldValue) => void;
}) {
  const label = prettyHeader(header);
  const stringValue = String(value ?? "");
  if (CHECKBOX_FIELDS.has(header)) {
    return (
      <label className="member-check-field">
        <Checkbox checked={isChecked(value, header)} disabled={disabled} onCheckedChange={(checked) => onChange(checked === true)} />
        <span><strong>{label}</strong><small>{header === SOCIAL_FEE ? "Marcar si está de acuerdo con abonar la cuota social." : "Sí / No"}</small></span>
      </label>
    );
  }
  if (header === SCHEDULE || header === TASK) {
    const type = header === SCHEDULE ? "HORARIO" : "TAREA";
    return (
      <label className="member-field"><span>{label}</span>
        <select value={stringValue} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
          <option value="">Seleccionar…</option>
          {configValues(payload, type).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    );
  }
  if (header === TITLE || header === ACTIVITY) {
    const type = header === TITLE ? "TITULO" : "ACTIVIDAD";
    const selected = stringValue.split(",").map((item) => normalized(item.trim())).filter(Boolean);
    return (
      <fieldset className="member-field multi-field" disabled={disabled}>
        <legend>{label}</legend>
        <div className="multi-options">
          {configValues(payload, type).map((option) => {
            const checked = selected.includes(normalized(option));
            return (
              <label key={option}>
                <Checkbox
                  checked={checked}
                  onCheckedChange={(next) => {
                    const current = stringValue.split(",").map((item) => item.trim()).filter(Boolean);
                    const result = next === true
                      ? [...current.filter((item) => normalized(item) !== normalized(option)), option]
                      : current.filter((item) => normalized(item) !== normalized(option));
                    onChange(result.join(", "));
                  }}
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }
  if (header === BIRTHDAY) {
    return <label className="member-field"><span>{label}</span><Input type="date" value={stringValue} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></label>;
  }
  if (TEXTAREA_FIELDS.has(header)) {
    return <label className="member-field member-field-wide"><span>{label}</span><textarea value={stringValue} disabled={disabled} rows={3} onChange={(event) => onChange(event.target.value)} /></label>;
  }
  const inputType = header === "Dirección de correo electrónico" || header === EMAIL
    ? "email"
    : header === "CELULAR" || header === "Teléfono celular del responsable"
      ? "tel"
      : header === ENTRY_YEAR || header === AGE || header === "DNI" ? "number" : "text";
  return (
    <label className="member-field"><span>{label}</span>
      <Input
        type={inputType}
        value={stringValue}
        disabled={disabled}
        required={header === NAME || header === EMAIL}
        min={header === ENTRY_YEAR ? 2000 : undefined}
        max={header === ENTRY_YEAR ? new Date().getFullYear() + 1 : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function MemberDialog({
  open,
  payload,
  member,
  portalData,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  payload: MemberManagementPayload;
  member: MemberRecord | null;
  portalData: PortalData;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, MemberFieldValue>>(
    () => member?.values ?? { [ENTRY_YEAR]: String(new Date().getFullYear()), [EMAIL]: payload.currentEmail },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reporting, setReporting] = useState(false);
  const photoValue = String(values[PHOTO] ?? "").trim();
  const photoPreview = photoValue ? (photoValue.startsWith("http") ? `/api/fotos/externa?url=${encodeURIComponent(photoValue)}` : `/api/fotos/${encodeURIComponent(photoValue)}`) : "";

  const age = useMemo(() => {
    const date = String(values[BIRTHDAY] ?? "");
    if (!date) return null;
    const birth = new Date(`${date}T12:00:00`);
    if (Number.isNaN(birth.getTime())) return null;
    const today = new Date();
    let result = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) result -= 1;
    return result;
  }, [values]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/integrantes", {
        method: member ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rowNumber: member?.rowNumber, values }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiMessage(body));
      onOpenChange(false);
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function createPersonalReport() {
    if (!member) return;
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) { setError("El navegador bloqueó la ventana del reporte. Habilitá las ventanas emergentes e intentá nuevamente."); return; }
    reportWindow.document.write("<p style='font-family:Arial;padding:30px'>Preparando reporte integral…</p>");
    setReporting(true);
    setError("");
    try {
      const email = String(member.values[EMAIL] ?? "");
      const response = await fetch(`/api/desempenos?email=${encodeURIComponent(email)}`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiMessage(body));
      const comments = (body as { comments: PerformanceComment[] }).comments;
      reportWindow.document.open();
      reportWindow.document.write(memberReportHtml(member, portalData, comments));
      reportWindow.document.close();
    } catch (caught) {
      reportWindow.close();
      setError(caught instanceof Error ? caught.message : "No se pudo generar el reporte.");
    } finally {
      setReporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="member-dialog">
        <DialogHeader>
          <DialogTitle>{member ? "Editar integrante" : "Agregar integrante"}</DialogTitle>
          <DialogDescription>Los cambios se guardan en la hoja Integrantes y quedan registrados en LOG.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="member-form">
          <div className="calculated-age">
            <span>Edad calculada</span><strong>{age === null ? "Sin fecha" : `${age} años · ${age >= 18 ? "Mayor de edad" : "Menor de edad"}`}</strong>
          </div>
          <section className="member-photo-field">
            <div className="member-photo-preview">{photoPreview ? <img src={photoPreview} alt={`Foto de ${String(values[NAME] ?? "integrante")}`} /> : <ImagePlus />}</div>
            <div><strong>Foto del integrante</strong><p>Pegá el enlace público de una foto compartida desde Google Fotos. La imagen no se sube ni se copia.</p><label className="member-photo-url"><Link2 /><Input type="url" disabled={!payload.canEdit} value={photoValue} placeholder="https://photos.google.com/share/…" onChange={(event) => setValues((current) => ({ ...current, [PHOTO]: event.target.value }))} /></label></div>
          </section>
          <div className="member-form-grid">
            {payload.headers.filter((header) => header !== PHOTO).map((header) => (
              <Field
                key={header}
                header={header}
                value={header === AGE && age !== null ? String(age) : values[header]}
                payload={payload}
                disabled={!payload.canEdit || READ_ONLY.has(header) || (!payload.canManage && header === EMAIL)}
                onChange={(value) => setValues((current) => ({ ...current, [header]: value }))}
              />
            ))}
          </div>
          {error ? <p className="inline-error" role="alert">{error}</p> : null}
          <DialogFooter>
            {member ? <Button type="button" variant="outline" disabled={reporting} onClick={() => void createPersonalReport()}>{reporting ? <LoaderCircle className="spin" /> : <FileDown />} Reporte completo</Button> : null}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" /> : <Check />} Guardar cambios</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type MemberViewFilter = "all" | "active" | "with-email" | "no-email" | "minor" | "conduct" | "blocked";
type MemberViewMode = "quick" | "complete";
type MemberDetailTab = "summary" | "all" | "history";
type MemberNavigateTarget = "desempenos" | "asistencia" | "cuota";
type ConductUserState = "accepted" | "outdated" | "pending";

const PERSONAL_EMAIL = "Dirección de correo electrónico";
const ADDRESS = "Dirección Actual donde vivo";
const PHONE = "CELULAR";
const DNI = "DNI";
const RESPONSIBLE = "Nombre de padre madre o responsable";
const EMERGENCY = "En caso de emergencia avisar a ( indicar nombre y celular)";

function memberInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "PP";
}

function memberTurn(value: string) {
  const text = normalized(value);
  if (text.includes("2 turnos") || text.includes("ambos")) return "Ambos";
  if (text.includes("10") || text.includes("manana")) return "Mañana";
  if (text.includes("15") || text.includes("tarde")) return "Tarde";
  return value || "Sin turno";
}

function memberPhotoUrl(value: MemberFieldValue | undefined) {
  const photo = String(value ?? "").trim();
  if (!photo) return "";
  return photo.startsWith("http") ? `/api/fotos/externa?url=${encodeURIComponent(photo)}` : `/api/fotos/${encodeURIComponent(photo)}`;
}

function formatMemberDate(value: MemberFieldValue | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  const date = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function DetailValue({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
  return (
    <div className="member-detail-value">
      <Icon />
      <span><small>{label}</small><strong>{value || "—"}</strong></span>
    </div>
  );
}

export function IntegrantesManager({
  data,
  onNavigate,
}: {
  data: PortalData;
  onNavigate?: (view: MemberNavigateTarget) => void;
}) {
  const [payload, setPayload] = useState<MemberManagementPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [visible, setVisible] = useState<string[]>([]);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<MemberRecord | null>(null);
  const [bajaOpen, setBajaOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [savingBaja, setSavingBaja] = useState(false);
  const [importing, setImporting] = useState(false);
  const [viewMode, setViewMode] = useState<MemberViewMode>("quick");
  const [filter, setFilter] = useState<MemberViewFilter>("all");
  const [turnFilter, setTurnFilter] = useState("all");
  const [entryYearFilter, setEntryYearFilter] = useState("all");
  const [detailTab, setDetailTab] = useState<MemberDetailTab>("summary");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [pendingNewCount, setPendingNewCount] = useState(0);
  const [conductByEmail, setConductByEmail] = useState<Record<string, ConductUserState>>({});
  const importInput = useRef<HTMLInputElement>(null);

  const acceptPayload = useCallback((next: MemberManagementPayload) => {
    setPayload(next);
    setVisible((current) => {
      if (current.length) return current.filter((header) => next.headers.includes(header));
      const stored = window.localStorage.getItem("puente-visible-columns");
      if (stored) {
        try { return (JSON.parse(stored) as string[]).filter((header) => next.headers.includes(header)); } catch {}
      }
      return [...next.headers];
    });
    setSelected((current) => current ?? next.rows[0]?.rowNumber ?? null);
  }, []);

  const fetchPayload = useCallback(async () => {
    const response = await fetch("/api/integrantes", { cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(apiMessage(body));
    return body as MemberManagementPayload;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      acceptPayload(await fetchPayload());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar el padrón.");
    } finally {
      setLoading(false);
    }
  }, [acceptPayload, fetchPayload]);

  useEffect(() => {
    let active = true;
    void fetchPayload()
      .then((next) => { if (active) acceptPayload(next); })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "No se pudo cargar el padrón."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [acceptPayload, fetchPayload]);

  useEffect(() => {
    if (!payload?.canManage) return;
    let active = true;
    const year = new Date().getFullYear();
    void fetch(`/api/codigo-convivencia?year=${year}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => null) as {
          admin?: { users?: Array<{ email: string; status: ConductUserState }> };
        } | null;
        if (!response.ok || !active) return;
        const map = Object.fromEntries((body?.admin?.users ?? []).map((item) => [item.email.trim().toLowerCase(), item.status]));
        setConductByEmail(map);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [payload?.canManage]);

  useEffect(() => {
    if (visible.length) window.localStorage.setItem("puente-visible-columns", JSON.stringify(visible));
  }, [visible]);

  useEffect(() => {
    const stored = window.localStorage.getItem("puente-column-widths");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Record<string, number>;
        const frame = window.requestAnimationFrame(() => setWidths(parsed));
        return () => window.cancelAnimationFrame(frame);
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (Object.keys(widths).length) window.localStorage.setItem("puente-column-widths", JSON.stringify(widths));
  }, [widths]);

  useEffect(() => {
    setPage(1);
  }, [search, nameFilter, filter, turnFilter, entryYearFilter, pageSize]);

  const accountByEmail = useMemo(
    () => new Map((payload?.accounts ?? []).map((account) => [account.email.trim().toLowerCase(), account])),
    [payload?.accounts],
  );

  const isBlocked = useCallback((row: MemberRecord) => {
    const email = String(row.values[EMAIL] ?? "").trim().toLowerCase();
    return email ? accountByEmail.get(email)?.active === false : false;
  }, [accountByEmail]);

  const conductState = useCallback((row: MemberRecord): ConductUserState => {
    const email = String(row.values[EMAIL] ?? "").trim().toLowerCase();
    if (!email) return "pending";
    return conductByEmail[email] ?? "pending";
  }, [conductByEmail]);

  const allRows = payload?.rows ?? [];
  const stats = useMemo(() => ({
    total: allRows.length,
    withEmail: allRows.filter((row) => String(row.values[EMAIL] ?? "").trim()).length,
    withoutEmail: allRows.filter((row) => !String(row.values[EMAIL] ?? "").trim()).length,
    minors: allRows.filter((row) => row.age !== null && row.age < 18).length,
    blocked: allRows.filter(isBlocked).length,
    conductPending: allRows.filter((row) => conductState(row) !== "accepted").length,
  }), [allRows, conductState, isBlocked]);

  const entryYears = useMemo(
    () => [...new Set(allRows.map((row) => String(row.values[ENTRY_YEAR] ?? "").trim()).filter(Boolean))].sort((a, b) => b.localeCompare(a)),
    [allRows],
  );
  const turnOptions = useMemo(
    () => [...new Set(allRows.map((row) => memberTurn(String(row.values[SCHEDULE] ?? ""))).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")),
    [allRows],
  );

  const rows = useMemo(() => {
    const term = normalized(search.trim());
    const nameTerm = normalized(nameFilter.trim());
    return allRows.filter((row) => {
      const email = String(row.values[EMAIL] ?? "").trim();
      const matchesSearch = !term || normalized(Object.values(row.values).join(" ")).includes(term);
      const matchesName = !nameTerm || normalized(row.values[NAME]).includes(nameTerm);
      const matchesTurn = turnFilter === "all" || memberTurn(String(row.values[SCHEDULE] ?? "")) === turnFilter;
      const matchesYear = entryYearFilter === "all" || String(row.values[ENTRY_YEAR] ?? "").trim() === entryYearFilter;
      let matchesFilter = true;
      if (filter === "active") matchesFilter = !isBlocked(row);
      if (filter === "with-email") matchesFilter = Boolean(email);
      if (filter === "no-email") matchesFilter = !email;
      if (filter === "minor") matchesFilter = row.age !== null && row.age < 18;
      if (filter === "conduct") matchesFilter = conductState(row) !== "accepted";
      if (filter === "blocked") matchesFilter = isBlocked(row);
      return matchesSearch && matchesName && matchesTurn && matchesYear && matchesFilter;
    });
  }, [allRows, search, nameFilter, turnFilter, entryYearFilter, filter, conductState, isBlocked]);

  const maxPage = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, maxPage);
  const pagedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const visibleHeaders = useMemo(
    () => (payload?.headers ?? []).filter((header) => visible.includes(header)),
    [payload, visible],
  );
  const selectedMember = payload?.rows.find((row) => row.rowNumber === selected) ?? null;

  function openEdit(member: MemberRecord | null) {
    if (!payload?.canEdit) return;
    setEditing(member);
    setEditorOpen(true);
  }

  function startResize(header: string, event: React.PointerEvent<HTMLSpanElement>) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = widths[header] ?? columnWidth(header);
    const move = (next: PointerEvent) => setWidths((current) => ({ ...current, [header]: Math.max(90, Math.min(640, startWidth + next.clientX - startX)) }));
    const stop = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", stop);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", stop);
  }

  async function exportExcel() {
    if (!payload) return;
    setError("");
    try {
      const XLSX = await import("xlsx");
      const table = [payload.headers, ...rows.map((row) => payload.headers.map((header) => row.values[header] ?? ""))];
      const worksheet = XLSX.utils.aoa_to_sheet(table);
      worksheet["!cols"] = payload.headers.map((header) => ({ wch: Math.max(12, Math.round((widths[header] ?? columnWidth(header)) / 8)) }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Integrantes");
      XLSX.writeFile(workbook, `integrantes-proyecto-puente-${new Date().toISOString().slice(0, 10)}.xlsx`);
      setNotice(`Se exportaron ${rows.length} integrantes a Excel.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo exportar el archivo Excel.");
    }
  }

  async function importExcel(file: File) {
    if (!payload?.canManage) return;
    setImporting(true);
    setError("");
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
      const importedHeaders = (matrix[0] ?? []).map((value) => String(value).trim());
      const indexByHeader = new Map(importedHeaders.map((header, index) => [normalized(header), index]));
      const values = matrix.slice(1).flatMap((row) => {
        const record = Object.fromEntries(payload.headers.map((header) => {
          const index = indexByHeader.get(normalized(header));
          return [header, index === undefined ? "" : String(row[index] ?? "").trim()];
        }));
        return String(record[NAME] ?? "").trim() || String(record[EMAIL] ?? "").trim() ? [record] : [];
      });
      if (!values.length) throw new Error("El Excel no contiene filas con nombres o email-puente.");
      if (!window.confirm(`Se importarán ${values.length} filas. Los emails existentes se actualizarán y los nuevos se agregarán. ¿Continuar?`)) return;
      const response = await fetch("/api/integrantes/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: values }) });
      const body = await response.json().catch(() => null) as { created?: number; updated?: number; skipped?: number; error?: string } | null;
      if (!response.ok) throw new Error(apiMessage(body));
      setNotice(`Importación terminada: ${body?.created ?? 0} altas, ${body?.updated ?? 0} actualizaciones y ${body?.skipped ?? 0} filas omitidas.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo importar el archivo Excel.");
    } finally {
      setImporting(false);
      if (importInput.current) importInput.current.value = "";
    }
  }

  async function confirmBaja() {
    if (!selectedMember) return;
    setSavingBaja(true);
    setError("");
    try {
      const response = await fetch("/api/integrantes", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rowNumber: selectedMember.rowNumber, reason }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiMessage(body));
      setSelected(null);
      setReason("");
      setBajaOpen(false);
      setNotice("El integrante fue movido a la hoja Baja y su acceso quedó desactivado.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo realizar la baja.");
    } finally {
      setSavingBaja(false);
    }
  }

  async function openFullReport(member: MemberRecord) {
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      setError("El navegador bloqueó la ventana del reporte. Habilitá las ventanas emergentes e intentá nuevamente.");
      return;
    }
    reportWindow.document.write("<p style='font-family:Arial;padding:30px'>Preparando reporte integral…</p>");
    setError("");
    try {
      const email = String(member.values[EMAIL] ?? "");
      const response = await fetch(`/api/desempenos?email=${encodeURIComponent(email)}`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiMessage(body));
      const comments = (body as { comments: PerformanceComment[] }).comments;
      reportWindow.document.open();
      reportWindow.document.write(memberReportHtml(member, data, comments));
      reportWindow.document.close();
    } catch (caught) {
      reportWindow.close();
      setError(caught instanceof Error ? caught.message : "No se pudo generar el reporte.");
    }
  }

  function clearFilters() {
    setSearch("");
    setNameFilter("");
    setFilter("all");
    setTurnFilter("all");
    setEntryYearFilter("all");
  }

  if (loading && !payload) return <section className="surface manager-loading"><LoaderCircle className="spin" /><span>Cargando integrantes…</span></section>;
  if (!payload) return <section className="surface manager-error"><p>{error || "No se pudo abrir el padrón."}</p><Button onClick={() => void load()}><RefreshCw /> Reintentar</Button></section>;

  const selectedName = String(selectedMember?.values[NAME] ?? "");
  const selectedEmail = String(selectedMember?.values[EMAIL] ?? "");
  const selectedSchedule = String(selectedMember?.values[SCHEDULE] ?? "");
  const selectedPhoto = memberPhotoUrl(selectedMember?.values[PHOTO]);
  const selectedConduct = selectedMember ? conductState(selectedMember) : "pending";
  const selectedBlocked = selectedMember ? isBlocked(selectedMember) : false;
  const selectedCodeLabel = selectedConduct === "accepted"
    ? `Código ${new Date().getFullYear()} ✓`
    : selectedConduct === "outdated"
      ? "Código desactualizado"
      : "Código pendiente";

  return (
    <div className="page-stack member-manager member-manager-v2">
      <section className="surface member-hero">
        <div className="member-hero-copy">
          <p className="eyebrow">PADRÓN EN VIVO</p>
          <h2>{payload.canManage ? "Administración de integrantes" : "Mi ficha de integrante"}</h2>
          <p>{payload.canManage ? `Gestioná los integrantes de Proyecto Puente. ${payload.rows.length} integrantes · ${payload.headers.length} columnas en Google Sheets.` : "Consultá y actualizá tus datos personales habilitados."}</p>
        </div>
        <div className="member-hero-actions">
          {payload.canManage ? <Button className="add-member-button" onClick={() => openEdit(null)}><Plus /> Agregar integrante</Button> : null}
          {payload.canManage ? (
            <NewMembersManager
              onPendingCount={setPendingNewCount}
              onMemberIncorporated={() => { setNotice("El nuevo integrante fue incorporado al padrón."); void load(); }}
            />
          ) : null}
        </div>
      </section>

      {payload.canManage ? (
        <section className="member-kpis" aria-label="Resumen del padrón">
          <button type="button" className="member-kpi" onClick={() => setFilter("all")}><span className="member-kpi-icon tone-blue"><UsersRound /></span><strong>{stats.total}</strong><small>Integrantes totales</small></button>
          <button type="button" className="member-kpi" onClick={() => { setFilter("with-email"); setSearch(""); }}><span className="member-kpi-icon tone-green"><CheckCircle2 /></span><strong>{stats.withEmail}</strong><small>Con email Puente</small></button>
          <button type="button" className="member-kpi" onClick={() => setFilter("no-email")}><span className="member-kpi-icon tone-amber"><Mail /></span><strong>{stats.withoutEmail}</strong><small>Sin email</small></button>
          <button type="button" className="member-kpi" onClick={() => setFilter("minor")}><span className="member-kpi-icon tone-purple"><Baby /></span><strong>{stats.minors}</strong><small>Menores</small></button>
          <div className="member-kpi"><span className="member-kpi-icon tone-red"><ClipboardList /></span><strong>{pendingNewCount}</strong><small>Solicitudes nuevas</small></div>
        </section>
      ) : null}

      <section className="surface member-browser">
        <div className="member-browser-toolbar">
          <label className="member-global-search"><Search /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, DNI, email, teléfono, dirección..." /></label>

          <details className="member-filter-menu">
            <summary><ListFilter /> Filtros <ChevronRight /></summary>
            <div>
              <label><span>Turno</span><select value={turnFilter} onChange={(event) => setTurnFilter(event.target.value)}><option value="all">Todos</option>{turnOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label><span>Año de ingreso</span><select value={entryYearFilter} onChange={(event) => setEntryYearFilter(event.target.value)}><option value="all">Todos</option>{entryYears.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <Button type="button" variant="outline" onClick={clearFilters}>Limpiar filtros</Button>
            </div>
          </details>

          <div className="member-view-switch">
            <Button type="button" variant={viewMode === "quick" ? "default" : "outline"} onClick={() => setViewMode("quick")}><LayoutGrid /> Vista rápida</Button>
            <Button type="button" variant={viewMode === "complete" ? "default" : "outline"} onClick={() => setViewMode("complete")}><TableProperties /> Vista completa</Button>
          </div>

          <details className="column-picker">
            <summary><Columns3 /> Columnas <Badge>{visible.length}/{payload.headers.length}</Badge></summary>
            <div>
              <header>
                <strong>Columnas visibles</strong>
                <span>
                  <button type="button" onClick={() => setVisible([...payload.headers])}>Todas</button>
                  <button type="button" onClick={() => setVisible([])}>Ninguna</button>
                  <button type="button" onClick={() => { setWidths({}); window.localStorage.removeItem("puente-column-widths"); }}><RotateCcw /> Anchos</button>
                </span>
              </header>
              <p className="member-column-note">Estas opciones se aplican a la Vista completa.</p>
              {payload.headers.map((header) => (
                <label key={header}><Checkbox checked={visible.includes(header)} onCheckedChange={(checked) => setVisible((current) => checked === true ? [...current, header] : current.filter((item) => item !== header))} /><span>{header}</span></label>
              ))}
            </div>
          </details>

          <details className="member-more-menu">
            <summary><MoreHorizontal /> Más</summary>
            <div>
              <button type="button" onClick={() => void exportExcel()}><Download /> Exportar Excel</button>
              {payload.canManage ? <button type="button" disabled={importing} onClick={() => importInput.current?.click()}>{importing ? <LoaderCircle className="spin" /> : <Upload />} Importar Excel</button> : null}
              <button type="button" disabled={!selectedMember || !payload.canEdit} onClick={() => openEdit(selectedMember)}><Pencil /> Modificar seleccionado</button>
            </div>
          </details>
          {payload.canManage ? <input ref={importInput} className="sr-only" type="file" accept=".xlsx,.xls" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importExcel(file); }} /> : null}
          <Button variant="outline" size="icon" onClick={() => void load()} aria-label="Actualizar grilla"><RefreshCw /></Button>
        </div>

        {payload.canManage ? (
          <div className="member-filter-chips">
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todos ({stats.total})</button>
            <button className={filter === "active" ? "active" : ""} onClick={() => setFilter("active")}>Activos ({stats.total - stats.blocked})</button>
            <button className={filter === "no-email" ? "active" : ""} onClick={() => setFilter("no-email")}>Sin email ({stats.withoutEmail})</button>
            <button className={filter === "minor" ? "active" : ""} onClick={() => setFilter("minor")}>Menores ({stats.minors})</button>
            <button className={filter === "conduct" ? "active warning" : "warning"} onClick={() => setFilter("conduct")}><ShieldAlert /> Código pendiente ({stats.conductPending})</button>
            <button className={filter === "blocked" ? "active danger" : "danger"} onClick={() => setFilter("blocked")}><Ban /> Bloqueados ({stats.blocked})</button>
            {(filter !== "all" || turnFilter !== "all" || entryYearFilter !== "all" || search) ? <button className="clear" onClick={clearFilters}>Limpiar filtros</button> : null}
          </div>
        ) : null}

        {notice ? <div className="manager-notice"><Check /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Cerrar"><X /></button></div> : null}
        {error ? <p className="inline-error" role="alert">{error}</p> : null}

        {viewMode === "quick" ? (
          <div className={`member-quick-layout ${selectedMember ? "has-detail" : ""}`}>
            <div className="member-quick-main">
              <div className="member-quick-table-wrap">
                <table className="member-quick-table">
                  <thead>
                    <tr>
                      <th className="check-cell"></th>
                      <th>Integrante</th>
                      <th>DNI</th>
                      <th>Turno</th>
                      <th>Celular</th>
                      <th>Email Puente</th>
                      <th>Estado</th>
                      <th>Dirección</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((row) => {
                      const name = String(row.values[NAME] ?? "");
                      const email = String(row.values[EMAIL] ?? "");
                      const photo = memberPhotoUrl(row.values[PHOTO]);
                      const blocked = isBlocked(row);
                      const code = conductState(row);
                      return (
                        <tr key={row.id} className={selected === row.rowNumber ? "selected" : ""} onClick={() => { setSelected(row.rowNumber); setDetailTab("summary"); }} onDoubleClick={() => openEdit(row)}>
                          <td className="check-cell"><input type="checkbox" checked={selected === row.rowNumber} readOnly aria-label={`Seleccionar ${name}`} /></td>
                          <td><div className="member-person-cell">{photo ? <img src={photo} alt="" /> : <span>{memberInitials(name)}</span>}<div><strong>{name || "Sin nombre"}</strong><small>{email || String(row.values[PERSONAL_EMAIL] ?? "") || "Sin email"}</small></div></div></td>
                          <td>{String(row.values[DNI] ?? "") || "—"}</td>
                          <td><span className={`member-turn member-turn-${normalized(memberTurn(String(row.values[SCHEDULE] ?? "")))}`}>{memberTurn(String(row.values[SCHEDULE] ?? ""))}</span></td>
                          <td>{String(row.values[PHONE] ?? "") || "—"}</td>
                          <td className="member-email-cell">{email || "—"}</td>
                          <td><div className="member-status-stack">{blocked ? <span className="member-status blocked">Bloqueado</span> : email ? <span className="member-status active">Activo</span> : <span className="member-status no-email">Sin email</span>}{code === "accepted" ? <span className="member-status code">Código {new Date().getFullYear()} ✓</span> : <span className="member-status code-pending">{code === "outdated" ? "Código desactualizado" : "Código pendiente"}</span>}</div></td>
                          <td>{String(row.values[ADDRESS] ?? "") || "—"}</td>
                          <td><Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); setSelected(row.rowNumber); }} aria-label={`Acciones de ${name}`}><MoreHorizontal /></Button></td>
                        </tr>
                      );
                    })}
                    {!pagedRows.length ? <tr><td colSpan={9} className="empty-cell">No hay integrantes para los filtros seleccionados.</td></tr> : null}
                  </tbody>
                </table>
              </div>

              <footer className="member-table-footer">
                <strong>{rows.length} integrantes {selectedMember ? "· 1 seleccionado" : ""}</strong>
                <div className="member-pagination">
                  <Button variant="outline" size="icon" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft /></Button>
                  {Array.from({ length: Math.min(5, maxPage) }, (_, index) => {
                    const firstPage = Math.min(Math.max(1, currentPage - 2), Math.max(1, maxPage - 4));
                    const pageNumber = firstPage + index;
                    return pageNumber <= maxPage ? <button key={pageNumber} className={pageNumber === currentPage ? "active" : ""} onClick={() => setPage(pageNumber)}>{pageNumber}</button> : null;
                  })}
                  <Button variant="outline" size="icon" disabled={currentPage >= maxPage} onClick={() => setPage((value) => Math.min(maxPage, value + 1))}><ChevronRight /></Button>
                </div>
                <label className="member-page-size">Mostrar <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select> por página</label>
              </footer>
            </div>

            {selectedMember ? (
              <aside className="member-detail-panel">
                <header className="member-detail-header">
                  {selectedPhoto ? <img src={selectedPhoto} alt="" /> : <span className="member-detail-avatar">{memberInitials(selectedName)}</span>}
                  <div>
                    <div className="member-detail-title"><h3>{selectedName}</h3>{selectedBlocked ? <span className="member-status blocked">Bloqueado</span> : <span className="member-status active">Activo</span>}</div>
                    <p>Matrícula: {String(selectedMember.values["Numero de Matricula"] ?? "—")}</p>
                    <span className={selectedConduct === "accepted" ? "member-status code" : "member-status code-pending"}>{selectedCodeLabel}</span>
                  </div>
                  <button type="button" className="member-detail-close" onClick={() => setSelected(null)} aria-label="Cerrar detalle"><X /></button>
                </header>

                <nav className="member-detail-tabs">
                  <button className={detailTab === "summary" ? "active" : ""} onClick={() => setDetailTab("summary")}><LayoutGrid /> Resumen</button>
                  <button className={detailTab === "all" ? "active" : ""} onClick={() => setDetailTab("all")}><ClipboardList /> Datos completos</button>
                  <button className={detailTab === "history" ? "active" : ""} onClick={() => setDetailTab("history")}><CalendarDays /> Historial</button>
                </nav>

                {detailTab === "summary" ? (
                  <div className="member-detail-sections">
                    <section>
                      <header><h4><AtSign /> Contacto</h4><Button variant="outline" size="sm" onClick={() => openEdit(selectedMember)}><Pencil /> Editar</Button></header>
                      <DetailValue icon={UserRound} label="DNI" value={String(selectedMember.values[DNI] ?? "")} />
                      <DetailValue icon={Phone} label="Celular" value={String(selectedMember.values[PHONE] ?? "")} />
                      <DetailValue icon={Mail} label="Email Puente" value={selectedEmail} />
                      <DetailValue icon={AtSign} label="Email personal" value={String(selectedMember.values[PERSONAL_EMAIL] ?? "")} />
                      <DetailValue icon={MapPin} label="Dirección" value={String(selectedMember.values[ADDRESS] ?? "")} />
                    </section>

                    <section>
                      <header><h4><BriefcaseBusiness /> Información del proyecto</h4><Button variant="outline" size="sm" onClick={() => openEdit(selectedMember)}><Pencil /> Editar</Button></header>
                      <DetailValue icon={CalendarCheck} label="Turno" value={memberTurn(selectedSchedule)} />
                      <DetailValue icon={CalendarDays} label="Horario" value={selectedSchedule} />
                      <DetailValue icon={ClipboardList} label="Año de ingreso" value={String(selectedMember.values[ENTRY_YEAR] ?? "")} />
                      <DetailValue icon={BriefcaseBusiness} label="Tarea / Área" value={String(selectedMember.values[TASK] ?? "")} />
                    </section>

                    <section>
                      <header><h4><UserRound /> Información personal</h4><Button variant="outline" size="sm" onClick={() => openEdit(selectedMember)}><Pencil /> Editar</Button></header>
                      <DetailValue icon={CalendarDays} label="Fecha de nacimiento" value={`${formatMemberDate(selectedMember.values[BIRTHDAY])}${selectedMember.age !== null ? ` (${selectedMember.age} años)` : ""}`} />
                      <DetailValue icon={Baby} label="Edad" value={selectedMember.age === null ? "—" : `${selectedMember.age} años`} />
                      <DetailValue icon={UserRoundCheck} label="Responsable" value={String(selectedMember.values[RESPONSIBLE] ?? "")} />
                      <DetailValue icon={Phone} label="Contacto de emergencia" value={String(selectedMember.values[EMERGENCY] ?? "")} />
                    </section>

                    <section className="member-detail-actions">
                      <header><h4><BriefcaseBusiness /> Acciones</h4></header>
                      <div>
                        <Button variant="outline" onClick={() => openEdit(selectedMember)}><Pencil /> Modificar integrante</Button>
                        <Button variant="outline" onClick={() => void openFullReport(selectedMember)}><FileDown /> Ver reporte completo</Button>
                        <Button variant="outline" onClick={() => onNavigate?.("desempenos")}><BarChart3 /> Ver desempeño</Button>
                        <Button variant="outline" onClick={() => onNavigate?.("asistencia")}><CalendarCheck /> Ver asistencias</Button>
                        <Button variant="outline" onClick={() => onNavigate?.("cuota")}><CircleDollarSign /> Ver cuotas</Button>
                        {payload.canManage ? <Button variant="destructive" onClick={() => setBajaOpen(true)}><UserMinus /> Dar de baja</Button> : null}
                      </div>
                    </section>
                  </div>
                ) : null}

                {detailTab === "all" ? (
                  <div className="member-all-fields">
                    {payload.headers.map((header) => <div key={header}><small>{prettyHeader(header)}</small><strong>{header === AGE ? `${selectedMember.age ?? "—"} · ${selectedMember.ageStatus}` : String(selectedMember.values[header] ?? "") || "—"}</strong></div>)}
                  </div>
                ) : null}

                {detailTab === "history" ? (
                  <div className="member-history">
                    <div><span><CalendarDays /></span><p><strong>Ingreso al Proyecto</strong><small>Año {String(selectedMember.values[ENTRY_YEAR] ?? "sin registrar")}</small></p></div>
                    <div><span><ShieldAlert /></span><p><strong>Código de Convivencia</strong><small>{selectedCodeLabel}</small></p></div>
                    <div><span><AtSign /></span><p><strong>Acceso a la plataforma</strong><small>{selectedBlocked ? "Bloqueado por administración" : selectedEmail ? "Habilitado mediante email institucional" : "Pendiente de email institucional"}</small></p></div>
                    <p className="member-history-note">Los cambios administrativos detallados continúan registrándose en la hoja LOG.</p>
                  </div>
                ) : null}
              </aside>
            ) : null}
          </div>
        ) : (
          <section className="sheet-grid-wrap member-complete-view">
            <div className="sheet-grid-scroll">
              <table className="sheet-grid">
                <colgroup><col style={{ width: 54 }} />{visibleHeaders.map((header) => <col key={header} style={{ width: widths[header] ?? columnWidth(header) }} />)}</colgroup>
                <thead>
                  <tr>
                    <th className="select-column"><span className="sheet-column-letter">#</span><span>Seleccionar</span></th>
                    {visibleHeaders.map((header) => (
                      <th key={header}>
                        <span className="sheet-column-letter">{columnLetter(payload.headers.indexOf(header))}</span><span>{header}</span>
                        {header === NAME ? <label className="sheet-name-filter" onClick={(event) => event.stopPropagation()}><Search /><input list="member-name-options" value={nameFilter} onChange={(event) => setNameFilter(event.target.value)} placeholder="Buscar nombre…" /><datalist id="member-name-options">{payload.rows.map((row) => <option key={row.id} value={String(row.values[NAME] ?? "")} />)}</datalist>{nameFilter ? <button type="button" onClick={() => setNameFilter("")} aria-label="Limpiar nombre"><X /></button> : null}</label> : null}
                        <span className="column-resizer" role="separator" aria-label={`Cambiar ancho de ${header}`} onPointerDown={(event) => startResize(header, event)} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className={selected === row.rowNumber ? "selected" : ""} onClick={() => setSelected(row.rowNumber)} onDoubleClick={() => { if (payload.canEdit) openEdit(row); }}>
                      <td className="select-column"><input type="radio" name="selected-member" checked={selected === row.rowNumber} onChange={() => setSelected(row.rowNumber)} aria-label={`Seleccionar ${String(row.values[NAME] ?? "integrante")}`} /></td>
                      {visibleHeaders.map((header) => <td key={header} title={String(row.values[header] ?? "")}>{header === AGE ? `${row.age ?? "—"} · ${row.ageStatus}` : String(row.values[header] ?? "") || "—"}</td>)}
                    </tr>
                  ))}
                  {!rows.length ? <tr><td colSpan={visibleHeaders.length + 1} className="empty-cell">No hay filas para mostrar.</td></tr> : null}
                </tbody>
              </table>
            </div>
            <footer><span>{rows.length} fila{rows.length === 1 ? "" : "s"} · {visibleHeaders.length} columnas visibles</span><small>Doble clic para editar. Usá las barras inferior y lateral para recorrer la hoja.</small></footer>
          </section>
        )}
      </section>

      {editorOpen ? <MemberDialog open payload={payload} member={editing} portalData={data} onOpenChange={setEditorOpen} onSaved={() => { setNotice("Los datos se guardaron correctamente en Google Sheets."); void load(); }} /> : null}

      <Dialog open={bajaOpen} onOpenChange={setBajaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dar de baja a {String(selectedMember?.values[NAME] ?? "este integrante")}</DialogTitle><DialogDescription>La fila se moverá a la hoja Baja y el acceso del email-puente quedará desactivado.</DialogDescription></DialogHeader>
          <label className="member-field"><span>Motivo de la baja</span><textarea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Escribí el motivo…" /></label>
          <DialogFooter><Button variant="outline" onClick={() => setBajaOpen(false)}>Cancelar</Button><Button variant="destructive" disabled={savingBaja || !reason.trim()} onClick={() => void confirmBaja()}>{savingBaja ? <LoaderCircle className="spin" /> : <UserMinus />} Confirmar baja</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
