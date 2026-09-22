"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, CakeSlice, CalendarPlus, Check, ClipboardList, Clock3, Eye, EyeOff, GraduationCap, ListPlus, LoaderCircle, LockKeyhole, Mail, Plus, RefreshCw, Save, Send, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { BirthdayAutomationSettings, ConfigCategory, ConfigItem } from "@/lib/portal-types";

type ConfigSection = ConfigCategory | "CUMPLEANOS_CONFIG";

const categories: Array<{ id: ConfigSection; label: string; description: string; icon: typeof Clock3 }> = [
  { id: "HORARIO", label: "Horarios", description: "Opciones del horario de asistencia", icon: Clock3 },
  { id: "TITULO", label: "Títulos", description: "Niveles y títulos educativos", icon: GraduationCap },
  { id: "ACTIVIDAD", label: "Actividades", description: "Actividades de interés del año", icon: ListPlus },
  { id: "TAREA", label: "Tareas", description: "Funciones dentro del Proyecto", icon: Wrench },
  { id: "TEMA_SCORING", label: "Temas de scoring", description: "Contenidos que se califican cada año", icon: ClipboardList },
  { id: "PANTALLA", label: "Pantallas de usuarios", description: "Qué secciones pueden abrir los usuarios", icon: Eye },
  { id: "PERMISO", label: "Permisos", description: "Qué acciones pueden realizar los usuarios", icon: LockKeyhole },
  { id: "VALOR_CUOTA", label: "Valor cuota social", description: "Importe mensual correspondiente a cada año", icon: Banknote },
  { id: "CUMPLEANOS_CONFIG", label: "Saludos de cumpleaños", description: "Correo automático, copia y Google Calendar", icon: CakeSlice },
];

const birthdayConfigTypes: ConfigCategory[] = ["CUMPLEANOS_AUTOMATICO", "CUMPLEANOS_COPIA", "CUMPLEANOS_CALENDARIO", "CUMPLEANOS_ASUNTO", "CUMPLEANOS_MENSAJE"];
const editableCategories: ConfigCategory[] = ["HORARIO", "TITULO", "ACTIVIDAD", "TAREA", "TEMA_SCORING"];
const defaultBirthdaySettings: BirthdayAutomationSettings = {
  enabled: false,
  ccEmail: "brechasdigitales@proyecto-puente.org",
  calendarEmail: "brechasdigitales@proyecto-puente.org",
  subjectTemplate: "¡Feliz cumpleaños, {{nombre}}!",
  messageTemplate: "¡Feliz cumpleaños, {{nombre}}! Todo el equipo de Proyecto Puente te desea un día lleno de alegría y buenos momentos.",
};

const screenLabels: Record<string, string> = {
  inicio: "Inicio",
  integrantes: "Mis datos",
  asistencia: "Mi asistencia",
  cumpleanios: "Cumpleaños",
  cuota: "Mis cuotas",
  reportes: "Estadísticas",
};

const permissionLabels: Record<string, string> = {
  CUOTA_USUARIO_PUEDE_MARCAR_PAGO: "Permitir que los usuarios informen su cuota como pagada",
  INTEGRANTES_USUARIO_PUEDE_EDITAR: "Permitir que los usuarios editen su propia ficha",
};

const memberEditPermission = "INTEGRANTES_USUARIO_PUEDE_EDITAR";

function withRequiredPermissions(items: ConfigItem[]) {
  if (items.some((item) => item.type === "PERMISO" && item.value === memberEditPermission)) return items;
  const lastOrder = Math.max(0, ...items.filter((item) => item.type === "PERMISO").map((item) => item.order));
  return [...items, { rowNumber: 0, type: "PERMISO" as const, value: memberEditPermission, active: false, order: lastOrder + 1 }];
}

function message(value: unknown) {
  return value && typeof value === "object" && "error" in value ? String((value as { error: unknown }).error) : "No se pudo completar la operación.";
}

