"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  CircleDollarSign,
  Eye,
  EyeOff,
  LoaderCircle,
  RefreshCw,
  Save,
  Search,
  ShieldBan,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { SocialFeeMember, SocialFeeRecord, SocialFeeStatus } from "@/lib/portal-types";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const EXCLUDED = new Set<SocialFeeStatus>(["Beca", "Baja", "Exento"]);
const STATUS_OPTIONS: Array<{ value: SocialFeeStatus; label: string }> = [
  { value: "", label: "Sin cargar" },
  { value: "P", label: "Pagó" },
  { value: "Debe", label: "Debe" },
  { value: "Beca", label: "Beca" },
  { value: "Baja", label: "Baja" },
  { value: "Exento", label: "Exento" },
];

type FeeScope = "month" | "year";

type FeePayload = {
  members: SocialFeeMember[];
  records: SocialFeeRecord[];
  years: number[];
  canManage: boolean;
  canSelfReport: boolean;
  currentEmail: string;
  feeAmount: number;
};

function responseMessage(value: unknown) {
  return value && typeof value === "object" && "error" in value
    ? String((value as { error: unknown }).error)
    : "No se pudo completar la operación.";
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function statusLabel(status: SocialFeeStatus) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status;
}

function FeeStatus({ status }: { status: SocialFeeStatus }) {
  return <Badge className={`fee-status fee-status-${status ? normalize(status) : "empty"}`}>{statusLabel(status)}</Badge>;
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(value);
}

