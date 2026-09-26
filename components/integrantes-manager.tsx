"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Columns3, Download, FileDown, ImagePlus, Link2, LoaderCircle, Pencil, Plus, RefreshCw, RotateCcw, Search, Upload, UserMinus, X } from "lucide-react";
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

export function IntegrantesManager({ data }: { data: PortalData }) {
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
  const importInput = useRef<HTMLInputElement>(null);

  const acceptPayload = useCallback((next: MemberManagementPayload) => {
    setPayload(next);
    setVisible((current) => {
      if (current.length) return current.filter((header) => next.headers.includes(header));
      const stored = window.localStorage.getItem("puente-visible-columns");
      if (stored) {
        try { return (JSON.parse(stored) as string[]).filter((header) => next.headers.includes(header)); } catch { /* use defaults */ }
      }
      return [...next.headers];
    });
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
    if (visible.length) window.localStorage.setItem("puente-visible-columns", JSON.stringify(visible));
  }, [visible]);
  useEffect(() => {
    const stored = window.localStorage.getItem("puente-column-widths");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Record<string, number>;
        const frame = window.requestAnimationFrame(() => setWidths(parsed));
        return () => window.cancelAnimationFrame(frame);
      } catch { /* use defaults */ }
    }
  }, []);
  useEffect(() => {
    if (Object.keys(widths).length) window.localStorage.setItem("puente-column-widths", JSON.stringify(widths));
  }, [widths]);

  const rows = useMemo(() => {
    const term = normalized(search.trim());
    const nameTerm = normalized(nameFilter.trim());
    if (!payload) return [];
    return payload.rows.filter((row) => {
      const matchesAll = !term || normalized(Object.values(row.values).join(" ")).includes(term);
      const matchesName = !nameTerm || normalized(row.values[NAME]).includes(nameTerm);
      return matchesAll && matchesName;
    });
  }, [payload, search, nameFilter]);
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

  if (loading && !payload) return <section className="surface manager-loading"><LoaderCircle className="spin" /><span>Cargando integrantes…</span></section>;
  if (!payload) return <section className="surface manager-error"><p>{error || "No se pudo abrir el padrón."}</p><Button onClick={() => void load()}><RefreshCw /> Reintentar</Button></section>;

  return (
    <div className="page-stack member-manager">
      <section className="surface manager-toolbar">
        <div>
          <p className="eyebrow">PADRÓN EN VIVO</p>
          <h2>{payload.canManage ? "Administración de integrantes" : "Mi ficha de integrante"}</h2>
          <p>{payload.canManage ? `${payload.rows.length} integrantes · ${payload.headers.length} columnas de Google Sheets.` : payload.canEdit ? "Podés consultar y actualizar únicamente tus propios datos." : "Tu ficha está en modo sólo lectura. El administrador debe habilitar la edición."}</p>
        </div>
        <div className="manager-actions">
          {payload.canManage ? <Button className="add-member-button" onClick={() => openEdit(null)}><Plus /> Agregar integrante</Button> : null}
          {payload.canManage ? <NewMembersManager onMemberIncorporated={() => { setNotice("El nuevo integrante fue incorporado al padrón."); void load(); }} /> : null}
          <Button variant="outline" disabled={!selectedMember || !payload.canEdit} onClick={() => openEdit(selectedMember)}><Pencil /> Modificar</Button>
          {payload.canManage ? <Button variant="destructive" disabled={!selectedMember} onClick={() => setBajaOpen(true)}><UserMinus /> Baja</Button> : null}
          <Button variant="outline" onClick={() => void exportExcel()}><Download /> Exportar Excel</Button>
          {payload.canManage ? <><Button variant="outline" disabled={importing} onClick={() => importInput.current?.click()}>{importing ? <LoaderCircle className="spin" /> : <Upload />} Importar Excel</Button><input ref={importInput} className="sr-only" type="file" accept=".xlsx,.xls" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importExcel(file); }} /></> : null}
          <details className="column-picker">
            <summary><Columns3 /> Mostrar / ocultar columnas <Badge>{visible.length}/{payload.headers.length}</Badge></summary>
            <div>
              <header>
                <strong>Columnas visibles</strong>
                <span>
                  <button type="button" onClick={() => setVisible([...payload.headers])}>Mostrar todas</button>
                  <button type="button" onClick={() => setVisible([])}>Ocultar todas</button>
                  <button type="button" onClick={() => { setWidths({}); window.localStorage.removeItem("puente-column-widths"); }}><RotateCcw /> Restablecer anchos</button>
                </span>
              </header>
              {payload.headers.map((header) => (
                <label key={header}><Checkbox checked={visible.includes(header)} onCheckedChange={(checked) => setVisible((current) => checked === true ? [...current, header] : current.filter((item) => item !== header))} /><span>{header}</span></label>
              ))}
            </div>
          </details>
          <label className="manager-search"><Search /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en todas las columnas…" /></label>
          <Button variant="outline" size="icon" onClick={() => void load()} aria-label="Actualizar grilla"><RefreshCw /></Button>
        </div>
      </section>

      {notice ? <div className="manager-notice"><Check /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Cerrar"><X /></button></div> : null}
      {error ? <p className="inline-error" role="alert">{error}</p> : null}

      <section className="surface sheet-grid-wrap">
        <div className="sheet-grid-scroll">
          <table className="sheet-grid">
            <colgroup>
              <col style={{ width: 54 }} />
              {visibleHeaders.map((header) => <col key={header} style={{ width: widths[header] ?? columnWidth(header) }} />)}
            </colgroup>
            <thead>
              <tr>
                <th className="select-column"><span className="sheet-column-letter">#</span><span>Seleccionar</span></th>
                {visibleHeaders.map((header) => (
                  <th key={header}>
                    <span className="sheet-column-letter">{columnLetter(payload.headers.indexOf(header))}</span>
                    <span>{header}</span>
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
                  {visibleHeaders.map((header) => (
                    <td key={header} title={String(row.values[header] ?? "")}>{header === AGE ? `${row.age ?? "—"} · ${row.ageStatus}` : String(row.values[header] ?? "") || "—"}</td>
                  ))}
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={visibleHeaders.length + 1} className="empty-cell">No hay filas para mostrar.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <footer><span>{rows.length} fila{rows.length === 1 ? "" : "s"} · {visibleHeaders.length} columnas visibles</span><small>Usá las barras inferior y lateral para recorrer la hoja. {payload.canEdit ? "Doble clic para editar." : "Edición deshabilitada por el administrador."}</small></footer>
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
