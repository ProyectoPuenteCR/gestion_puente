"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  CalendarDays,
  Download,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { HistoricalMemberRecord, MemberFieldValue } from "@/lib/portal-types";

const NAME = "Apellidos y nombres ( Del integrante )";
const DNI = "DNI";
const EMAIL = "email-puente";
const PHONE = "CELULAR";
const PERSONAL_EMAIL = "Dirección de correo electrónico";
const ADDRESS = "Dirección Actual donde vivo";
const ENTRY_YEAR = "Año de ingreso al Proyecto";
const SCHEDULE = "Horario en que asisto al proyecto";

type HistoricalPayload = {
  headers: string[];
  rows: HistoricalMemberRecord[];
};

function apiMessage(body: unknown) {
  if (body && typeof body === "object" && "error" in body) return String((body as { error: unknown }).error);
  return "No se pudo cargar el historial de integrantes.";
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "PP";
}

function normalized(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function valueOf(row: HistoricalMemberRecord, field: string) {
  return String(row.values[field] ?? "").trim();
}

function DetailLine({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
  return (
    <div className="historical-detail-line">
      <Icon />
      <span><small>{label}</small><strong>{value || "—"}</strong></span>
    </div>
  );
}

export function HistoricalMembersManager() {
  const [payload, setPayload] = useState<HistoricalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("all");
  const [selectedId, setSelectedId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/integrantes-historicos", { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiMessage(body));
      setPayload(body as HistoricalPayload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar el historial de integrantes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const years = useMemo(
    () => [...new Set((payload?.rows ?? []).map((row) => {
      const date = new Date(row.bajaDate);
      return Number.isNaN(date.getTime()) ? "" : String(date.getFullYear());
    }).filter(Boolean))].sort((a, b) => b.localeCompare(a)),
    [payload?.rows],
  );

  const rows = useMemo(() => {
    const term = normalized(search.trim());
    return (payload?.rows ?? []).filter((row) => {
      const rowYear = (() => {
        const date = new Date(row.bajaDate);
        return Number.isNaN(date.getTime()) ? "" : String(date.getFullYear());
      })();
      const haystack = normalized([
        row.reason,
        row.deactivatedBy,
        ...Object.values(row.values),
      ].join(" "));
      return (year === "all" || rowYear === year) && (!term || haystack.includes(term));
    });
  }, [payload?.rows, search, year]);

  const selected = rows.find((row) => row.id === selectedId)
    ?? payload?.rows.find((row) => row.id === selectedId)
    ?? null;

  async function exportExcel() {
    if (!payload) return;
    const XLSX = await import("xlsx");
    const headers = ["Fecha de Baja", "Motivo de Baja", "Dado de baja por", ...payload.headers];
    const matrix = [
      headers,
      ...rows.map((row) => [
        row.bajaDate,
        row.reason,
        row.deactivatedBy,
        ...payload.headers.map((header) => row.values[header] ?? ""),
      ]),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(matrix);
    worksheet["!cols"] = headers.map((header) => ({ wch: Math.min(45, Math.max(14, header.length + 2)) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Integrantes Historicos");
    XLSX.writeFile(workbook, `integrantes-historicos-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (loading && !payload) {
    return <section className="surface manager-loading"><LoaderCircle className="spin" /><span>Cargando integrantes históricos…</span></section>;
  }

  if (!payload) {
    return <section className="surface manager-error"><p>{error || "No se pudo abrir el historial."}</p><Button onClick={() => void load()}><RefreshCw /> Reintentar</Button></section>;
  }

  return (
    <div className="page-stack historical-members-page">
      <section className="surface historical-hero">
        <div>
          <p className="eyebrow">ARCHIVO DE BAJAS</p>
          <h2>Integrantes históricos</h2>
          <p>Las bajas se conservan completas en la hoja <strong>Baja Integrantes</strong>. El primer dato de cada registro es la fecha de baja.</p>
        </div>
        <div className="historical-hero-stat">
          <span><Archive /></span>
          <div><strong>{payload.rows.length}</strong><small>Bajas registradas</small></div>
        </div>
      </section>

      <section className="surface historical-browser">
        <div className="historical-toolbar">
          <label className="historical-search"><Search /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, DNI, email, motivo…" /></label>
          <label className="historical-year">
            <span>Año de baja</span>
            <select value={year} onChange={(event) => setYear(event.target.value)}>
              <option value="all">Todos</option>
              {years.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <Button variant="outline" onClick={() => void exportExcel()}><Download /> Exportar Excel</Button>
          <Button variant="outline" size="icon" onClick={() => void load()} aria-label="Actualizar historial"><RefreshCw /></Button>
        </div>

        {error ? <p className="inline-error">{error}</p> : null}

        <div className={`historical-layout ${selected ? "has-detail" : ""}`}>
          <div className="historical-table-wrap">
            <table className="historical-table">
              <thead>
                <tr>
                  <th>Fecha de baja</th>
                  <th>Integrante</th>
                  <th>DNI</th>
                  <th>Email Puente</th>
                  <th>Celular</th>
                  <th>Año ingreso</th>
                  <th>Motivo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const name = valueOf(row, NAME);
                  return (
                    <tr key={row.id} className={selectedId === row.id ? "selected" : ""} onClick={() => setSelectedId(row.id)}>
                      <td><strong>{formatDate(row.bajaDate)}</strong></td>
                      <td><div className="historical-person"><span>{initials(name)}</span><div><strong>{name || "Sin nombre"}</strong><small>{valueOf(row, PERSONAL_EMAIL) || "Sin email personal"}</small></div></div></td>
                      <td>{valueOf(row, DNI) || "—"}</td>
                      <td>{valueOf(row, EMAIL) || "—"}</td>
                      <td>{valueOf(row, PHONE) || "—"}</td>
                      <td>{valueOf(row, ENTRY_YEAR) || "—"}</td>
                      <td><span className="historical-reason">{row.reason || "Sin motivo"}</span></td>
                      <td><Button variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); setSelectedId(row.id); }}>Ver</Button></td>
                    </tr>
                  );
                })}
                {!rows.length ? <tr><td colSpan={8} className="empty-cell">No hay integrantes históricos para los filtros seleccionados.</td></tr> : null}
              </tbody>
            </table>
          </div>

          {selected ? (
            <aside className="historical-detail">
              <header>
                <span className="historical-detail-avatar">{initials(valueOf(selected, NAME))}</span>
                <div><h3>{valueOf(selected, NAME)}</h3><p>Baja: {formatDate(selected.bajaDate)}</p></div>
                <button type="button" onClick={() => setSelectedId("")} aria-label="Cerrar detalle"><X /></button>
              </header>

              <section className="historical-reason-card">
                <small>Motivo de la baja</small>
                <strong>{selected.reason || "Sin motivo registrado"}</strong>
                <span>Registrada por {selected.deactivatedBy || "—"}</span>
              </section>

              <section>
                <h4>Datos de contacto</h4>
                <DetailLine icon={UserRound} label="DNI" value={valueOf(selected, DNI)} />
                <DetailLine icon={Phone} label="Celular" value={valueOf(selected, PHONE)} />
                <DetailLine icon={Mail} label="Email Puente" value={valueOf(selected, EMAIL)} />
                <DetailLine icon={Mail} label="Email personal" value={valueOf(selected, PERSONAL_EMAIL)} />
                <DetailLine icon={MapPin} label="Dirección" value={valueOf(selected, ADDRESS)} />
              </section>

              <section>
                <h4>Datos del Proyecto</h4>
                <DetailLine icon={CalendarDays} label="Año de ingreso" value={valueOf(selected, ENTRY_YEAR)} />
                <DetailLine icon={CalendarDays} label="Turno / horario" value={valueOf(selected, SCHEDULE)} />
              </section>

              <details className="historical-all-data">
                <summary>Ver todos los datos guardados</summary>
                <div>
                  {payload.headers.map((header) => (
                    <p key={header}><small>{header}</small><strong>{String((selected.values[header] as MemberFieldValue) ?? "") || "—"}</strong></p>
                  ))}
                </div>
              </details>
            </aside>
          ) : null}
        </div>

        <footer className="historical-footer">{rows.length} registro{rows.length === 1 ? "" : "s"} visibles</footer>
      </section>
    </div>
  );
}