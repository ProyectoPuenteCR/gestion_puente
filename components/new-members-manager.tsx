"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  ExternalLink,
  Link2,
  LoaderCircle,
  MailPlus,
  MessageCircle,
  RefreshCw,
  UserRoundCheck,
  UsersRound,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { NewMemberRequest, NewMemberRequestStatus } from "@/lib/portal-types";

const NAME = "Apellidos y nombres ( Del integrante )";
const PHONE = "CELULAR";
const EMAIL = "email-puente";

function messageOf(body: unknown) {
  if (body && typeof body === "object" && "error" in body) return String((body as { error: unknown }).error);
  return "No se pudo completar la operación.";
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function statusLabel(status: NewMemberRequestStatus) {
  if (status === "invitation") return "Enlace activo";
  if (status === "expired") return "Enlace vencido";
  if (status === "pending") return "Pendiente";
  if (status === "approved") return "Aprobado · pendiente email";
  if (status === "rejected") return "Rechazado";
  return "Incorporado";
}

function statusBadge(status: NewMemberRequestStatus) {
  const className = status === "approved" || status === "incorporated"
    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
    : status === "pending"
      ? "bg-blue-100 text-blue-800 hover:bg-blue-100"
      : status === "rejected" || status === "expired"
        ? "bg-red-100 text-red-800 hover:bg-red-100"
        : "bg-slate-100 text-slate-700 hover:bg-slate-100";
  return <Badge className={className}>{statusLabel(status)}</Badge>;
}

function whatsappNumber(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith("54")) {
    if (!digits.startsWith("549")) digits = "549" + digits.slice(2);
    return digits;
  }
  if (digits.length >= 10) return "549" + digits;
  return digits;
}

