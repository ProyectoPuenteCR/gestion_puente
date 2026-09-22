"use client";

import { useMemo, useState } from "react";
import { Activity, ArrowDown, ArrowUp, ArrowUpDown, Medal, UserRoundCheck, UserRoundX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Asistencia } from "@/lib/portal-types";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const WEEK = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
type SortKey = "fecha" | "nombre" | "turno" | "resultado" | "motivo";

function dateLabel(value: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function SortIndicator({ active, direction }: { active: boolean; direction: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown />;
  return direction === "asc" ? <ArrowUp /> : <ArrowDown />;
}

export function AttendanceCalendar({ rows }: { rows: Asistencia[] }) {
  const datedRows = useMemo(() => rows.filter((row): row is Asistencia & { fecha: string } => Boolean(row.fecha)), [rows]);
  const years = useMemo(() => [...new Set(datedRows.map((row) => Number(row.fecha.slice(0, 4))).filter(Number.isFinite))].sort((a, b) => b - a), [datedRows]);
  const latest = datedRows.reduce((value, row) => row.fecha > value ? row.fecha : value, "");
  const [year, setYear] = useState(() => Number(latest.slice(0, 4)) || new Date().getFullYear());
  const [month, setMonth] = useState(() => {
    const parsed = Number(latest.slice(5, 7));
    return parsed >= 1 && parsed <= 12 ? parsed - 1 : new Date().getMonth();
  });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "nombre", direction: "asc" });

  const yearRows = datedRows.filter((row) => Number(row.fecha.slice(0, 4)) === year);
  const monthRows = yearRows.filter((row) => Number(row.fecha.slice(5, 7)) === month + 1);
  const present = monthRows.filter((row) => row.asistio).length;
  const absent = monthRows.length - present;
  const rate = monthRows.length ? Math.round((present / monthRows.length) * 100) : 0;

  const daily = useMemo(() => {
    const map = new Map<number, { presentes: number; ausentes: number; total: number }>();
    for (const row of monthRows) {
      const day = Number(row.fecha.slice(8, 10));
      const current = map.get(day) ?? { presentes: 0, ausentes: 0, total: 0 };
      current.total += 1;
      if (row.asistio) current.presentes += 1; else current.ausentes += 1;
      map.set(day, current);
    }
    return map;
  }, [monthRows]);

  const calendarDays = useMemo(() => {
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const count = new Date(year, month + 1, 0).getDate();
    return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)];
  }, [year, month]);

  const rankings = useMemo(() => {
    const totals = new Map<string, { presentes: number; ausentes: number }>();
    for (const row of yearRows) {
      const item = totals.get(row.nombre) ?? { presentes: 0, ausentes: 0 };
      if (row.asistio) item.presentes += 1; else item.ausentes += 1;
      totals.set(row.nombre, item);
    }
    const all = [...totals].map(([nombre, counts]) => ({ nombre, ...counts }));
    return {
      presentes: [...all].sort((a, b) => b.presentes - a.presentes || a.nombre.localeCompare(b.nombre, "es")).slice(0, 5),
      ausentes: [...all].filter((item) => item.ausentes > 0).sort((a, b) => b.ausentes - a.ausentes || a.nombre.localeCompare(b.nombre, "es")).slice(0, 5),
    };
  }, [yearRows]);

  const detailRows = useMemo(() => {
    const selected = selectedDay === null ? monthRows : monthRows.filter((row) => Number(row.fecha.slice(8, 10)) === selectedDay);
    return [...selected].sort((a, b) => {
      const aValue = sort.key === "resultado" ? (a.asistio ? "asistencia" : "falta") : String(a[sort.key] ?? "");
      const bValue = sort.key === "resultado" ? (b.asistio ? "asistencia" : "falta") : String(b[sort.key] ?? "");
      const comparison = aValue.localeCompare(bValue, "es", { numeric: true, sensitivity: "base" });
      return sort.direction === "asc" ? comparison : -comparison;
    });
  }, [monthRows, selectedDay, sort]);

  function changeSort(key: SortKey) {
    setSort((current) => current.key === key
      ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
      : { key, direction: "asc" });
  }

  return (
    <div className="page-stack">
      <section className="surface attendance-toolbar">
        <div><p className="eyebrow">CONTROL DE ASISTENCIA</p><h2>Calendario y seguimiento</h2><p>Elegí el período para recalcular el calendario, las etiquetas y los rankings.</p></div>
        <div className="attendance-selectors">
          <label><span>Año</span><select value={year} onChange={(event) => { setYear(Number(event.target.value)); setSelectedDay(null); }}>{years.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Mes</span><select value={month} onChange={(event) => { setMonth(Number(event.target.value)); setSelectedDay(null); }}>{MONTHS.map((item, index) => <option key={item} value={index}>{item}</option>)}</select></label>
        </div>
      </section>

      <section className="mini-metrics attendance-metrics">
        <div><UserRoundCheck /><span><p>Asistencias</p><strong>{present}</strong><small>{MONTHS[month]} {year}</small></span></div>
        <div><UserRoundX /><span><p>Faltas registradas</p><strong>{absent}</strong><small>Ausencias explícitas</small></span></div>
        <div><Activity /><span><p>Porcentaje</p><strong>{rate}%</strong><small>{monthRows.length} registros</small></span></div>
      </section>

      <section className="attendance-layout">
        <article className="surface attendance-calendar-card">
          <header><div><p className="eyebrow">VISTA MENSUAL</p><h2>{MONTHS[month]} {year}</h2></div>{selectedDay ? <button onClick={() => setSelectedDay(null)}>Quitar filtro del día {selectedDay}</button> : null}</header>
          <div className="calendar-week">{WEEK.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-grid">
            {calendarDays.map((day, index) => {
              const counts = day ? daily.get(day) : null;
              return day ? (
                <button key={day} className={selectedDay === day ? "selected" : ""} onClick={() => setSelectedDay(day)}>
                  <strong>{day}</strong>
                  {counts ? <span><i className="present-dot" />{counts.presentes} asist. {counts.ausentes ? <><i className="absent-dot" />{counts.ausentes} faltas</> : null}</span> : <small>Sin registros</small>}
                </button>
              ) : <span className="calendar-blank" key={`blank-${index}`} />;
            })}
          </div>
        </article>

        <aside className="attendance-rankings">
          <article className="surface ranking-card"><header><Medal /><div><p className="eyebrow">AÑO {year}</p><h3>Quienes más vienen</h3></div></header>{rankings.presentes.map((item, index) => <div className="ranking-row" key={item.nombre}><b>{index + 1}</b><span>{item.nombre}<small>{item.presentes} asistencias</small></span></div>)}</article>
          <article className="surface ranking-card absent-ranking"><header><UserRoundX /><div><p className="eyebrow">AÑO {year}</p><h3>Quienes más faltan</h3></div></header>{rankings.ausentes.map((item, index) => <div className="ranking-row" key={item.nombre}><b>{index + 1}</b><span>{item.nombre}<small>{item.ausentes} faltas</small></span></div>)}{!rankings.ausentes.length ? <p className="ranking-empty">No hay faltas explícitas para este año.</p> : null}</article>
        </aside>
      </section>

      <section className="surface attendance-detail">
        <div className="section-heading"><div><p className="eyebrow">DETALLE</p><h2>{selectedDay ? `Registros del ${selectedDay} de ${MONTHS[month].toLowerCase()}` : `Registros de ${MONTHS[month].toLowerCase()}`}</h2></div><Badge variant="outline">{detailRows.length} registros</Badge></div>
        <div className="attendance-detail-scroll"><table><thead><tr><th><button className="sort-heading" onClick={() => changeSort("fecha")}>Fecha <SortIndicator active={sort.key === "fecha"} direction={sort.direction} /></button></th><th><button className="sort-heading" onClick={() => changeSort("nombre")}>Integrante <SortIndicator active={sort.key === "nombre"} direction={sort.direction} /></button></th><th><button className="sort-heading" onClick={() => changeSort("turno")}>Turno <SortIndicator active={sort.key === "turno"} direction={sort.direction} /></button></th><th><button className="sort-heading" onClick={() => changeSort("resultado")}>Resultado <SortIndicator active={sort.key === "resultado"} direction={sort.direction} /></button></th><th><button className="sort-heading" onClick={() => changeSort("motivo")}>Motivo <SortIndicator active={sort.key === "motivo"} direction={sort.direction} /></button></th></tr></thead><tbody>{detailRows.slice(0, 200).map((row) => <tr key={row.id}><td>{dateLabel(row.fecha)}</td><td><strong>{row.nombre}</strong></td><td>{row.turno}</td><td><Badge className={row.asistio ? "status-active" : "status-absent"}>{row.asistio ? "Asistencia" : "Falta"}</Badge></td><td>{row.motivo || "—"}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}
