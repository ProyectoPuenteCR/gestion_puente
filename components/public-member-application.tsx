"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, LoaderCircle, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ConfigItem, MemberFieldValue } from "@/lib/portal-types";

const NAME = "Apellidos y nombres ( Del integrante )";
const PHONE = "CELULAR";
const ADDRESS = "Dirección Actual donde vivo";
const BIRTHDAY = "Fecha de Nacimiento";
const SCHEDULE = "Horario en que asisto al proyecto";
const ACTIVITY = "Que actividad te gustaria realizar este año";
const TITLE = "Titulo obtenido o en curso";

type PublicPayload = {
  expiresAt: string;
  headers: string[];
  config: ConfigItem[];
};

const REQUIRED = new Set([NAME, PHONE, ADDRESS]);
const TEXTAREAS = new Set([
  "Por que me gusta participar del proyecto?",
  "Que me gustaría cambiar del Proyecto",
  "Quiero dejar un comentario",
  ADDRESS,
  "Estoy estudiando?",
  "Si posee obra social indique cual",
  "En caso de emergencia avisar a ( indicar nombre y celular)",
  "Posee algún tipo de enfermedad patología que requiera algún cuidado especial",
  "Dirección del responsable",
]);

function labelFor(header: string) {
  const labels: Record<string, string> = {
    [NAME]: "Nombre y apellido",
    [PHONE]: "Teléfono / celular",
    [ADDRESS]: "Dirección actual",
    [BIRTHDAY]: "Fecha de nacimiento",
    [SCHEDULE]: "Horario en que podría asistir",
    [ACTIVITY]: "Actividad que te gustaría realizar",
    [TITLE]: "Título obtenido o en curso",
    "Dirección de correo electrónico": "Correo electrónico personal",
  };
  return labels[header] ?? header;
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function PublicMemberApplication({ token }: { token: string }) {
  const [payload, setPayload] = useState<PublicPayload | null>(null);
  const [values, setValues] = useState<Record<string, MemberFieldValue>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!token) {
        setError("El enlace de invitación no es válido.");
        setLoading(false);
        return;
      }
      try {
        const response = await fetch("/api/alta-integrante?token=" + encodeURIComponent(token), { cache: "no-store" });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error || "No se pudo validar la invitación.");
        if (active) setPayload(body as PublicPayload);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "No se pudo validar la invitación.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [token]);

  const optionsByType = useMemo(() => {
    const result = new Map<string, string[]>();
    for (const item of payload?.config ?? []) {
      const current = result.get(item.type) ?? [];
      current.push(item.value);
      result.set(item.type, current);
    }
    return result;
  }, [payload]);

  function update(header: string, value: MemberFieldValue) {
    setValues((current) => ({ ...current, [header]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    for (const field of REQUIRED) {
      if (!String(values[field] ?? "").trim()) {
        setError(labelFor(field) + " es obligatorio.");
        return;
      }
    }
    setSending(true);
    try {
      const response = await fetch("/api/alta-integrante", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, values }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "No se pudo enviar la solicitud.");
      setSubmitted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo enviar la solicitud.");
    } finally {
      setSending(false);
    }
  }

  function field(header: string) {
    const required = REQUIRED.has(header);
    const value = values[header];
    const stringValue = String(value ?? "");
    const label = labelFor(header);

    if (header === SCHEDULE) {
      return (
        <label key={header} className="grid gap-2">
          <span className="text-sm font-semibold text-slate-800">{label}{required ? " *" : ""}</span>
          <select className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm" value={stringValue} onChange={(event) => update(header, event.target.value)}>
            <option value="">Seleccionar…</option>
            {(optionsByType.get("HORARIO") ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      );
    }

    if (header === ACTIVITY || header === TITLE) {
      const type = header === ACTIVITY ? "ACTIVIDAD" : "TITULO";
      const selected = stringValue.split(",").map((item) => normalized(item.trim())).filter(Boolean);
      return (
        <fieldset key={header} className="rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-800">{label}</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(optionsByType.get(type) ?? []).map((option) => {
              const checked = selected.includes(normalized(option));
              return (
                <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(next) => {
                      const current = stringValue.split(",").map((item) => item.trim()).filter(Boolean);
                      const result = next === true
                        ? [...current.filter((item) => normalized(item) !== normalized(option)), option]
                        : current.filter((item) => normalized(item) !== normalized(option));
                      update(header, result.join(", "));
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

    if (header === "Posee Obra social") {
      return (
        <label key={header} className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
          <Checkbox checked={value === true} onCheckedChange={(checked) => update(header, checked === true)} />
          <span className="text-sm font-semibold text-slate-800">{label}</span>
        </label>
      );
    }

    if (TEXTAREAS.has(header)) {
      return (
        <label key={header} className="grid gap-2 sm:col-span-2">
          <span className="text-sm font-semibold text-slate-800">{label}{required ? " *" : ""}</span>
          <textarea
            required={required}
            rows={3}
            value={stringValue}
            onChange={(event) => update(header, event.target.value)}
            className="rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-teal-600"
          />
        </label>
      );
    }

    const type = header === BIRTHDAY ? "date"
      : header === "Dirección de correo electrónico" ? "email"
        : header === PHONE || header === "Teléfono celular del responsable" ? "tel"
          : header === "DNI" ? "number"
            : "text";
    return (
      <label key={header} className="grid gap-2">
        <span className="text-sm font-semibold text-slate-800">{label}{required ? " *" : ""}</span>
        <Input
          type={type}
          required={required}
          value={stringValue}
          onChange={(event) => update(header, event.target.value)}
          className="h-11"
        />
      </label>
    );
  }

  return (
    <main className="relative min-h-screen bg-slate-100 px-4 py-8 transition-colors dark:bg-slate-950 md:py-12">
      <ThemeToggle className="fixed right-4 top-4 z-50" />
      <section className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
        <header className="border-b border-slate-200 px-6 py-6 md:px-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Image src="/logo-proyecto-puente.jpg" alt="Proyecto Puente" width={150} height={96} className="rounded-xl" priority />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Solicitud de ingreso</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950 md:text-3xl">Formulario de nuevo integrante</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Completá tus datos. El envío no habilita automáticamente el ingreso ni el acceso a la plataforma:
                la solicitud será revisada por un administrador de Proyecto Puente.
              </p>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex min-h-72 items-center justify-center gap-3 text-slate-600"><LoaderCircle className="h-5 w-5 animate-spin" /> Validando invitación…</div>
        ) : submitted ? (
          <div className="px-6 py-16 text-center md:px-10">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
            <h2 className="mt-4 text-2xl font-bold text-slate-950">Solicitud enviada</h2>
            <p className="mx-auto mt-2 max-w-xl text-slate-600">
              Tus datos fueron recibidos correctamente. Un administrador revisará la solicitud y se pondrá en contacto con vos.
            </p>
          </div>
        ) : payload ? (
          <form onSubmit={submit} className="px-6 py-7 md:px-10">
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <strong>Enlace personal válido por 24 horas.</strong>
                <p className="mt-1">Vence el {new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(payload.expiresAt))}. Nombre y apellido, teléfono y dirección son obligatorios.</p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {payload.headers.map(field)}
            </div>

            {error ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">{error}</div> : null}

            <div className="mt-7 flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">Los datos se enviarán únicamente para evaluar tu solicitud de ingreso.</p>
              <Button type="submit" disabled={sending} className="min-w-44">
                {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? "Enviando…" : "Enviar solicitud"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="px-6 py-14 text-center md:px-10">
            <h2 className="text-xl font-bold text-red-800">No se puede abrir el formulario</h2>
            <p className="mt-2 text-slate-600">{error || "El enlace no es válido o venció."}</p>
          </div>
        )}
      </section>
    </main>
  );
}