export function NewMembersManager({
  onMemberIncorporated,
  onPendingCount,
}: {
  onMemberIncorporated: () => void;
  onPendingCount?: (count: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<NewMemberRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<"all" | NewMemberRequestStatus>("all");
  const [selectedId, setSelectedId] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteExpires, setInviteExpires] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/integrantes-nuevos", { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageOf(body));
      setRequests((body as { requests: NewMemberRequest[] }).requests);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar las solicitudes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = requests.filter((item) => item.status === "pending").length;

  useEffect(() => {
    onPendingCount?.(pendingCount);
  }, [onPendingCount, pendingCount]);

  const filtered = useMemo(
    () => filter === "all" ? requests : requests.filter((item) => item.status === filter),
    [filter, requests],
  );
  const selected = requests.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    setEmailDraft(selected?.emailPuente ?? "");
  }, [selected?.id, selected?.emailPuente]);

  async function action(body: Record<string, unknown>) {
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/integrantes-nuevos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageOf(payload));
      await load();
      return payload;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo completar la operación.");
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function createInvitation() {
    const result = await action({ action: "create_invitation" }) as { token?: string; expiresAt?: string } | null;
    if (!result?.token) return;
    const url = window.location.origin + "/alta-integrante?token=" + encodeURIComponent(result.token);
    setInviteUrl(url);
    setInviteExpires(result.expiresAt ?? "");
    setNotice("Invitación creada. El enlace vence en 24 horas y sólo puede utilizarse una vez.");
  }

  async function copyInvitation() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setNotice("Enlace copiado al portapapeles.");
  }

  function shareInvitationWhatsApp() {
    if (!inviteUrl) return;
    const text = "Hola. Te compartimos el formulario de solicitud de ingreso a Proyecto Puente. El enlace es personal y vence en 24 horas:\n\n" + inviteUrl;
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener,noreferrer");
  }

  async function approve() {
    if (!selected) return;
    const result = await action({ action: "approve", id: selected.id });
    if (result) setNotice("Solicitud aprobada. Quedó pendiente la creación del email-puente.");
  }

  async function reject() {
    if (!selected) return;
    const reason = window.prompt("Indicá el motivo del rechazo:");
    if (!reason?.trim()) return;
    const result = await action({ action: "reject", id: selected.id, reason });
    if (result) setNotice("Solicitud rechazada.");
  }

  async function incorporate() {
    if (!selected) return;
    const email = emailDraft.trim().toLowerCase();
    if (!email) {
      setError("Ingresá el email-puente que ya creaste.");
      return;
    }
    const result = await action({ action: "incorporate", id: selected.id, email });
    if (result) {
      setNotice("Integrante incorporado al padrón y habilitado para usar la plataforma.");
      onMemberIncorporated();
    }
  }

  function notifyWhatsApp(request: NewMemberRequest) {
    const phone = whatsappNumber(String(request.values[PHONE] ?? ""));
    if (!phone) {
      setError("La solicitud no tiene un teléfono válido.");
      return;
    }
    const name = String(request.values[NAME] ?? "").trim();
    const firstName = name.split(/\s+/)[0] || "Hola";
    const text =
      "Hola " + firstName + ". Te informamos que tu solicitud de ingreso a Proyecto Puente fue aprobada. " +
      "Por el momento la creación de tu email institucional y el acceso a la plataforma quedan pendientes. " +
      "Te avisaremos cuando estén habilitados. ¡Bienvenido/a!";
    window.open("https://wa.me/" + phone + "?text=" + encodeURIComponent(text), "_blank", "noopener,noreferrer");
  }

  const detailEntries = selected
    ? Object.entries(selected.values).filter(([header, value]) =>
        String(value ?? "").trim() &&
        !["Numero de orden", "Numero de Matricula", EMAIL, "Edad", "Marca temporal"].includes(header),
      )
    : [];

  return (
    <>
      <Button className="member-invite-button" onClick={() => { setOpen(true); setNotice(""); setError(""); }}>
        <Link2 /> Invitar por enlace
      </Button>
      <Button className="member-new-requests-button" onClick={() => setOpen(true)}>
        <UsersRound /> Integrantes nuevos
        {pendingCount ? <Badge className="ml-1 bg-white/20 text-white hover:bg-white/20">{pendingCount}</Badge> : null}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] w-[96vw] max-w-[1280px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Integrantes nuevos</DialogTitle>
            <DialogDescription>Invitaciones de 24 horas, revisión administrativa y alta posterior cuando exista el email-puente.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <Button onClick={() => void createInvitation()} disabled={working}><Link2 /> Generar invitación 24 h</Button>
              {inviteUrl ? (
                <>
                  <Button variant="outline" onClick={() => void copyInvitation()}><Clipboard /> Copiar enlace</Button>
                  <Button variant="outline" onClick={shareInvitationWhatsApp}><MessageCircle /> Enviar por WhatsApp</Button>
                  <span className="text-xs text-slate-500">Vence: {formatDate(inviteExpires)}</span>
                </>
              ) : null}
              <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Actualizar">
                {loading ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
              </Button>
            </div>

            {inviteUrl ? (
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-3">
                <p className="text-xs font-semibold uppercase text-teal-800">Última invitación generada</p>
                <div className="mt-2 flex gap-2">
                  <Input value={inviteUrl} readOnly />
                  <Button variant="outline" size="icon" asChild><a href={inviteUrl} target="_blank" rel="noreferrer"><ExternalLink /></a></Button>
                </div>
              </div>
            ) : null}

            {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{notice}</div> : null}
            {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">{error}</div> : null}

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Solicitudes e invitaciones</p>
                <p className="text-xs text-slate-500">{requests.length} registros · {pendingCount} pendientes de revisión</p>
              </div>
              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                Estado
                <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm">
                  <option value="all">Todos</option>
                  <option value="pending">Pendientes</option>
                  <option value="approved">Aprobados pendientes de email</option>
                  <option value="incorporated">Incorporados</option>
                  <option value="rejected">Rechazados</option>
                  <option value="invitation">Enlaces activos</option>
                  <option value="expired">Enlaces vencidos</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-3">Fecha</th>
                      <th className="px-3 py-3">Nombre</th>
                      <th className="px-3 py-3">Teléfono</th>
                      <th className="px-3 py-3">Estado</th>
                      <th className="px-3 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr key={item.id} className={"border-t border-slate-100 " + (selectedId === item.id ? "bg-blue-50" : "bg-white")}>
                        <td className="px-3 py-3 text-xs text-slate-500">{formatDate(item.submittedAt || item.createdAt)}</td>
                        <td className="px-3 py-3 font-semibold text-slate-900">{String(item.values[NAME] ?? "").trim() || "Invitación sin completar"}</td>
                        <td className="px-3 py-3">{String(item.values[PHONE] ?? "") || "—"}</td>
                        <td className="px-3 py-3">{statusBadge(item.status)}</td>
                        <td className="px-3 py-3 text-right"><Button size="sm" variant="outline" onClick={() => setSelectedId(item.id)}>Ver</Button></td>
                      </tr>
                    ))}
                    {!filtered.length ? <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No hay registros para este filtro.</td></tr> : null}
                  </tbody>
                </table>
              </div>

              <aside className="rounded-xl border border-slate-200 bg-white p-4">
                {!selected ? (
                  <div className="py-12 text-center text-sm text-slate-500"><UsersRound className="mx-auto mb-2 h-6 w-6" />Seleccioná una solicitud para ver el detalle.</div>
                ) : (
                  <div className="grid gap-4">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-bold text-slate-950">{String(selected.values[NAME] ?? "").trim() || "Invitación"}</h3>
                        {statusBadge(selected.status)}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Enviado: {formatDate(selected.submittedAt)} · Vence: {formatDate(selected.expiresAt)}</p>
                    </div>

                    {detailEntries.length ? (
                      <div className="max-h-[42vh] overflow-y-auto rounded-lg border border-slate-100">
                        {detailEntries.map(([header, value]) => (
                          <div key={header} className="border-b border-slate-100 px-3 py-2 last:border-0">
                            <p className="text-[11px] font-semibold uppercase text-slate-500">{header}</p>
                            <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{typeof value === "boolean" ? (value ? "Sí" : "No") : String(value)}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {selected.rejectionReason ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><strong>Motivo de rechazo:</strong> {selected.rejectionReason}</div>
                    ) : null}

                    {selected.status === "pending" ? (
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => void approve()} disabled={working}><UserRoundCheck /> Aprobar ingreso</Button>
                        <Button variant="destructive" onClick={() => void reject()} disabled={working}><XCircle /> Rechazar</Button>
                      </div>
                    ) : null}

                    {selected.status === "approved" ? (
                      <div className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <Button variant="outline" onClick={() => notifyWhatsApp(selected)}><MessageCircle /> Avisar por WhatsApp</Button>
                        <div className="border-t border-emerald-200 pt-3">
                          <label className="grid gap-1 text-sm font-semibold text-emerald-950">
                            Email-puente ya creado
                            <Input
                              type="email"
                              value={emailDraft}
                              onChange={(event) => setEmailDraft(event.target.value)}
                              placeholder="nombre.apellido@proyecto-puente.org"
                            />
                          </label>
                          <Button className="mt-3 w-full" onClick={() => void incorporate()} disabled={working || !emailDraft.trim()}>
                            <MailPlus /> Asignar email e incorporar
                          </Button>
                          <p className="mt-2 text-xs text-emerald-800">Este paso recién incorpora la ficha a Integrantes y habilita el acceso con el email institucional.</p>
                        </div>
                      </div>
                    ) : null}

                    {selected.status === "incorporated" ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                        <CheckCircle2 className="mb-1 h-5 w-5" />
                        Incorporado el {formatDate(selected.incorporatedAt)} con <strong>{selected.emailPuente}</strong>.
                      </div>
                    ) : null}
                  </div>
                )}
              </aside>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
