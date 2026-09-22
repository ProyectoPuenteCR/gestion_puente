"use client";

import { useMemo, useState } from "react";
import { BookOpenCheck, Calculator, CalendarRange, ClipboardCheck, Download, ListFilter, LoaderCircle, Pencil, Save, Search, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Integrante, PortalData, ScoringHistoryRecord, ScoringSnapshot } from "@/lib/portal-types";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function responseMessage(value: unknown) {
  return value && typeof value === "object" && "error" in value
    ? String((value as { error: unknown }).error)
    : "No se pudo guardar el scoring.";
}

function scoreClass(score: number | null) {
  if (score === null) return "fee-status-empty";
  if (score >= 8) return "score-high";
  if (score >= 6) return "score-medium";
  return "score-low";
}

function memberMatches(record: ScoringHistoryRecord, member: Integrante) {
  return Boolean(member.email && record.email && member.email.toLowerCase() === record.email.toLowerCase())
    || normalize(record.name) === normalize(member.nombre);
}

function average(records: ScoringHistoryRecord[]) {
  const scores = records.flatMap((record) => record.score === null ? [] : [record.score]);
  return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
}

export function ScoringMatrix({ data }: { data: PortalData }) {
  const members = useMemo(
    () => [...data.integrantes].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [data.integrantes],
  );
  const [records, setRecords] = useState(data.scoringHistory);
  const [topics, setTopics] = useState(data.scoringTopics);
  const years = useMemo(() => [...new Set([
    CURRENT_YEAR + 1,
    CURRENT_YEAR,
    CURRENT_YEAR - 1,
    ...records.map((record) => record.year),
  ])].sort((a, b) => b - a), [records]);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [topic, setTopic] = useState(topics[0] ?? "");
  const [query, setQuery] = useState("");
  const [memberFilter, setMemberFilter] = useState("todos");
  const [turnFilter, setTurnFilter] = useState("todos");
  const [scoreFilter, setScoreFilter] = useState("todos");
  const [observationFilter, setObservationFilter] = useState("todos");
  const [topicsFilter, setTopicsFilter] = useState("todos");
  const [averageFilter, setAverageFilter] = useState("todos");
  const [editing, setEditing] = useState<Integrante | null>(null);
  const [editingTopic, setEditingTopic] = useState("");
  const [editingMonth, setEditingMonth] = useState(month);
  const [scoreDraft, setScoreDraft] = useState("");
  const [observationDraft, setObservationDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const annualRecords = useMemo(() => records.filter((record) => record.year === year), [records, year]);
  const searchRows = useMemo(() => {
    const term = normalize(query);
    return members.filter((member) => !term || normalize(`${member.nombre} ${member.email ?? ""} ${member.turno}`).includes(term));
  }, [members, query]);
  const turnOptions = useMemo(() => [...new Set(members.map((member) => member.turno).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")), [members]);

  const summaries = useMemo(() => new Map(members.map((member) => {
    const memberRecords = annualRecords.filter((record) => memberMatches(record, member));
    const selectedRecords = memberRecords
      .filter((record) => record.month === month && normalize(record.topic) === normalize(topic))
      .sort((a, b) => b.rowNumber - a.rowNumber);
    return [member.id, {
      records: memberRecords,
      current: selectedRecords[0] ?? null,
      average: average(memberRecords),
      topics: new Set(memberRecords.map((record) => normalize(record.topic))).size,
    }];
  })), [annualRecords, members, month, topic]);

  const topicCountOptions = useMemo(() => [...new Set([...summaries.values()].map((summary) => summary.topics))].sort((a, b) => a - b), [summaries]);
  const rows = useMemo(() => searchRows.filter((member) => {
    const summary = summaries.get(member.id);
    const currentScore = summary?.current?.score ?? null;
    const currentObservation = summary?.current?.observation.trim() ?? "";
    const annualAverage = summary?.average ?? null;
    const scoreMatches = scoreFilter === "todos"
      || (scoreFilter === "sin-nota" && currentScore === null)
      || (scoreFilter === "baja" && currentScore !== null && currentScore < 6)
      || (scoreFilter === "media" && currentScore !== null && currentScore >= 6 && currentScore < 8)
      || (scoreFilter === "alta" && currentScore !== null && currentScore >= 8);
    const observationMatches = observationFilter === "todos"
      || (observationFilter === "con" && Boolean(currentObservation))
      || (observationFilter === "sin" && !currentObservation);
    const averageMatches = averageFilter === "todos"
      || (averageFilter === "sin-promedio" && annualAverage === null)
      || (averageFilter === "bajo" && annualAverage !== null && annualAverage < 6)
      || (averageFilter === "medio" && annualAverage !== null && annualAverage >= 6 && annualAverage < 8)
      || (averageFilter === "alto" && annualAverage !== null && annualAverage >= 8);
    return (memberFilter === "todos" || member.id === memberFilter)
      && (turnFilter === "todos" || member.turno === turnFilter)
      && scoreMatches
      && observationMatches
      && (topicsFilter === "todos" || summary?.topics === Number(topicsFilter))
      && averageMatches;
  }), [averageFilter, memberFilter, observationFilter, scoreFilter, searchRows, summaries, topicsFilter, turnFilter]);

  const evaluatedNow = [...summaries.values()].filter((summary) => summary.current?.score !== null && summary.current?.score !== undefined).length;
  const overallAverage = average(annualRecords);

  function openMember(member: Integrante) {
    const current = summaries.get(member.id)?.current ?? null;
    setEditing(member);
    setEditingTopic(topic);
    setEditingMonth(month);
    setScoreDraft(current?.score === null || current?.score === undefined ? "" : String(current.score));
    setObservationDraft(current?.observation ?? "");
    setError("");
    setNotice("");
  }

  async function refreshScoring() {
    const response = await fetch("/api/scoring", { cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(responseMessage(body));
    const snapshot = body as ScoringSnapshot;
    setRecords(snapshot.records);
    setTopics(snapshot.topics);
    if (!snapshot.topics.includes(topic)) setTopic(snapshot.topics[0] ?? "");
  }

  const filtersActive = Boolean(query)
    || memberFilter !== "todos"
    || turnFilter !== "todos"
    || scoreFilter !== "todos"
    || observationFilter !== "todos"
    || topicsFilter !== "todos"
    || averageFilter !== "todos";

  function clearFilters() {
    setQuery("");
    setMemberFilter("todos");
    setTurnFilter("todos");
    setScoreFilter("todos");
    setObservationFilter("todos");
    setTopicsFilter("todos");
    setAverageFilter("todos");
  }

  async function exportNotes() {
    setExporting(true);
    setExportError("");
    try {
      const XLSX = await import("xlsx");
      const summaryRows = rows.map((member) => {
        const summary = summaries.get(member.id);
        return {
          Integrante: member.nombre,
          "email-puente": member.email ?? "",
          Turno: member.turno,
          Año: year,
          "Nota del período": summary?.current?.score ?? "",
          "Observación del período": summary?.current?.observation ?? "",
          "Temas evaluados": summary?.topics ?? 0,
          Evaluaciones: summary?.records.filter((record) => record.score !== null).length ?? 0,
          "Promedio final": summary?.average === null || summary?.average === undefined ? "" : Number(summary.average.toFixed(2)),
        };
      });
      const detailRows = rows.flatMap((member) => (summaries.get(member.id)?.records ?? []).map((record) => ({
        Integrante: member.nombre,
        "email-puente": member.email ?? "",
        Año: record.year,
        Mes: MONTHS[record.month - 1],
        Tema: record.topic,
        Calificación: record.score ?? "",
        Observación: record.observation,
        "Actualizado el": record.updatedAt,
        "Actualizado por": record.updatedBy,
      })));
      const workbook = XLSX.utils.book_new();
      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      const detailSheet = XLSX.utils.json_to_sheet(detailRows);
      summarySheet["!cols"] = [{ wch: 32 }, { wch: 40 }, { wch: 24 }, { wch: 10 }, { wch: 18 }, { wch: 42 }, { wch: 18 }, { wch: 14 }, { wch: 16 }];
      detailSheet["!cols"] = [{ wch: 32 }, { wch: 40 }, { wch: 10 }, { wch: 13 }, { wch: 28 }, { wch: 14 }, { wch: 48 }, { wch: 24 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen");
      XLSX.utils.book_append_sheet(workbook, detailSheet, "Detalle anual");
      XLSX.writeFile(workbook, `scoring-notas-${year}.xlsx`);
    } catch {
      setExportError("No se pudo generar el archivo Excel de notas.");
    } finally {
      setExporting(false);
    }
  }

  async function save() {
    if (!editing || !editingTopic) return;
    const numericScore = scoreDraft === "" ? null : Number(scoreDraft);
    if (numericScore !== null && (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 10)) {
      setError("La calificación debe estar entre 0 y 10.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/scoring", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          memberId: editing.email?.toLowerCase() || editing.matricula,
          year,
          month: editingMonth,
          entries: [{ topic: editingTopic, score: numericScore, observation: observationDraft }],
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(responseMessage(body));
      await refreshScoring();
      setNotice("La evaluación quedó guardada en Scoring Historial.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el scoring.");
    } finally {
      setSaving(false);
    }
  }

  const editingHistory = useMemo(() => editing
    ? records.filter((record) => record.year === year && memberMatches(record, editing)).sort((a, b) => a.month - b.month || a.topic.localeCompare(b.topic, "es") || a.rowNumber - b.rowNumber)
    : [], [editing, records, year]);
  const editingAverage = average(editingHistory);

  return (
    <div className="page-stack scoring-history-page">
      <section className="surface scoring-history-hero">
        <div><p className="eyebrow">SCORING · ADMINISTRADORES Y CAPACITADORES</p><h2>Evaluaciones por tema y año</h2><p>Elegí un período y un tema. Los promedios se calculan automáticamente con todas las notas del año.</p></div>
        <div className="scoring-history-filters">
          <label><span>Año</span><select value={year} onChange={(event) => setYear(Number(event.target.value))}>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span>Mes</span><select value={month} onChange={(event) => setMonth(Number(event.target.value))}>{MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label>
          <label><span>Tema</span><select value={topic} onChange={(event) => setTopic(event.target.value)} disabled={!topics.length}>{topics.length ? topics.map((item) => <option key={item}>{item}</option>) : <option>Sin temas configurados</option>}</select></label>
        </div>
      </section>

      {!topics.length ? <p className="manager-notice"><BookOpenCheck /> Agregá al menos un tema en Configuración → Temas de scoring.</p> : null}
      {exportError ? <p className="inline-error" role="alert">{exportError}</p> : null}

      <section className="mini-metrics scoring-history-metrics">
        <div><UsersRound /><span><p>Integrantes actuales</p><strong>{members.length}</strong><small>las bajas no aparecen</small></span></div>
        <div><ClipboardCheck /><span><p>Evaluados en el período</p><strong>{evaluatedNow}</strong><small>{MONTHS[month - 1]} · {topic || "Sin tema"}</small></span></div>
        <div><CalendarRange /><span><p>Evaluaciones del año</p><strong>{annualRecords.filter((record) => record.score !== null).length}</strong><small>historial de {year}</small></span></div>
        <div><Calculator /><span><p>Promedio general</p><strong>{overallAverage === null ? "—" : overallAverage.toFixed(1)}</strong><small>promedio de todas las notas</small></span></div>
      </section>

      <section className="surface scoring-history-card">
        <header>
          <div><p className="eyebrow">{MONTHS[month - 1].toUpperCase()} · {year}</p><h2>{topic || "Seleccioná un tema"}</h2></div>
          <div className="scoring-history-actions">
            <label className="manager-search"><Search /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar integrante, email o turno…" /></label>
            <Button variant="outline" disabled={!filtersActive} onClick={clearFilters}><ListFilter /> Limpiar filtros</Button>
            <Button variant="outline" disabled={!rows.length || exporting} onClick={() => void exportNotes()}>{exporting ? <LoaderCircle className="spin" /> : <Download />} Exportar notas</Button>
          </div>
        </header>
        <div className="scoring-history-table-wrap">
          <table className="scoring-history-table">
            <thead><tr>
              <th><label className="scoring-column-filter"><span>Integrante</span><select value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)} aria-label="Filtrar por integrante"><option value="todos">Todos</option>{members.map((member) => <option key={member.id} value={member.id}>{member.nombre}</option>)}</select></label></th>
              <th><label className="scoring-column-filter"><span>Turno</span><select value={turnFilter} onChange={(event) => setTurnFilter(event.target.value)} aria-label="Filtrar por turno"><option value="todos">Todos</option>{turnOptions.map((turn) => <option key={turn}>{turn}</option>)}</select></label></th>
              <th><label className="scoring-column-filter"><span>Calificación</span><select value={scoreFilter} onChange={(event) => setScoreFilter(event.target.value)} aria-label="Filtrar por calificación"><option value="todos">Todas</option><option value="sin-nota">Sin nota</option><option value="alta">8 a 10</option><option value="media">6 a 7,9</option><option value="baja">Menor que 6</option></select></label></th>
              <th><label className="scoring-column-filter"><span>Observación</span><select value={observationFilter} onChange={(event) => setObservationFilter(event.target.value)} aria-label="Filtrar por observación"><option value="todos">Todas</option><option value="con">Con observación</option><option value="sin">Sin observación</option></select></label></th>
              <th><label className="scoring-column-filter"><span>Temas evaluados</span><select value={topicsFilter} onChange={(event) => setTopicsFilter(event.target.value)} aria-label="Filtrar por cantidad de temas"><option value="todos">Todos</option>{topicCountOptions.map((count) => <option key={count} value={count}>{count} {count === 1 ? "tema" : "temas"}</option>)}</select></label></th>
              <th><label className="scoring-column-filter"><span>Promedio {year}</span><select value={averageFilter} onChange={(event) => setAverageFilter(event.target.value)} aria-label="Filtrar por promedio anual"><option value="todos">Todos</option><option value="sin-promedio">Sin promedio</option><option value="alto">8 a 10</option><option value="medio">6 a 7,9</option><option value="bajo">Menor que 6</option></select></label></th>
              <th>Acción</th>
            </tr></thead>
            <tbody>
              {rows.map((member) => {
                const summary = summaries.get(member.id);
                return (
                  <tr key={member.id} onDoubleClick={() => openMember(member)} title="Doble clic para abrir el desarrollo anual">
                    <td><strong>{member.nombre}</strong><small>{member.email || `Matrícula ${member.matricula}`}</small></td>
                    <td>{member.turno}</td>
                    <td><Badge className={scoreClass(summary?.current?.score ?? null)}>{summary?.current?.score ?? "—"}</Badge></td>
                    <td className="scoring-history-observation">{summary?.current?.observation || "Sin observación"}</td>
                    <td>{summary?.topics ?? 0}</td>
                    <td><Badge className={scoreClass(summary?.average ?? null)}>{summary?.average === null || summary?.average === undefined ? "—" : summary.average.toFixed(1)}</Badge></td>
                    <td><Button variant="outline" size="sm" disabled={!topic} onClick={() => openMember(member)}><Pencil /> Calificar</Button></td>
                  </tr>
                );
              })}
              {!rows.length ? <tr><td colSpan={7} className="empty-cell">No hay integrantes que coincidan con los filtros seleccionados.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <footer>{rows.length} de {members.length} integrantes visibles · Hacé doble clic sobre un integrante para abrir todo lo desarrollado durante {year} y ver su nota final.</footer>
      </section>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open && !saving) setEditing(null); }}>
        <DialogContent className="scoring-history-dialog">
          <DialogHeader><DialogTitle>Desarrollo anual de {editing?.nombre}</DialogTitle><DialogDescription>Historial {year}. La nota final es el promedio automático de todas las calificaciones del año.</DialogDescription></DialogHeader>
          <section className="scoring-history-profile">
            <div><span>{editing?.nombre.slice(0, 1).toUpperCase()}</span><div><strong>{editing?.nombre}</strong><small>{editing?.turno} · Matrícula {editing?.matricula}</small></div></div>
            <div><small>Nota final {year}</small><strong>{editingAverage === null ? "—" : editingAverage.toFixed(1)}</strong><span>{editingHistory.filter((record) => record.score !== null).length} notas</span></div>
          </section>
          <section className="scoring-history-editor">
            <div className="scoring-history-editor-selects">
              <label><span>Mes</span><select value={editingMonth} onChange={(event) => {
                const nextMonth = Number(event.target.value);
                setEditingMonth(nextMonth);
                const existing = editingHistory.filter((record) => record.month === nextMonth && normalize(record.topic) === normalize(editingTopic)).at(-1);
                setScoreDraft(existing?.score === null || existing?.score === undefined ? "" : String(existing.score));
                setObservationDraft(existing?.observation ?? "");
              }}>{MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label>
              <label><span>Tema</span><select value={editingTopic} onChange={(event) => {
                const nextTopic = event.target.value;
                setEditingTopic(nextTopic);
                const existing = editingHistory.filter((record) => record.month === editingMonth && normalize(record.topic) === normalize(nextTopic)).at(-1);
                setScoreDraft(existing?.score === null || existing?.score === undefined ? "" : String(existing.score));
                setObservationDraft(existing?.observation ?? "");
              }}>{topics.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span>Calificación</span><Input type="number" min="0" max="10" step="0.1" value={scoreDraft} onChange={(event) => setScoreDraft(event.target.value)} placeholder="0 a 10" /></label>
            </div>
            <label><span>Observación</span><Textarea rows={3} maxLength={500} value={observationDraft} onChange={(event) => setObservationDraft(event.target.value)} placeholder="Qué desarrolló, fortalezas y aspectos a mejorar…" /></label>
            {notice ? <p className="success-message"><ClipboardCheck /> {notice}</p> : null}
            {error ? <p className="inline-error" role="alert">{error}</p> : null}
          </section>
          <section className="scoring-history-timeline">
            <header><div><p className="eyebrow">HISTORIAL {year}</p><h3>Temas desarrollados</h3></div><Badge variant="outline">Promedio {editingAverage === null ? "—" : editingAverage.toFixed(1)}</Badge></header>
            <div>
              {editingHistory.map((record) => <article key={record.id}><span>{MONTHS[record.month - 1].slice(0, 3)}</span><div><strong>{record.topic}</strong><p>{record.observation || "Sin observación"}</p></div><Badge className={scoreClass(record.score)}>{record.score ?? "—"}</Badge></article>)}
              {!editingHistory.length ? <p className="empty-message">Todavía no hay evaluaciones para este integrante en {year}.</p> : null}
            </div>
          </section>
          <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setEditing(null)}>Cerrar</Button><Button disabled={saving || !editingTopic} onClick={() => void save()}>{saving ? <LoaderCircle className="spin" /> : <Save />} Guardar evaluación</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