export function SocialFeeManager() {
  const [data, setData] = useState<FeePayload | null>(null);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [search, setSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, SocialFeeStatus>>({});
  const [draftScopes, setDraftScopes] = useState<Record<string, FeeScope>>({});
  const [bulkStatus, setBulkStatus] = useState<SocialFeeStatus>("P");
  const [bulkScope, setBulkScope] = useState<FeeScope>("month");
  const [costsVisible, setCostsVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fetchPayload = useCallback(async (selectedYear: number) => {
    const response = await fetch(`/api/cuotas?year=${selectedYear}`, { cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(responseMessage(body));
    return body as FeePayload;
  }, []);

  async function load(selectedYear = year) {
    setLoading(true);
    setError("");
    try {
      setData(await fetchPayload(selectedYear));
      setSelected(new Set());
      setDrafts({});
      setDraftScopes({});
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar las cuotas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void fetchPayload(CURRENT_YEAR)
      .then((payload) => { if (active) setData(payload); })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "No se pudieron cargar las cuotas."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchPayload]);

  const recordsByKey = useMemo(() => new Map(
    (data?.records ?? []).map((record) => [`${record.email}|${record.year}|${record.month}`, record]),
  ), [data?.records]);

  const monthRows = useMemo(() => (data?.members ?? []).map((member) => ({
    member,
    record: recordsByKey.get(`${member.email}|${year}|${month}`),
  })), [data?.members, month, recordsByKey, year]);

  const filteredRows = useMemo(() => {
    const term = normalize(search.trim());
    return monthRows.filter(({ member, record }) => {
      const matchesText = !term || normalize(`${member.name} ${member.email}`).includes(term);
      const matchesMember = memberFilter === "all" || member.email === memberFilter;
      const matchesStatus = statusFilter === "all" || (record?.status ?? "") === statusFilter;
      return matchesText && matchesMember && matchesStatus;
    });
  }, [memberFilter, monthRows, search, statusFilter]);

  const metrics = useMemo(() => {
    const statuses = monthRows.map(({ record }) => record?.status ?? "");
    const paid = statuses.filter((status) => status === "P").length;
    const debt = statuses.filter((status) => status === "Debe").length;
    const excluded = statuses.filter((status) => EXCLUDED.has(status)).length;
    const computable = paid + debt;
    let annualPaid = 0;
    let annualDebt = 0;
    for (const member of data?.members ?? []) {
      for (let monthNumber = 1; monthNumber <= 12; monthNumber += 1) {
        const status = recordsByKey.get(`${member.email}|${year}|${monthNumber}`)?.status ?? "";
        if (status === "P") annualPaid += 1;
        if (status === "Debe") annualDebt += 1;
      }
    }
    const amount = data?.feeAmount ?? 0;
    return {
      paid,
      debt,
      excluded,
      pending: statuses.length - paid - debt - excluded,
      rate: computable ? Math.round((paid / computable) * 100) : 0,
      monthlyCollected: paid * amount,
      annualCollected: annualPaid * amount,
      monthlyDebt: debt * amount,
      annualDebt: annualDebt * amount,
      annualPaid,
      annualDebtCount: annualDebt,
    };
  }, [data?.feeAmount, data?.members, monthRows, recordsByKey, year]);

  const annualDebtByEmail = useMemo(() => new Map((data?.members ?? []).map((member) => {
    let debtMonths = 0;
    for (let monthNumber = 1; monthNumber <= 12; monthNumber += 1) {
      if (recordsByKey.get(`${member.email}|${year}|${monthNumber}`)?.status === "Debe") debtMonths += 1;
    }
    return [member.email, debtMonths];
  })), [data?.members, recordsByKey, year]);

  async function post(body: Record<string, unknown>, savingKey: string) {
    setSaving(savingKey);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/cuotas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const responseBody = await response.json().catch(() => null);
      if (!response.ok) throw new Error(responseMessage(responseBody));
      const updated = Number((responseBody as { updated?: number } | null)?.updated ?? 0);
      setNotice(updated ? `${updated} cuota${updated === 1 ? "" : "s"} actualizada${updated === 1 ? "" : "s"}.` : "Las cuotas ya tenían ese estado.");
      await load(year);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la cuota.");
    } finally {
      setSaving("");
    }
  }

  async function saveOne(email: string, status?: SocialFeeStatus) {
    const currentStatus = recordsByKey.get(`${email}|${year}|${month}`)?.status ?? "";
    const selectedStatus = status ?? drafts[email] ?? currentStatus;
    const scope = draftScopes[email] ?? "month";
    if (scope === "year" && !window.confirm(`Se aplicará “${statusLabel(selectedStatus)}” a los 12 meses de ${year}. ¿Querés continuar?`)) return;
    await post({ email, year, month, status: selectedStatus, scope }, email);
  }

  async function saveBulk() {
    if (!selected.size) return;
    const scopeLabel = bulkScope === "year" ? `los 12 meses de ${year}` : `${MONTHS[month - 1]} de ${year}`;
    if (!window.confirm(`Se aplicará “${statusLabel(bulkStatus)}” a ${selected.size} integrante${selected.size === 1 ? "" : "s"} durante ${scopeLabel}. ¿Querés continuar?`)) return;
    await post({ action: "bulk_set", emails: [...selected], year, month, status: bulkStatus, scope: bulkScope }, "bulk");
  }

  function setYearAndReload(nextYear: number) {
    setYear(nextYear);
    void load(nextYear);
  }

  function toggleAllVisible(checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const { member } of filteredRows) {
        if (checked) next.add(member.email);
        else next.delete(member.email);
      }
      return next;
    });
  }

  if (loading && !data) return <section className="surface manager-loading"><LoaderCircle className="spin" /> Cargando cuotas…</section>;
  if (!data) return <section className="surface inline-error">{error || "No se pudieron cargar las cuotas."}</section>;

  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every(({ member }) => selected.has(member.email));
  const money = (value: number) => costsVisible ? formatMoney(value) : "••••••";

  return (
    <div className="page-stack fee-page">
      <section className="surface fee-hero">
        <div>
          <p className="eyebrow">CUOTA SOCIAL · CONTROL POR AÑO Y MES</p>
          <h2>{data.canManage ? "Administración de cuotas" : "Mis cuotas"}</h2>
          <p>{data.canManage ? "Seleccioná integrantes y aplicá cualquier estado al mes elegido o a todo el año." : "Consultá tu situación mensual. Sólo Pagó y Debe intervienen en el porcentaje de cumplimiento."}</p>
        </div>
        <div className="fee-period-controls">
          <label><span>Año</span><select value={year} onChange={(event) => setYearAndReload(Number(event.target.value))}>{data.years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          {data.canManage ? <label><span>Mes</span><select value={month} onChange={(event) => { setMonth(Number(event.target.value)); setSelected(new Set()); setDrafts({}); setDraftScopes({}); }}>{MONTHS.map((item, index) => <option key={item} value={index + 1}>{item}</option>)}</select></label> : null}
          <Button variant="outline" className="cost-visibility-button" onClick={() => setCostsVisible((visible) => !visible)}>{costsVisible ? <EyeOff /> : <Eye />} {costsVisible ? "Ocultar importes" : "Mostrar importes"}</Button>
          <Button variant="outline" size="icon" onClick={() => void load(year)} aria-label="Actualizar cuotas"><RefreshCw className={loading ? "spin" : ""} /></Button>
        </div>
      </section>

      {error ? <p className="inline-error" role="alert">{error}</p> : null}
      {notice ? <p className="success-message"><Check /> {notice}</p> : null}
      {!data.feeAmount ? <p className="fee-amount-warning"><CircleDollarSign /> Configurá el valor mensual de la cuota para {year} en Configuración → Valor cuota social. Hasta entonces, los importes se muestran en $0.</p> : null}

      {data.canManage ? (
        <>
          <section className="mini-metrics fee-metrics">
            <div><CircleDollarSign /><span><p>Recaudado en {MONTHS[month - 1]}</p><strong>{money(metrics.monthlyCollected)}</strong><small>{metrics.paid} cuota{metrics.paid === 1 ? "" : "s"} pagada{metrics.paid === 1 ? "" : "s"}</small></span></div>
            <div><CircleDollarSign /><span><p>Recaudado en {year}</p><strong>{money(metrics.annualCollected)}</strong><small>{metrics.annualPaid} pagos registrados</small></span></div>
            <div><WalletCards /><span><p>Deuda del mes</p><strong>{money(metrics.monthlyDebt)}</strong><small>{metrics.debt} cuota{metrics.debt === 1 ? "" : "s"} marcada{metrics.debt === 1 ? "" : "s"} Debe</small></span></div>
            <div><WalletCards /><span><p>Deuda anual</p><strong>{money(metrics.annualDebt)}</strong><small>{metrics.annualDebtCount} cuotas adeudadas</small></span></div>
            <div><UsersRound /><span><p>Cumplimiento</p><strong>{metrics.rate}%</strong><small>Pagó / (Pagó + Debe)</small></span></div>
            <div><ShieldBan /><span><p>No computan</p><strong>{metrics.excluded}</strong><small>beca, baja o exento</small></span></div>
          </section>

          <section className="surface fee-admin-card">
            <header className="fee-toolbar">
              <div className="fee-filter-row">
                <label className="manager-search"><Search /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o email…" /></label>
                <Badge variant="outline">{metrics.pending} sin cargar</Badge>
              </div>
              <div className="fee-bulk-actions">
                <span><strong>Acción masiva</strong><small>{selected.size} seleccionado{selected.size === 1 ? "" : "s"}</small></span>
                <select aria-label="Estado para aplicar" value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as SocialFeeStatus)}>{STATUS_OPTIONS.map((option) => <option key={option.value || "empty"} value={option.value}>{option.label}</option>)}</select>
                <select aria-label="Alcance de la acción masiva" value={bulkScope} onChange={(event) => setBulkScope(event.target.value as FeeScope)}><option value="month">Sólo {MONTHS[month - 1]}</option><option value="year">Todo {year}</option></select>
                <Button disabled={!selected.size || saving === "bulk"} onClick={() => void saveBulk()}>{saving === "bulk" ? <LoaderCircle className="spin" /> : <Check />} Aplicar estado</Button>
              </div>
            </header>
            <div className="fee-table-wrap">
              <table className="fee-table">
                <thead><tr><th><Checkbox checked={allVisibleSelected} onCheckedChange={(checked) => toggleAllVisible(checked === true)} aria-label="Seleccionar todos los integrantes visibles" /></th><th><label className="fee-column-heading"><span>Integrante</span><select value={memberFilter} onChange={(event) => { setMemberFilter(event.target.value); setSelected(new Set()); }} aria-label="Filtrar por integrante"><option value="all">Todos los integrantes</option>{data.members.map((member) => <option key={member.email} value={member.email}>{member.name}</option>)}</select></label></th><th><label className="fee-column-heading"><span>Estado actual</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setSelected(new Set()); }} aria-label="Filtrar por estado"><option value="all">Todos los estados</option>{STATUS_OPTIONS.map((option) => <option key={option.value || "empty"} value={option.value}>{option.label}</option>)}</select></label></th><th>Fecha de pago</th><th>Deuda mes</th><th>Deuda anual</th><th>Carga individual</th></tr></thead>
                <tbody>
                  {filteredRows.map(({ member, record }) => {
                    const status = record?.status ?? "";
                    const debtMonths = annualDebtByEmail.get(member.email) ?? 0;
                    return (
                      <tr key={member.email}>
                        <td><Checkbox checked={selected.has(member.email)} onCheckedChange={(checked) => setSelected((currentSet) => { const next = new Set(currentSet); if (checked) next.add(member.email); else next.delete(member.email); return next; })} aria-label={`Seleccionar ${member.name}`} /></td>
                        <td><strong>{member.name}</strong><small>{member.email}</small></td>
                        <td><FeeStatus status={status} /></td>
                        <td>{formatDate(record?.paidAt ?? "")}</td>
                        <td className={status === "Debe" ? "fee-debt-value" : ""}>{status === "Debe" ? money(data.feeAmount) : "—"}</td>
                        <td className={debtMonths ? "fee-debt-value" : ""}>{debtMonths ? <><strong>{money(debtMonths * data.feeAmount)}</strong><small>{debtMonths} mes{debtMonths === 1 ? "" : "es"}</small></> : "—"}</td>
                        <td><div className="fee-row-actions"><select value={drafts[member.email] ?? status} onChange={(event) => setDrafts((currentDrafts) => ({ ...currentDrafts, [member.email]: event.target.value as SocialFeeStatus }))}>{STATUS_OPTIONS.map((option) => <option key={option.value || "empty"} value={option.value}>{option.label}</option>)}</select><select aria-label={`Alcance para ${member.name}`} value={draftScopes[member.email] ?? "month"} onChange={(event) => setDraftScopes((currentScopes) => ({ ...currentScopes, [member.email]: event.target.value as FeeScope }))}><option value="month">Mes</option><option value="year">Todo el año</option></select><Button variant="outline" size="sm" disabled={saving === member.email} onClick={() => void saveOne(member.email)}>{saving === member.email ? <LoaderCircle className="spin" /> : <Save />} Guardar</Button></div></td>
                      </tr>
                    );
                  })}
                  {!filteredRows.length ? <tr><td colSpan={7} className="empty-cell">No se encontraron integrantes con esos filtros.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section className="surface fee-personal-card">
          <header><div><p className="eyebrow">RESUMEN ANUAL</p><h2>{data.members[0]?.name ?? "Mi cuota social"}</h2></div><Badge variant="outline">{year}</Badge></header>
          <section className="mini-metrics fee-personal-metrics">
            <div><CircleDollarSign /><span><p>Pagadas</p><strong>{metrics.annualPaid}</strong><small>{money(metrics.annualCollected)}</small></span></div>
            <div><WalletCards /><span><p>Adeudadas</p><strong>{metrics.annualDebtCount}</strong><small>{money(metrics.annualDebt)}</small></span></div>
            <div><UsersRound /><span><p>Cumplimiento</p><strong>{metrics.annualPaid + metrics.annualDebtCount ? Math.round((metrics.annualPaid / (metrics.annualPaid + metrics.annualDebtCount)) * 100) : 0}%</strong><small>sobre cuotas computables</small></span></div>
          </section>
          <div className="fee-year-grid">
            {MONTHS.map((monthName, index) => {
              const monthNumber = index + 1;
              const record = recordsByKey.get(`${data.currentEmail}|${year}|${monthNumber}`);
              const status = record?.status ?? "";
              const canReport = data.canSelfReport && !EXCLUDED.has(status) && status !== "P";
              return <article key={monthName}><span><strong>{monthName}</strong><small>{record?.paidAt ? `Pago: ${formatDate(record.paidAt)}` : status === "Debe" ? `Adeuda: ${money(data.feeAmount)}` : ""}</small></span><FeeStatus status={status} />{canReport ? <Button size="sm" disabled={saving === data.currentEmail} onClick={() => { setMonth(monthNumber); void post({ year, month: monthNumber, status: "P" }, data.currentEmail); }}>Informar pago</Button> : null}</article>;
            })}
          </div>
          <p className="fee-help">{data.canSelfReport ? "Podés informar tus pagos. Beca, Baja y Exento sólo pueden ser modificados por un administrador." : "La carga de pagos por usuarios está deshabilitada. Un administrador debe registrar cualquier cambio."}</p>
        </section>
      )}
    </div>
  );
}