function FeeAmountEditor({ year, initialValue, onSaved }: { year: number; initialValue: string; onSaved: () => Promise<void> }) {
  const [amount, setAmount] = useState(initialValue);
  const [amountVisible, setAmountVisible] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function save() {
    const numericAmount = Number(amount);
    if (!amount.trim() || !Number.isFinite(numericAmount) || numericAmount < 0) {
      setError("Ingresá un importe válido igual o mayor que cero.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/configuracion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "VALOR_CUOTA", year, amount: numericAmount }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(message(body));
      setNotice(`El valor mensual de la cuota para ${year} quedó guardado.`);
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el valor de la cuota.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fee-config-editor">
      <div className="fee-config-note">
        <Banknote />
        <span><strong>Importe mensual para {year}</strong><small>Este valor se usa para calcular la recaudación y las cuotas marcadas como Debe. Los años anteriores conservan su propio importe.</small></span>
      </div>
      <label><span>Valor de una cuota en pesos</span><div><span className="currency-prefix">$</span><Input type={amountVisible ? "number" : "password"} min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Ej.: 5000" /><Button type="button" variant="outline" size="icon" className="fee-config-visibility" onClick={() => setAmountVisible((visible) => !visible)} aria-label={amountVisible ? "Ocultar valor de cuota" : "Mostrar valor de cuota"}>{amountVisible ? <EyeOff /> : <Eye />}</Button><Button disabled={saving || !amount.trim()} onClick={() => void save()}>{saving ? <LoaderCircle className="spin" /> : <Check />} Guardar valor</Button></div></label>
      {notice ? <p className="success-message"><Check /> {notice}</p> : null}
      {error ? <p className="inline-error" role="alert">{error}</p> : null}
    </div>
  );
}

function birthdaySettingsFromItems(items: ConfigItem[]): BirthdayAutomationSettings {
  const value = (type: ConfigCategory, fallback: string) => items.find((item) => item.type === type)?.value || fallback;
  return {
    enabled: items.find((item) => item.type === "CUMPLEANOS_AUTOMATICO")?.active ?? defaultBirthdaySettings.enabled,
    ccEmail: value("CUMPLEANOS_COPIA", defaultBirthdaySettings.ccEmail),
    calendarEmail: value("CUMPLEANOS_CALENDARIO", defaultBirthdaySettings.calendarEmail),
    subjectTemplate: value("CUMPLEANOS_ASUNTO", defaultBirthdaySettings.subjectTemplate),
    messageTemplate: value("CUMPLEANOS_MENSAJE", defaultBirthdaySettings.messageTemplate),
  };
}

function BirthdayAutomationEditor({ items, onSaved }: { items: ConfigItem[]; onSaved: () => Promise<void> }) {
  const [settings, setSettings] = useState(() => birthdaySettingsFromItems(items));
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<"calendar" | "email" | "">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function update<K extends keyof BirthdayAutomationSettings>(key: K, value: BirthdayAutomationSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/configuracion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "CUMPLEANOS_CONFIG", settings }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(message(body));
      setNotice("La configuración de cumpleaños quedó guardada.");
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  async function run(action: "sync-calendar" | "test-email") {
    setRunning(action === "sync-calendar" ? "calendar" : "email");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/cumpleanios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await response.json().catch(() => null) as { message?: string; error?: string } | null;
      if (!response.ok) throw new Error(message(body));
      setNotice(body?.message || "La operación terminó correctamente.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo completar la operación.");
    } finally {
      setRunning("");
    }
  }

  return (
    <div className="birthday-config-editor">
      <div className="birthday-config-status">
        <div><CakeSlice /><span><strong>Saludo diario automático</strong><small>Vercel revisará los cumpleaños todos los días a las 09:00 de Argentina.</small></span></div>
        <Switch checked={settings.enabled} onCheckedChange={(value) => update("enabled", value)} aria-label="Activar saludo automático de cumpleaños" />
      </div>
      <div className="birthday-config-grid">
        <label><span>Enviar copia a</span><Input type="email" value={settings.ccEmail} onChange={(event) => update("ccEmail", event.target.value)} placeholder="correo@proyecto-puente.org" /></label>
        <label><span>Calendario de Google</span><Input type="email" value={settings.calendarEmail} onChange={(event) => update("calendarEmail", event.target.value)} placeholder="calendario@proyecto-puente.org" /></label>
      </div>
      <label><span>Asunto personalizado</span><Input value={settings.subjectTemplate} onChange={(event) => update("subjectTemplate", event.target.value)} /><small>Usá <code>{"{{nombre}}"}</code> para el primer nombre o <code>{"{{nombre_completo}}"}</code> para el nombre completo.</small></label>
      <label><span>Mensaje</span><Textarea rows={6} value={settings.messageTemplate} onChange={(event) => update("messageTemplate", event.target.value)} /><small>El mensaje se enviará al email-puente del integrante y con copia a la casilla indicada arriba.</small></label>
      <div className="birthday-config-actions">
        <Button onClick={() => void save()} disabled={saving || Boolean(running)}>{saving ? <LoaderCircle className="spin" /> : <Save />} Guardar configuración</Button>
        <Button variant="outline" onClick={() => void run("test-email")} disabled={saving || Boolean(running)}>{running === "email" ? <LoaderCircle className="spin" /> : <Send />} Probar correo</Button>
        <Button variant="outline" onClick={() => void run("sync-calendar")} disabled={saving || Boolean(running)}>{running === "calendar" ? <LoaderCircle className="spin" /> : <CalendarPlus />} Sincronizar calendario</Button>
      </div>
      <div className="birthday-config-requirements"><Mail /><p><strong>Requisitos de publicación</strong><span>Vercel necesita RESEND_API_KEY, BIRTHDAY_FROM_EMAIL y CRON_SECRET. Además, el calendario debe compartirse con la cuenta de servicio de Google con permiso para modificar eventos.</span></p></div>
      {notice ? <p className="success-message"><Check /> {notice}</p> : null}
      {error ? <p className="inline-error" role="alert">{error}</p> : null}
    </div>
  );
}

export function ConfigurationManager() {
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [category, setCategory] = useState<ConfigSection>("HORARIO");
  const [feeYear, setFeeYear] = useState(new Date().getFullYear());
  const [newValue, setNewValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fetchItems = useCallback(async () => {
    const response = await fetch("/api/configuracion", { cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(message(body));
    return withRequiredPermissions((body as { items: ConfigItem[] }).items);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await fetchItems());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar la configuración.");
    } finally {
      setLoading(false);
    }
  }, [fetchItems]);

  useEffect(() => {
    let active = true;
    void fetchItems()
      .then((next) => { if (active) setItems(next); })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "No se pudo cargar la configuración."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchItems]);
  const current = useMemo(() => items.filter((item) => item.type === category).sort((a, b) => a.order - b.order), [category, items]);
  const feeYears = useMemo(() => [...new Set([
    new Date().getFullYear() + 1,
    new Date().getFullYear(),
    new Date().getFullYear() - 1,
    ...items.filter((item) => item.type === "VALOR_CUOTA").map((item) => item.order),
  ])].sort((a, b) => b - a), [items]);
  const feeItem = items.find((item) => item.type === "VALOR_CUOTA" && item.order === feeYear);

  async function add() {
    if (!newValue.trim() || !editableCategories.includes(category as ConfigCategory)) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/configuracion", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: category, value: newValue }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(message(body));
      setNewValue("");
      setNotice("La opción fue agregada y ya está disponible en el formulario.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo agregar la opción.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: ConfigItem, active: boolean) {
    setItems((currentItems) => currentItems.map((entry) => entry.rowNumber === item.rowNumber ? { ...entry, active } : entry));
    const response = item.rowNumber === 0
      ? await fetch("/api/configuracion", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "PERMISO", value: item.value }) })
      : await fetch("/api/configuracion", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ rowNumber: item.rowNumber, active }) });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(message(body));
      await load();
      return;
    }
    if (item.rowNumber === 0) await load();
  }

  return (
    <div className="page-stack">
      <section className="surface configuration-hero">
        <div><p className="eyebrow">VALORES DE LOS FORMULARIOS</p><h2>Configuración</h2><p>Agregá opciones o desactivalas sin borrar el historial de los integrantes.</p></div>
        <Button variant="outline" onClick={() => void load()}><RefreshCw /> Actualizar</Button>
      </section>
      <section className="config-layout">
        <nav className="surface config-tabs" aria-label="Categorías de configuración">
          {categories.map((item) => {
            const Icon = item.icon;
            const total = item.id === "CUMPLEANOS_CONFIG"
              ? (items.find((entry) => entry.type === "CUMPLEANOS_AUTOMATICO")?.active ? 1 : 0)
              : items.filter((entry) => entry.type === item.id && entry.active).length;
            return <button key={item.id} className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)}><Icon /><span><strong>{item.label}</strong><small>{item.description}</small></span><Badge>{total}</Badge></button>;
          })}
        </nav>
        <section className="surface config-values">
          <header><div><p className="eyebrow">{category}</p><h2>{categories.find((item) => item.id === category)?.label}</h2></div></header>
          {category === "CUMPLEANOS_CONFIG" ? (
            <BirthdayAutomationEditor key={birthdayConfigTypes.map((type) => items.find((item) => item.type === type)?.value ?? "").join("|")} items={items} onSaved={load} />
          ) : category === "VALOR_CUOTA" ? (
            <div className="fee-config-section">
              <label className="fee-config-year"><span>Año</span><select value={feeYear} onChange={(event) => setFeeYear(Number(event.target.value))}>{feeYears.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <FeeAmountEditor key={`${feeYear}-${feeItem?.value ?? "new"}`} year={feeYear} initialValue={feeItem?.value ?? ""} onSaved={load} />
            </div>
          ) : category === "PANTALLA" || category === "PERMISO" ? (
            <p className="config-explainer">{category === "PANTALLA" ? "Activá las pantallas que podrán abrir los usuarios comunes. Cumpleaños permanece siempre visible para todos; Scoring, Desempeños, Configuración y Administración conservan sus permisos especiales." : "Los permisos están desactivados por defecto. Podés autorizar por separado que cada usuario edite únicamente su ficha o informe su propia cuota como pagada. Los controles también se aplican en el servidor."}</p>
          ) : (
            <div className="config-add"><Input value={newValue} onChange={(event) => setNewValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void add(); }} placeholder="Nueva opción…" /><Button disabled={saving || !newValue.trim()} onClick={() => void add()}>{saving ? <LoaderCircle className="spin" /> : <Plus />} Agregar</Button></div>
          )}
          {category !== "VALOR_CUOTA" && category !== "CUMPLEANOS_CONFIG" && notice ? <p className="success-message"><Check /> {notice}</p> : null}
          {category !== "VALOR_CUOTA" && category !== "CUMPLEANOS_CONFIG" && error ? <p className="inline-error" role="alert">{error}</p> : null}
          {category !== "VALOR_CUOTA" && category !== "CUMPLEANOS_CONFIG" && (loading ? <div className="manager-loading"><LoaderCircle className="spin" /> Cargando…</div> : (
            <div className="config-option-list">
              {current.map((item) => {
                const alwaysVisible = category === "PANTALLA" && item.value === "cumpleanios";
                const permissionStatus = item.value === memberEditPermission
                  ? (item.active ? "Los usuarios pueden editar únicamente su propia ficha" : "Las fichas están en modo sólo lectura para usuarios")
                  : (item.active ? "Los usuarios pueden informar su propia cuota" : "Sólo administradores pueden cargar pagos");
                return <div key={`${item.type}-${item.value}`}><span><strong>{category === "PANTALLA" ? screenLabels[item.value] ?? item.value : category === "PERMISO" ? permissionLabels[item.value] ?? item.value : item.value}</strong><small>{alwaysVisible ? "Siempre visible para todos los usuarios" : category === "PANTALLA" ? (item.active ? "Visible para usuarios" : "Oculta para usuarios") : category === "PERMISO" ? permissionStatus : (item.active ? "Disponible en los formularios" : "Opción desactivada")}</small></span><Switch checked={alwaysVisible || item.active} disabled={alwaysVisible} onCheckedChange={(active) => void toggle(item, active)} aria-label={`${item.active ? "Desactivar" : "Activar"} ${item.value}`} /></div>;
              })}
              {!current.length ? <p className="empty-message">Todavía no hay opciones en esta categoría.</p> : null}
            </div>
          ))}
        </section>
      </section>
    </div>
  );
}
