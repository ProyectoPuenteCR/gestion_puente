"use client";

import { useMemo, useState } from "react";
import { CakeSlice, CalendarDays, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Cumpleanios } from "@/lib/portal-types";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function BirthdayRow({ item, showPrivateDetails = false, showBirthYear = false }: { item: Cumpleanios; showPrivateDetails?: boolean; showBirthYear?: boolean }) {
  return (
    <div className="birthday-grid-row">
      <span className="birthday-day">{String(item.dia).padStart(2, "0")}</span>
      <div>
        <strong>{item.nombre}</strong>
        <p>{showPrivateDetails ? (showBirthYear ? `Fecha de nacimiento: ${dateLabel(item.fechaNacimiento)}` : `Cumple ${item.edadCumple} años`) : `Cumpleaños: ${String(item.dia).padStart(2, "0")} de ${MONTHS[item.mes - 1]}`}</p>
      </div>
      <Badge className="birthday-days">
        {item.diasRestantes === 0 ? "Hoy" : item.diasRestantes === 1 ? "Mañana" : `${item.diasRestantes} días`}
      </Badge>
    </div>
  );
}

export function BirthdaysView({ items, showPrivateDetails = false }: { items: Cumpleanios[]; showPrivateDetails?: boolean }) {
  const [mode, setMode] = useState<"meses" | "proximos" | "nacimiento">("meses");
  const byBirthDate = useMemo(
    () => [...items].sort((a, b) => b.fechaNacimiento.localeCompare(a.fechaNacimiento) || a.nombre.localeCompare(b.nombre, "es")),
    [items],
  );

  return (
    <div className="page-stack">
      <section className="surface birthday-toolbar">
        <div><p className="eyebrow">CALCULADO DESDE INTEGRANTES</p><h2>Calendario de cumpleaños</h2><p>{items.length} integrantes con fecha de nacimiento cargada.</p></div>
        <div className="birthday-mode" role="group" aria-label="Orden del calendario">
          <Button variant={mode === "meses" ? "default" : "outline"} onClick={() => setMode("meses")}><CalendarDays /> Por meses</Button>
          <Button variant={mode === "proximos" ? "default" : "outline"} onClick={() => setMode("proximos")}><Clock3 /> Próximos</Button>
          {showPrivateDetails ? <Button variant={mode === "nacimiento" ? "default" : "outline"} onClick={() => setMode("nacimiento")}><CakeSlice /> Nacimiento reciente</Button> : null}
        </div>
      </section>

      {mode === "meses" ? (
        <section className="birthday-month-grid">
          {MONTHS.map((month, index) => {
            const rows = items.filter((item) => item.mes === index + 1).sort((a, b) => a.dia - b.dia || a.nombre.localeCompare(b.nombre, "es"));
            return (
              <article className="surface birthday-month" key={month}>
                <header><span>{String(index + 1).padStart(2, "0")}</span><div><p>MES</p><h3>{month}</h3></div><Badge variant="outline">{rows.length}</Badge></header>
                <div>{rows.map((item) => <BirthdayRow key={item.id} item={item} showPrivateDetails={showPrivateDetails} />)}{!rows.length ? <p className="birthday-empty">Sin cumpleaños cargados</p> : null}</div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="surface birthday-list-card">
          <div className="section-heading"><div><p className="eyebrow">{mode === "proximos" ? "ORDEN CRONOLÓGICO" : "MÁS RECIENTES A MÁS ANTIGUAS"}</p><h2>{mode === "proximos" ? "Próximos cumpleaños" : "Fechas de nacimiento"}</h2></div></div>
          <div className="birthday-long-list">
            {(mode === "proximos" ? items : byBirthDate).map((item) => <BirthdayRow key={item.id} item={item} showPrivateDetails={showPrivateDetails} showBirthYear={mode === "nacimiento"} />)}
          </div>
        </section>
      )}
    </div>
  );
}
