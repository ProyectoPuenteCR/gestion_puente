import type { MemberRecord, PerformanceComment, PortalData } from "@/lib/portal-types";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const OMITTED_FIELDS = new Set(["Foto", "Marca temporal"]);

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function label(header: string) {
  const labels: Record<string, string> = {
    "Numero de orden": "N.º de orden", "Numero de Matricula": "N.º de matrícula",
    "Apellidos y nombres ( Del integrante )": "Apellidos y nombres", "email-puente": "Email Puente",
    "Fecha de Nacimiento": "Fecha de nacimiento", "Año de ingreso al Proyecto": "Año de ingreso",
  };
  return labels[header] ?? header;
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function memberReportHtml(memberRecord: MemberRecord, data: PortalData, comments: PerformanceComment[]) {
  const values = memberRecord.values;
  const name = String(values["Apellidos y nombres ( Del integrante )"] ?? "Integrante");
  const email = String(values["email-puente"] ?? "").trim().toLowerCase();
  const photoId = String(values.Foto ?? "");
  const member = data.integrantes.find((item) => item.email === email || normalize(item.nombre) === normalize(name));
  const years = [...new Set([
    ...data.asistencias.flatMap((item) => normalize(item.nombre) === normalize(name) && item.fecha ? [Number(item.fecha.slice(0, 4))] : []),
    ...data.cuotas.flatMap((item) => (item.email === email || normalize(item.name) === normalize(name)) ? [item.year] : []),
    ...data.scoringHistory.flatMap((item) => (item.email === email || normalize(item.name) === normalize(name)) ? [item.year] : []),
    ...comments.map((item) => item.anio),
  ])].filter(Number.isInteger).sort((a, b) => b - a);
  if (!years.length) years.push(new Date().getFullYear());

  const personalRows = Object.entries(values)
    .filter(([header, value]) => !OMITTED_FIELDS.has(header) && String(value ?? "").trim())
    .map(([header, value]) => `<div class="field"><small>${escapeHtml(label(header))}</small><strong>${escapeHtml(typeof value === "boolean" ? (value ? "Sí" : "No") : value)}</strong></div>`)
    .join("");

  const yearSections = years.map((year) => {
    const attendance = data.asistencias.filter((item) => normalize(item.nombre) === normalize(name) && item.fecha?.startsWith(`${year}-`));
    const present = attendance.filter((item) => item.asistio).length;
    const absent = attendance.length - present;
    const attendanceRate = attendance.length ? Math.round(present / attendance.length * 100) : 0;
    const fees = data.cuotas.filter((item) => item.year === year && (item.email === email || normalize(item.name) === normalize(name)));
    const paid = fees.filter((item) => item.status === "P").length;
    const debt = fees.filter((item) => item.status === "Debe").length;
    const feeRate = paid + debt ? Math.round(paid / (paid + debt) * 100) : 0;
    const scores = data.scoringHistory.filter((item) => item.year === year && (item.email === email || normalize(item.name) === normalize(name))).sort((a, b) => a.month - b.month);
    const scoreValues = scores.flatMap((item) => item.score === null ? [] : [item.score]);
    const average = scoreValues.length ? (scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length).toFixed(1) : "—";
    const yearComments = comments.filter((item) => item.anio === year);
    return `<section class="year"><h2>Desempeño ${year}</h2><div class="metrics"><div><small>Asistencias</small><strong>${present}</strong></div><div><small>Inasistencias</small><strong>${absent}</strong></div><div><small>Asistencia</small><strong>${attendanceRate}%</strong></div><div><small>Promedio scoring</small><strong>${average}</strong></div><div><small>Cuota anual</small><strong>${feeRate}%</strong></div></div><h3>Evaluaciones y observaciones</h3>${scores.length ? `<table><thead><tr><th>Mes</th><th>Tema</th><th>Nota</th><th>Observación</th></tr></thead><tbody>${scores.map((item) => `<tr><td>${escapeHtml(MONTHS[item.month - 1])}</td><td>${escapeHtml(item.topic)}</td><td>${escapeHtml(item.score ?? "—")}</td><td>${escapeHtml(item.observation || "Sin observación")}</td></tr>`).join("")}</tbody></table>` : "<p class='empty'>Sin evaluaciones registradas.</p>"}<h3>Comentarios de seguimiento</h3>${yearComments.length ? `<div class="comments">${yearComments.map((item) => `<article><p>${escapeHtml(item.comentario)}</p><small>${escapeHtml(dateTime(item.fecha))} · ${escapeHtml(item.creadoPor)}</small></article>`).join("")}</div>` : "<p class='empty'>Sin comentarios registrados.</p>"}</section>`;
  }).join("");

  const photo = photoId ? `<img src="/api/fotos/${encodeURIComponent(photoId)}" alt="Foto de ${escapeHtml(name)}">` : `<span>${escapeHtml(name.slice(0, 1).toUpperCase())}</span>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Reporte integral - ${escapeHtml(name)}</title><style>@page{size:A4;margin:13mm}*{box-sizing:border-box}body{margin:0;color:#183149;font:11px Arial,sans-serif}header{display:flex;align-items:center;gap:18px;padding-bottom:17px;border-bottom:3px solid #078b88}.photo{width:105px;height:105px;display:grid;place-items:center;overflow:hidden;flex:0 0 auto;border-radius:14px;background:#e0f4f2;color:#078b88;font-size:38px;font-weight:bold}.photo img{width:100%;height:100%;object-fit:cover}h1{margin:0 0 6px;font-size:25px}header p{margin:3px 0;color:#5d7081}.brand{margin-left:auto;text-align:right}.brand strong{color:#078b88}.personal{padding-top:18px}.personal h2,.year h2{margin:0 0 12px;color:#078b88;font-size:20px}.personal-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.field{padding:8px 10px;border:1px solid #dbe5ec;border-radius:7px;break-inside:avoid}.field small{display:block;margin-bottom:4px;color:#738292}.field strong{display:block;white-space:pre-wrap;font-weight:600}.year{padding-top:20px;break-before:page}.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.metrics div{padding:9px;border:1px solid #dbe5ec;border-radius:7px}.metrics small{display:block;color:#738292}.metrics strong{display:block;margin-top:5px;font-size:18px}h3{margin:17px 0 8px}table{width:100%;border-collapse:collapse}th,td{padding:7px;border:1px solid #dbe3e9;text-align:left;vertical-align:top}th{background:#eef7f6}.comments article{margin-bottom:7px;padding:9px;border-left:3px solid #078b88;background:#f4f8fa;break-inside:avoid}.comments p{margin:0 0 5px;white-space:pre-wrap}.comments small,.empty{color:#738292}.footer{margin-top:24px;padding-top:8px;border-top:1px solid #dbe3e9;color:#758697;font-size:9px}</style></head><body><header><div class="photo">${photo}</div><div><p>PROYECTO PUENTE · REPORTE INTEGRAL</p><h1>${escapeHtml(name)}</h1><p>${escapeHtml(email)} · ${escapeHtml(member?.turno ?? values["Horario en que asisto al proyecto"] ?? "")}</p><p>Matrícula ${escapeHtml(values["Numero de Matricula"] ?? member?.matricula ?? "—")}</p></div><div class="brand"><strong>Proyecto Puente</strong><p>Datos personales y desempeño</p></div></header><section class="personal"><h2>Datos personales</h2><div class="personal-grid">${personalRows}</div></section>${yearSections}<p class="footer">Generado el ${escapeHtml(new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeStyle: "short" }).format(new Date()))}</p><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),500));<\/script></body></html>`;
}
