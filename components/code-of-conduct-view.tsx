"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CodeOfConductAcceptance, CodeOfConductUserStatus, PortalUser } from "@/lib/portal-types";

type CodePayload = {
  document: {
    fileId: string;
    name: string;
    revision: string;
    documentDate: string;
    modifiedTime: string;
    html: string;
    viewUrl: string;
  };
  acceptance: CodeOfConductAcceptance | null;
  previousAcceptance: CodeOfConductAcceptance | null;
  canSign: boolean;
  admin: {
    selectedYear: number;
    years: number[];
    summary: { total: number; accepted: number; pending: number; outdated: number };
    users: CodeOfConductUserStatus[];
  } | null;
};

function formatDateTime(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function statusBadge(status: CodeOfConductUserStatus["status"]) {
  if (status === "accepted") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Aceptado</Badge>;
  if (status === "outdated") return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Versión anterior</Badge>;
  return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Pendiente</Badge>;
}

export function CodeOfConductView({ user, locked }: { user: PortalUser; locked: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<CodePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dni, setDni] = useState("");
  const [acceptsCode, setAcceptsCode] = useState(false);
  const [acceptsImages, setAcceptsImages] = useState<boolean | null>(null);
  const [acceptsFee, setAcceptsFee] = useState<boolean | null>(null);
  const [feeReason, setFeeReason] = useState("");
  const [adminYear, setAdminYear] = useState(new Date().getFullYear());

  async function load(year = adminYear) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/codigo-convivencia?year=" + encodeURIComponent(String(year)), { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo cargar el Código de Convivencia.");
      setData(payload as CodePayload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el Código de Convivencia.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(adminYear);
  }, [adminYear]);

  const documentVersion = useMemo(() => {
    if (!data) return "";
    const modified = data.document.modifiedTime ? " · actualizado " + formatDateTime(data.document.modifiedTime) : "";
    return "REV " + data.document.revision + modified;
  }, [data]);

  async function sign() {
    setError("");
    const cleanDni = dni.replace(/\D/g, "");
    if (!acceptsCode) {
      setError("Marcá la casilla de aceptación del Código de Convivencia.");
      return;
    }
    if (cleanDni.length < 7 || cleanDni.length > 9) {
      setError("Ingresá un DNI válido, sólo con números.");
      return;
    }
    if (acceptsImages === null) {
      setError("Indicá si aceptás el uso institucional de imágenes.");
      return;
    }
    if (acceptsFee === null) {
      setError("Indicá si aceptás cumplir con la cuota societaria.");
      return;
    }
    if (acceptsFee === false && !feeReason.trim()) {
      setError("Explicá la causa por la que no podés cumplir con la cuota societaria.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/codigo-convivencia", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dni: cleanDni,
          acceptsCode,
          acceptsImages,
          acceptsFee,
          feeReason,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo registrar la aceptación.");
      setDni("");
      setAcceptsCode(false);
      setAcceptsImages(null);
      setAcceptsFee(null);
      setFeeReason("");
      await load(adminYear);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo registrar la aceptación.");
    } finally {
      setSaving(false);
    }
  }

  function downloadCsv() {
    if (!data?.admin) return;
    const rows = [
      ["Integrante", "Email", "Rol", "Estado", "DNI", "Fecha aceptación", "Requiere firma tutor"],
      ...data.admin.users.map((item) => [
        item.name,
        item.email,
        item.role,
        item.status === "accepted" ? "Aceptado" : item.status === "outdated" ? "Versión anterior" : "Pendiente",
        item.dni,
        item.acceptedAt,
        item.requiresTutorSignature ? "Sí" : "No",
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "aceptaciones-codigo-convivencia-" + data.admin.selectedYear + ".csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <section className="surface p-6">
        <div className="flex items-center gap-3 text-red-700"><AlertTriangle className="h-5 w-5" /><strong>{error || "No se pudo cargar el documento."}</strong></div>
        <Button className="mt-4" variant="outline" onClick={() => void load()}>Reintentar</Button>
      </section>
    );
  }

  return (
    <div className="page-stack">
      {locked ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <strong className="text-amber-950">Aceptación obligatoria pendiente</strong>
              <p className="mt-1 text-sm text-amber-900">Para continuar usando la plataforma, leé el documento y completá la firma digital al final de esta pantalla.</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="surface overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><FileText className="h-6 w-6" /></span>
            <div>
              <p className="eyebrow">DOCUMENTO INSTITUCIONAL</p>
              <h2 className="text-xl font-bold text-slate-950">Código de Convivencia y Conducta</h2>
              <p className="mt-1 text-sm text-slate-500">{data.document.name} · {documentVersion}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data.acceptance ? (
              <Badge className="bg-emerald-100 px-3 py-1.5 text-emerald-800 hover:bg-emerald-100"><CheckCircle2 className="mr-1 h-4 w-4" /> Aceptado</Badge>
            ) : (
              <Badge className="bg-amber-100 px-3 py-1.5 text-amber-800 hover:bg-amber-100">Pendiente de aceptación</Badge>
            )}
            <Button variant="outline" asChild>
              <a href={data.document.viewUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Abrir en Drive</a>
            </Button>
          </div>
        </div>

        <div className="bg-slate-100 p-3 md:p-5">
          <article className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white px-5 py-8 shadow-sm md:px-10 md:py-10">
            <div
              className="text-[15px] leading-7 text-slate-700 [&_h1]:mb-7 [&_h1]:text-center [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-slate-950 [&_h2]:mb-3 [&_h2]:mt-7 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-slate-950 [&_li]:mb-1.5 [&_p]:mb-3 [&_strong]:font-semibold [&_ul]:mb-4 [&_ul]:ml-6 [&_ul]:list-disc"
              dangerouslySetInnerHTML={{ __html: data.document.html }}
            />
          </article>
        </div>
      </section>

      {data.acceptance ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" />
              <div>
                <h3 className="text-lg font-bold text-emerald-950">Código aceptado y firmado</h3>
                <p className="mt-1 text-sm text-emerald-900">La aceptación quedó asociada a tu cuenta institucional y a tu DNI.</p>
                <div className="mt-4 grid gap-2 text-sm text-emerald-950 sm:grid-cols-2">
                  <p><span className="font-semibold">Integrante:</span> {data.acceptance.name}</p>
                  <p><span className="font-semibold">DNI / firma:</span> {data.acceptance.dni}</p>
                  <p><span className="font-semibold">Fecha:</span> {formatDateTime(data.acceptance.acceptedAt)}</p>
                  <p><span className="font-semibold">Año de aceptación:</span> {data.acceptance.acceptanceYear}</p>
                  <p><span className="font-semibold">Versión:</span> REV {data.acceptance.revision}</p>
                  <p><span className="font-semibold">Uso de imágenes:</span> {data.acceptance.acceptsImages ? "Sí" : "No"}</p>
                  <p><span className="font-semibold">Cuota societaria:</span> {data.acceptance.acceptsFee ? "Sí" : "No"}</p>
                </div>
                {data.acceptance.requiresTutorSignature ? (
                  <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                    Por tratarse de un integrante menor de edad, también se requiere la firma presencial de padre, madre o tutor en Proyecto Puente.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="surface p-6">
          <div className="mb-5">
            <p className="eyebrow">FIRMA DIGITAL</p>
            <h2 className="text-xl font-bold text-slate-950">Aceptación del Código de Convivencia</h2>
            <p className="mt-1 text-sm text-slate-600">Tu cuenta de la plataforma, el DNI ingresado y la fecha/hora del registro quedarán asociados a esta aceptación.</p>
          </div>

          {data.previousAcceptance ? (
            <div className="mb-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p>
                {data.previousAcceptance.acceptanceYear < new Date().getFullYear()
                  ? "Tu última aceptación corresponde al año " + data.previousAcceptance.acceptanceYear + ". La aceptación se renueva cada enero, por lo que debés firmar nuevamente para " + new Date().getFullYear() + "."
                  : "Existe una aceptación anterior del " + formatDateTime(data.previousAcceptance.acceptedAt) + ", pero el documento fue actualizado. Debés aceptar la versión vigente."}
              </p>
            </div>
          ) : null}

          <div className="grid gap-5">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={acceptsCode} onChange={(event) => setAcceptsCode(event.target.checked)} />
              <span>
                <strong className="text-slate-950">He leído y acepto el Código de Convivencia y Conducta de Proyecto Puente.</strong>
                <small className="mt-1 block text-slate-500">La aceptación corresponde a la versión vigente mostrada arriba.</small>
              </span>
            </label>

            <div className="grid gap-2">
              <label htmlFor="conduct-dni" className="text-sm font-semibold text-slate-800">DNI — firma digital</label>
              <Input
                id="conduct-dni"
                inputMode="numeric"
                autoComplete="off"
                value={dni}
                onChange={(event) => setDni(event.target.value.replace(/\D/g, "").slice(0, 9))}
                placeholder="Ingresá tu DNI sin puntos"
                className="max-w-sm"
              />
            </div>

            <fieldset className="rounded-xl border border-slate-200 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-900">Acepto el uso institucional de imágenes sin fines políticos</legend>
              <div className="mt-3 flex gap-6 text-sm">
                <label className="flex items-center gap-2"><input type="radio" name="images" checked={acceptsImages === true} onChange={() => setAcceptsImages(true)} /> Sí</label>
                <label className="flex items-center gap-2"><input type="radio" name="images" checked={acceptsImages === false} onChange={() => setAcceptsImages(false)} /> No</label>
              </div>
            </fieldset>

            <fieldset className="rounded-xl border border-slate-200 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-900">Acepto cumplir con el pago de la cuota societaria en forma mensual</legend>
              <div className="mt-3 flex gap-6 text-sm">
                <label className="flex items-center gap-2"><input type="radio" name="fee" checked={acceptsFee === true} onChange={() => setAcceptsFee(true)} /> Sí</label>
                <label className="flex items-center gap-2"><input type="radio" name="fee" checked={acceptsFee === false} onChange={() => setAcceptsFee(false)} /> No</label>
              </div>
              {acceptsFee === false ? (
                <div className="mt-4 grid gap-2">
                  <label htmlFor="fee-reason" className="text-sm font-medium text-slate-700">Explicá la causa</label>
                  <textarea
                    id="fee-reason"
                    value={feeReason}
                    onChange={(event) => setFeeReason(event.target.value.slice(0, 500))}
                    className="min-h-24 rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-blue-500"
                    placeholder="La Comisión evaluará el caso."
                  />
                </div>
              ) : null}
            </fieldset>

            {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">{error}</div> : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void sign()} disabled={saving || !data.canSign}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {saving ? "Registrando..." : "Aceptar y firmar"}
              </Button>
              <p className="text-xs text-slate-500">Usuario autenticado: {user.email}</p>
            </div>
          </div>
        </section>
      )}

      {data.admin ? (
        <section className="surface overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="eyebrow">CONTROL ADMINISTRATIVO</p>
              <h2 className="text-xl font-bold text-slate-950">Estado de aceptaciones</h2>
            </div>
<div className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                <span>Año</span>
                <select
                  value={data.admin.selectedYear}
                  onChange={(event) => setAdminYear(Number(event.target.value))}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                >
                  {data.admin.years.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <Button variant="outline" onClick={downloadCsv}><Download className="h-4 w-4" /> Exportar CSV</Button>
            </div>
          </div>

          <div className="border-b border-slate-100 px-5 py-3 text-sm text-slate-600">Estado correspondiente al año <strong>{data.admin.selectedYear}</strong>.</div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-semibold uppercase text-slate-500">Usuarios</p><strong className="mt-1 block text-2xl text-slate-950">{data.admin.summary.total}</strong></div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-semibold uppercase text-emerald-700">Aceptaron</p><strong className="mt-1 block text-2xl text-emerald-950">{data.admin.summary.accepted}</strong></div>
            <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-semibold uppercase text-slate-500">Pendientes</p><strong className="mt-1 block text-2xl text-slate-950">{data.admin.summary.pending}</strong></div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-semibold uppercase text-amber-700">Versión anterior</p><strong className="mt-1 block text-2xl text-amber-950">{data.admin.summary.outdated}</strong></div>
          </div>

          <div className="overflow-x-auto border-t border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Integrante</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>DNI / firma</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tutor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.admin.users.map((item) => (
                  <TableRow key={item.email}>
                    <TableCell><strong className="block text-slate-900">{item.name}</strong><small className="text-slate-500">{item.email}</small></TableCell>
                    <TableCell>{item.role}</TableCell>
                    <TableCell>{statusBadge(item.status)}</TableCell>
                    <TableCell>{item.dni || "—"}</TableCell>
                    <TableCell>{formatDateTime(item.acceptedAt)}</TableCell>
                    <TableCell>{item.requiresTutorSignature ? <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pendiente presencial</Badge> : "—"}</TableCell>
                  </TableRow>
                ))}
                {!data.admin.users.length ? (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-slate-500"><Users className="mx-auto mb-2 h-5 w-5" />No hay usuarios para mostrar.</TableCell></TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}
    </div>
  );
}