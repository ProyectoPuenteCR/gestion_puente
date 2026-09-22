"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, CircleDollarSign, ClipboardList, FileDown, LoaderCircle, MessageSquarePlus, Save, UserRoundCheck, UserRoundX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PerformanceComment, PortalData } from "@/lib/portal-types";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function feeStatusLabel(status: string) {
  if (status === "P") return "Pagó";
  return status || "Sin cargar";
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function responseMessage(value: unknown) {
  return value && typeof value === "object" && "error" in value
    ? String((value as { error: unknown }).error)
    : "No se pudo completar la operación.";
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

export function PerformanceView({ data }: { data: PortalData }) {
  const members = useMemo(
    () => data.integrantes.filter((item) => item.email).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [data.integrantes],
  );
  const [email, setEmail] = useState(members[0]?.email ?? "");
  const years = useMemo(() => [...new Set([
    new Date().getFullYear() + 1,
    new Date().getFullYear(),
    new Date().getFullYear() - 1,
    ...data.asistencias.flatMap((item) => item.fecha ? [Number(item.fecha.slice(0, 4))] : []),
    ...data.cuotas.map((item) => item.year),
    ...data.scoringHistory.map((item) => item.year),
  ])].filter((item) => Number.isInteger(item)).sort((a, b) => b - a), [data.asistencias, data.cuotas, data.scoringHistory]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [comments, setComments] = useState<PerformanceComment[]>([]);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(Boolean(members[0]?.email));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reporting, setReporting] = useState(false);
  const member = members.find((item) => item.email === email) ?? null;

  const attendance = useMemo(() => {
    if (!member) return { present: 0, absent: 0, total: 0, rate: 0 };
    const rows = data.asistencias.filter((item) => normalize(item.nombre) === normalize(member.nombre) && item.fecha?.startsWith(`${year}-`));
    const present = rows.filter((item) => item.asistio).length;
    const absent = rows.length - present;
    return { present, absent, total: rows.length, rate: rows.length ? Math.round((present / rows.length) * 100) : 0 };
  }, [data.asistencias, member, year]);

  const socialFee = useMemo(() => {
    if (!member) return { paid: 0, debt: 0, computable: 0, rate: 0, months: MONTHS.map((name, index) => ({ name, month: index + 1, status: "" })) };
    const rows = data.cuotas.filter((item) => item.year === year && (item.email === member.email || normalize(item.name) === normalize(member.nombre)));
    const paid = rows.filter((item) => item.status === "P").length;
    const debt = rows.filter((item) => item.status === "Debe").length;
    const computable = paid + debt;
    const byMonth = new Map(rows.map((item) => [item.month, item.status]));
    const months = MONTHS.map((name, index) => ({ name, month: index + 1, status: byMonth.get(index + 1) ?? "" }));
    return { paid, debt, computable, rate: computable ? Math.round((paid / computable) * 100) : 0, months };
  }, [data.cuotas, member, year]);

  const scoring = useMemo(() => {
    if (!member) return [];
    return data.scoringHistory
      .filter((item) => item.year === year && ((member.email && item.email === member.email) || normalize(item.name) === normalize(member.nombre)))
      .sort((a, b) => a.month - b.month || a.topic.localeCompare(b.topic, "es") || a.rowNumber - b.rowNumber);
  }, [data.scoringHistory, member, year]);

  const scoringAverage = useMemo(() => {
    const values = scoring.flatMap((item) => item.score === null ? [] : [item.score]);
    return values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : "—";
  }, [scoring]);

  const allMemberScores = useMemo(() => data.integrantes.map((item) => {
    const history = data.scoringHistory
      .filter((record) => record.year === year && ((item.email && record.email === item.email) || normalize(record.name) === normalize(item.nombre)))
      .sort((a, b) => a.month - b.month || a.topic.localeCompare(b.topic, "es"));
    const scores = history.flatMap((record) => record.score === null ? [] : [record.score]);
    const result = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
    return { member: item, history, average: result, count: scores.length };
  }).sort((a, b) => (b.average ?? -1) - (a.average ?? -1) || a.member.nombre.localeCompare(b.member.nombre, "es")), [data.integrantes, data.scoringHistory, year]);

  useEffect(() => {
    if (!email) return;
    const controller = new AbortController();
    void fetch(`/api/desempenos?email=${encodeURIComponent(email)}&year=${year}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(responseMessage(body));
        setComments((body as { comments: PerformanceComment[] }).comments);
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "No se pudieron cargar los comentarios.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [email, year]);

  async function saveComment() {
    if (!email || !comment.trim()) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/desempenos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, comment, year }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(responseMessage(body));
      setComments((current) => [(body as { comment: PerformanceComment }).comment, ...current]);
      setComment("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el comentario.");
    } finally {
      setSaving(false);
    }
  }

  async function createReport() {
    if (!member) return;
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) { setError("El navegador bloqueó la ventana del reporte. Habilitá las ventanas emergentes e intentá nuevamente."); return; }
    reportWindow.document.write("<p style='font-family:Arial;padding:30px'>Preparando reporte…</p>");
    setReporting(true);
    setError("");
    try {
      const response = await fetch(`/api/desempenos?email=${encodeURIComponent(member.email ?? "")}`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(responseMessage(body));
      const allComments = (body as { comments: PerformanceComment[] }).comments;
      const reportYears = [...new Set([
        ...data.asistencias.flatMap((item) => normalize(item.nombre) === normalize(member.nombre) && item.fecha ? [Number(item.fecha.slice(0, 4))] : []),
        ...data.cuotas.flatMap((item) => (item.email === member.email || normalize(item.name) === normalize(member.nombre)) ? [item.year] : []),
        ...data.scoringHistory.flatMap((item) => ((member.email && item.email === member.email) || normalize(item.name) === normalize(member.nombre)) ? [item.year] : []),
        ...allComments.map((item) => item.anio),
      ])].filter(Number.isInteger).sort((a, b) => b - a);
      if (!reportYears.length) reportYears.push(new Date().getFullYear());
      const sections = reportYears.map((reportYear) => {
        const attendanceRows = data.asistencias.filter((item) => normalize(item.nombre) === normalize(member.nombre) && item.fecha?.startsWith(`${reportYear}-`));
        const present = attendanceRows.filter((item) => item.asistio).length;
        const absent = attendanceRows.length - present;
        const rate = attendanceRows.length ? Math.round(present / attendanceRows.length * 100) : 0;
        const feeRows = data.cuotas.filter((item) => item.year === reportYear && (item.email === member.email || normalize(item.name) === normalize(member.nombre)));
        const paid = feeRows.filter((item) => item.status === "P").length;
        const debt = feeRows.filter((item) => item.status === "Debe").length;
        const feeRate = paid + debt ? Math.round(paid / (paid + debt) * 100) : 0;
        const scores = data.scoringHistory.filter((item) => item.year === reportYear && ((member.email && item.email === member.email) || normalize(item.name) === normalize(member.nombre))).sort((a, b) => a.month - b.month);
        const numericScores = scores.flatMap((item) => item.score === null ? [] : [item.score]);
        const average = numericScores.length ? (numericScores.reduce((sum, value) => sum + value, 0) / numericScores.length).toFixed(1) : "—";
        const yearComments = allComments.filter((item) => item.anio === reportYear);
        return `<section class="year"><h2>Desempeño ${reportYear}</h2><div class="metrics"><div><small>Asistencias</small><strong>${present}</strong></div><div><small>Inasistencias</small><strong>${absent}</strong></div><div><small>Asistencia</small><strong>${rate}%</strong></div><div><small>Promedio scoring</small><strong>${average}</strong></div><div><small>Cuota anual</small><strong>${feeRate}%</strong></div></div><h3>Evaluaciones</h3>${scores.length ? `<table><thead><tr><th>Mes</th><th>Tema</th><th>Nota</th><th>Observación</th></tr></thead><tbody>${scores.map((item) => `<tr><td>${escapeHtml(MONTHS[item.month - 1])}</td><td>${escapeHtml(item.topic)}</td><td>${escapeHtml(item.score ?? "—")}</td><td>${escapeHtml(item.observation || "Sin observación")}</td></tr>`).join("")}</tbody></table>` : "<p class='empty'>Sin evaluaciones registradas.</p>"}<h3>Comentarios</h3>${yearComments.length ? `<div class="comments">${yearComments.map((item) => `<article><p>${escapeHtml(item.comentario)}</p><small>${escapeHtml(dateTime(item.fecha))} · ${escapeHtml(item.creadoPor)}</small></article>`).join("")}</div>` : "<p class='empty'>Sin comentarios registrados.</p>"}</section>`;
      }).join("");
      const photo = member.foto ? `<img src="/api/fotos/${encodeURIComponent(member.foto)}" alt="Foto del integrante">` : `<span>${escapeHtml(member.nombre.slice(0, 1).toUpperCase())}</span>`;
      reportWindow.document.open();
      reportWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Reporte - ${escapeHtml(member.nombre)}</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;color:#183149;font:12px Arial,sans-serif}header{display:flex;align-items:center;gap:18px;padding-bottom:18px;border-bottom:3px solid #078b88}header .photo{width:92px;height:92px;display:grid;place-items:center;overflow:hidden;border-radius:14px;background:#e0f4f2;color:#078b88;font-size:34px;font-weight:bold}header img{width:100%;height:100%;object-fit:cover}h1{margin:0 0 6px;font-size:25px}header p{margin:3px 0;color:#5d7081}.brand{margin-left:auto;text-align:right}.brand strong{color:#078b88}.year{padding-top:20px;break-before:page}.year:first-of-type{break-before:auto}.year h2{margin:0 0 12px;color:#078b88;font-size:21px}.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.metrics div{padding:10px;border:1px solid #dbe5ec;border-radius:8px}.metrics small{display:block;color:#738292}.metrics strong{display:block;margin-top:5px;font-size:19px}h3{margin:18px 0 8px}table{width:100%;border-collapse:collapse}th,td{padding:7px;border:1px solid #dbe3e9;text-align:left;vertical-align:top}th{background:#eef7f6}.comments article{margin-bottom:8px;padding:9px;border-left:3px solid #078b88;background:#f4f8fa}.comments p{margin:0 0 5px;white-space:pre-wrap}.comments small,.empty{color:#738292}.footer{margin-top:25px;padding-top:8px;border-top:1px solid #dbe3e9;color:#758697;font-size:9px}@media print{.year{break-inside:auto}}</style></head><body><header><div class="photo">${photo}</div><div><p>PROYECTO PUENTE · REPORTE DEL INTEGRANTE</p><h1>${escapeHtml(member.nombre)}</h1><p>${escapeHtml(member.email)} · ${escapeHtml(member.turno)}</p><p>Matrícula ${escapeHtml(member.matricula)} · Ingreso ${escapeHtml(member.anioIngreso)}</p></div><div class="brand"><strong>Proyecto Puente</strong><p>Informe histórico</p></div></header>${sections}<p class="footer">Generado el ${escapeHtml(new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeStyle: "short" }).format(new Date()))}</p><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),500));<\/script></body></html>`);
      reportWindow.document.close();
    } catch (caught) {
      reportWindow.close();
      setError(caught instanceof Error ? caught.message : "No se pudo generar el reporte.");
    } finally {
      setReporting(false);
    }
  }

  return (
    <div className="page-stack performance-page">
      <section className="surface performance-hero">
        <div><p className="eyebrow">SEGUIMIENTO · SOLO ADMINISTRADORES</p><h2>Desempeños</h2><p>Una vista por integrante con asistencia, faltas, scoring y observaciones de seguimiento.</p></div>
        <div className="performance-selectors"><label><span>Integrante</span><select value={email} onChange={(event) => { setLoading(true); setError(""); setComments([]); setEmail(event.target.value); }}>{members.map((item) => <option key={item.id} value={item.email}>{item.nombre}</option>)}</select></label><label><span>Año</span><select value={year} onChange={(event) => { setLoading(true); setError(""); setComments([]); setYear(Number(event.target.value)); }}>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><Button disabled={reporting || !member} onClick={() => void createReport()}>{reporting ? <LoaderCircle className="spin" /> : <FileDown />} Reporte del integrante</Button></div>
      </section>

      {member ? (
        <>
          <section className="performance-profile surface"><div>{member.foto ? <span className="performance-photo"><img src={`/api/fotos/${encodeURIComponent(member.foto)}`} alt={`Foto de ${member.nombre}`} /></span> : <span>{member.nombre.slice(0, 1).toUpperCase()}</span>}<div><p className="eyebrow">INTEGRANTE SELECCIONADO</p><h2>{member.nombre}</h2><small>{member.email} · {member.turno}</small></div></div><Badge variant="outline">Matrícula {member.matricula}</Badge></section>
          <section className="mini-metrics performance-metrics">
            <div><UserRoundCheck /><span><p>Asistencias</p><strong>{attendance.present}</strong><small>{attendance.total} registros</small></span></div>
            <div><UserRoundX /><span><p>Inasistencias</p><strong>{attendance.absent}</strong><small>Faltas explícitas</small></span></div>
            <div><Activity /><span><p>Porcentaje</p><strong>{attendance.rate}%</strong><small>asistencia acumulada</small></span></div>
            <div><ClipboardList /><span><p>Promedio scoring</p><strong>{scoringAverage}</strong><small>{scoring.filter((item) => item.score !== null).length} evaluaciones en {year}</small></span></div>
            <div><CircleDollarSign /><span><p>Cumplimiento anual cuota</p><strong>{socialFee.rate}%</strong><small>{socialFee.paid} pagadas · {socialFee.debt} adeudadas</small></span></div>
          </section>

          <section className="surface performance-fee-detail">
            <header><div><p className="eyebrow">CUOTA SOCIAL · {year}</p><h2>Cumplimiento mensual</h2></div><Badge variant="outline">Tasa anual: {socialFee.rate}%</Badge></header>
            <div className="performance-fee-progress" aria-label={`Cumplimiento anual de cuota ${socialFee.rate}%`}><span style={{ width: `${socialFee.rate}%` }} /></div>
            <div className="performance-fee-months">{socialFee.months.map((item) => <article key={item.month}><strong>{item.name}</strong><Badge className={`fee-status fee-status-${item.status ? normalize(item.status) : "empty"}`}>{feeStatusLabel(item.status)}</Badge></article>)}</div>
            <p>El porcentaje usa únicamente Pagó y Debe. Beca, Baja y Exento no intervienen en el cálculo.</p>
          </section>

          <section className="performance-layout">
            <article className="surface performance-scoring">
              <header><div><p className="eyebrow">HISTORIAL SCORING · {year}</p><h2>Temas desarrollados</h2></div><Badge>Promedio: {scoringAverage}</Badge></header>
              <div className="performance-score-list">
                {scoring.map((result) => <div key={result.id}><span><small>{MONTHS[result.month - 1]} · {result.year}</small><strong>{result.topic}</strong><p>{result.observation || "Sin observación"}</p></span><Badge className={result.score === null ? "fee-status-empty" : result.score >= 8 ? "score-high" : result.score >= 6 ? "score-medium" : "score-low"}>{result.score ?? "—"}</Badge></div>)}
                {!scoring.length ? <p className="empty-message">Este integrante todavía no tiene evaluaciones en {year}.</p> : null}
              </div>
            </article>

            <article className="surface performance-comments">
              <header><MessageSquarePlus /><div><p className="eyebrow">SEGUIMIENTO · {year}</p><h2>Comentarios</h2></div></header>
              <Textarea maxLength={1500} rows={4} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Escribí una observación sobre el desempeño…" />
              <div className="performance-comment-actions"><small>{comment.length}/1500</small><Button disabled={saving || !comment.trim()} onClick={() => void saveComment()}>{saving ? <LoaderCircle className="spin" /> : <Save />} Guardar comentario</Button></div>
              {error ? <p className="inline-error" role="alert">{error}</p> : null}
              <div className="performance-comment-list">
                {loading ? <p className="manager-loading"><LoaderCircle className="spin" /> Cargando comentarios…</p> : comments.map((item) => <div key={item.id}><span>{item.creadoPor.slice(0, 1).toUpperCase()}</span><div><strong>{item.creadoPor}</strong><small>{dateTime(item.fecha)}</small><p>{item.comentario}</p></div></div>)}
                {!loading && !comments.length ? <p className="empty-message">Todavía no hay comentarios para este integrante.</p> : null}
              </div>
            </article>
          </section>

          <section className="surface performance-all-scores">
            <header><div><p className="eyebrow">NOTAS DE TODOS LOS INTEGRANTES · {year}</p><h2>Promedios y temas desarrollados</h2></div><Badge variant="outline">{allMemberScores.length} integrantes actuales</Badge></header>
            <div className="performance-all-scores-wrap">
              <table>
                <thead><tr><th>Integrante</th><th>Temas y notas</th><th>Evaluaciones</th><th>Promedio final</th></tr></thead>
                <tbody>
                  {allMemberScores.map((item) => <tr key={item.member.id}><td><strong>{item.member.nombre}</strong><small>{item.member.turno}</small></td><td><div className="performance-score-chips">{item.history.filter((record) => record.score !== null).map((record) => <Badge key={record.id} variant="outline">{MONTHS[record.month - 1].slice(0, 3)} · {record.topic}: {record.score}</Badge>)}{!item.count ? <span>Sin notas en {year}</span> : null}</div></td><td>{item.count}</td><td><Badge className={item.average === null ? "fee-status-empty" : item.average >= 8 ? "score-high" : item.average >= 6 ? "score-medium" : "score-low"}>{item.average === null ? "—" : item.average.toFixed(1)}</Badge></td></tr>)}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : <section className="surface empty-message">No hay integrantes con email-puente para mostrar.</section>}
    </div>
  );
}
