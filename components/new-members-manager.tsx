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
const DNI = "DNI";
const PERSONAL_EMAIL = "Dirección de correo electrónico";
const ADDRESS = "Dirección Actual donde vivo";

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

function statusClass(status: NewMemberRequestStatus) {
  return status === "approved" || status === "incorporated"
    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
    : status === "pending"
      ? "bg-blue-100 text-blue-800 hover:bg-blue-100"
      : status === "rejected" || status === "expired"
        ? "bg-red-100 text-red-800 hover:bg-red-100"
        : "bg-slate-100 text-slate-700 hover:bg-slate-100";
}

function statusBadge(status: NewMemberRequestStatus, onClick?: () => void) {
  if (!onClick) return <Badge className={statusClass(status)}>{statusLabel(status)}</Badge>;
  return (
    <button
      type="button"
      className={"new-member-status-filter " + statusClass(status)}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      title={"Filtrar por " + statusLabel(status)}
    >
      {statusLabel(status)}
    </button>
  );
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

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function fieldGroup(header: string) {
  const key = normalized(header);
  if (
    [NAME, DNI, PHONE, PERSONAL_EMAIL, ADDRESS, "Fecha de Nacimiento"].includes(header) ||
    key.includes("domicilio") ||
    key.includes("direccion")
  ) return "personal";
  if (
    key.includes("responsable") ||
    key.includes("emergencia") ||
    key.includes("obra social") ||
    key.includes("enfermedad") ||
    key.includes("patologia")
  ) return "emergency";
  if (
    key.includes("proyecto") ||
    key.includes("actividad") ||
    key.includes("horario") ||
    key.includes("titulo") ||
    key.includes("estudiando") ||
    key.includes("participar")
  ) return "project";
  return "other";
}

function prettyField(header: string) {
  const names: Record<string, string> = {
    [NAME]: "Nombre y apellido",
    [PHONE]: "Teléfono / celular",
    [PERSONAL_EMAIL]: "Email personal",
    [ADDRESS]: "Dirección actual",
    "Fecha de Nacimiento": "Fecha de nacimiento",
    "Horario en que asisto al proyecto": "Horario",
    "Que actividad te gustaria realizar este año": "Actividad de interés",
  };
  return names[header] ?? header;
}

function DetailField({ header, value }: { header: string; value: unknown }) {
  const text = typeof value === "boolean" ? (value ? "Sí" : "No") : String(value ?? "");
  const long = text.length > 75 || ["comentario", "por que", "cambiar", "enfermedad", "emergencia"].some((needle) => normalized(header).includes(needle));
  return (
    <div className={"new-member-detail-field " + (long ? "wide" : "")}>
      <small>{prettyField(header)}</small>
      <strong>{text || "—"}</strong>
    </div>
  );
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

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: requests.length };
    for (const request of requests) result[request.status] = (result[request.status] ?? 0) + 1;
    return result;
  }, [requests]);

  const pendingCount = counts.pending ?? 0;

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

  const grouped = {
    personal: detailEntries.filter(([header]) => fieldGroup(header) === "personal"),
    project: detailEntries.filter(([header]) => fieldGroup(header) === "project"),
    emergency: detailEntries.filter(([header]) => fieldGroup(header) === "emergency"),
    other: detailEntries.filter(([header]) => fieldGroup(header) === "other"),
  };

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
        <DialogContent className="new-members-dialog">
          <DialogHeader className="new-members-dialog-header">
            <DialogTitle>Integrantes nuevos</DialogTitle>
            <DialogDescription>Invitaciones de 24 horas, revisión administrativa y alta posterior cuando exista el email-puente.</DialogDescription>
          </DialogHeader>

          <div className="new-members-dialog-tools">
            <div className="new-members-invite-actions">
              <Button onClick={() => void createInvitation()} disabled={working}><Link2 /> Generar invitación 24 h</Button>
              {inviteUrl ? (
                <>
                  <Button variant="outline" onClick={() => void copyInvitation()}><Clipboard /> Copiar enlace</Button>
                  <Button variant="outline" onClick={shareInvitationWhatsApp}><MessageCircle /> Enviar por WhatsApp</Button>
                  <span>Vence: {formatDate(inviteExpires)}</span>
                </>
              ) : null}
              <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Actualizar">
                {loading ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
              </Button>
            </div>

            <div className="new-members-filter-chips">
              <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todos <span>{counts.all ?? 0}</span></button>
              <button className={filter === "pending" ? "active" : ""} onClick={() => setFilter("pending")}>Pendientes <span>{counts.pending ?? 0}</span></button>
              <button className={filter === "approved" ? "active" : ""} onClick={() => setFilter("approved")}>Aprobados <span>{counts.approved ?? 0}</span></button>
              <button className={filter === "incorporated" ? "active" : ""} onClick={() => setFilter("incorporated")}>Incorporados <span>{counts.incorporated ?? 0}</span></button>
              <button className={filter === "rejected" ? "active" : ""} onClick={() => setFilter("rejected")}>Rechazados <span>{counts.rejected ?? 0}</span></button>
            </div>
          </div>

          {inviteUrl ? (
            <div className="new-members-invite-url">
              <Input value={inviteUrl} readOnly />
              <Button variant="outline" size="icon" asChild><a href={inviteUrl} target="_blank" rel="noreferrer"><ExternalLink /></a></Button>
            </div>
          ) : null}

          {notice ? <div className="new-members-notice success">{notice}</div> : null}
          {error ? <div className="new-members-notice error">{error}</div> : null}

          <div className="new-members-review-layout">
            <aside className="new-members-list-pane">
              <header>
                <div><strong>Solicitudes</strong><small>{filtered.length} visibles · {pendingCount} pendientes</small></div>
                <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
                  <option value="all">Todos</option>
                  <option value="pending">Pendientes</option>
                  <option value="approved">Aprobados pendientes de email</option>
                  <option value="incorporated">Incorporados</option>
                  <option value="rejected">Rechazados</option>
                  <option value="invitation">Enlaces activos</option>
                  <option value="expired">Enlaces vencidos</option>
                </select>
              </header>

              <div className="new-members-request-list">
                {filtered.map((item) => {
                  const name = String(item.values[NAME] ?? "").trim() || "Invitación sin completar";
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={"new-member-request-card " + (selectedId === item.id ? "selected" : "")}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <div className="new-member-request-title">
                        <strong>{name}</strong>
                        {statusBadge(item.status, () => setFilter(item.status))}
                      </div>
                      <div className="new-member-request-meta">
                        <span>DNI: {String(item.values[DNI] ?? "") || "—"}</span>
                        <span>Tel: {String(item.values[PHONE] ?? "") || "—"}</span>
                      </div>
                      <small>Enviada: {formatDate(item.submittedAt || item.createdAt)}</small>
                    </button>
                  );
                })}
                {!filtered.length ? <div className="new-members-empty">No hay registros para este filtro.</div> : null}
              </div>
            </aside>

            <section className="new-members-detail-pane">
              {!selected ? (
                <div className="new-members-empty-detail"><UsersRound /><strong>Seleccioná una solicitud</strong><span>Acá vas a poder revisar todos los datos antes de aprobar o rechazar.</span></div>
              ) : (
                <>
                  <header className="new-members-detail-header">
                    <div>
                      <div className="new-members-detail-title">
                        <h3>{String(selected.values[NAME] ?? "").trim() || "Invitación"}</h3>
                        {statusBadge(selected.status, () => setFilter(selected.status))}
                      </div>
                      <p>Enviado: {formatDate(selected.submittedAt)} · Vence: {formatDate(selected.expiresAt)}</p>
                    </div>
                  </header>

                  <div className="new-members-detail-scroll">
                    {grouped.personal.length ? (
                      <section className="new-member-detail-section">
                        <h4>Datos personales</h4>
                        <div className="new-member-detail-grid">{grouped.personal.map(([header, value]) => <DetailField key={header} header={header} value={value} />)}</div>
                      </section>
                    ) : null}

                    {grouped.project.length ? (
                      <section className="new-member-detail-section">
                        <h4>Proyecto y formación</h4>
                        <div className="new-member-detail-grid">{grouped.project.map(([header, value]) => <DetailField key={header} header={header} value={value} />)}</div>
                      </section>
                    ) : null}

                    {grouped.emergency.length ? (
                      <section className="new-member-detail-section">
                        <h4>Emergencia, salud y responsable</h4>
                        <div className="new-member-detail-grid">{grouped.emergency.map(([header, value]) => <DetailField key={header} header={header} value={value} />)}</div>
                      </section>
                    ) : null}

                    {grouped.other.length ? (
                      <section className="new-member-detail-section">
                        <h4>Otros datos</h4>
                        <div className="new-member-detail-grid">{grouped.other.map(([header, value]) => <DetailField key={header} header={header} value={value} />)}</div>
                      </section>
                    ) : null}

                    {selected.rejectionReason ? (
                      <div className="new-members-rejection"><strong>Motivo de rechazo:</strong> {selected.rejectionReason}</div>
                    ) : null}

                    {selected.status === "approved" ? (
                      <section className="new-members-approved-panel">
                        <Button variant="outline" onClick={() => notifyWhatsApp(selected)}><MessageCircle /> Avisar por WhatsApp</Button>
                        <label>
                          <span>Email-puente ya creado</span>
                          <Input type="email" value={emailDraft} onChange={(event) => setEmailDraft(event.target.value)} placeholder="nombre.apellido@proyecto-puente.org" />
                        </label>
                        <Button onClick={() => void incorporate()} disabled={working || !emailDraft.trim()}><MailPlus /> Asignar email e incorporar</Button>
                        <small>Recién en este paso la ficha pasa a Integrantes y se habilita el acceso.</small>
                      </section>
                    ) : null}

                    {selected.status === "incorporated" ? (
                      <div className="new-members-incorporated"><CheckCircle2 /> Incorporado el {formatDate(selected.incorporatedAt)} con <strong>{selected.emailPuente}</strong>.</div>
                    ) : null}
                  </div>

                  {selected.status === "pending" ? (
                    <footer className="new-members-detail-footer">
                      <Button variant="destructive" onClick={() => void reject()} disabled={working}><XCircle /> Rechazar</Button>
                      <Button onClick={() => void approve()} disabled={working}><UserRoundCheck /> Aprobar ingreso</Button>
                    </footer>
                  ) : null}
                </>
              )}
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
