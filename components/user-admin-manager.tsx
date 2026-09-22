"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, RefreshCw, Save, Search, ShieldCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { PlatformAccount, UserRole } from "@/lib/portal-types";

function message(value: unknown) {
  return value && typeof value === "object" && "error" in value ? String((value as { error: unknown }).error) : "No se pudo completar la operación.";
}

export function UserAdminManager() {
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fetchAccounts = useCallback(async () => {
    const response = await fetch("/api/usuarios", { cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(message(body));
    return (body as { accounts: PlatformAccount[] }).accounts;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setAccounts(await fetchAccounts());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }, [fetchAccounts]);

  useEffect(() => {
    let active = true;
    void fetchAccounts()
      .then((next) => { if (active) setAccounts(next); })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "No se pudieron cargar los usuarios."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchAccounts]);
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return !term ? accounts : accounts.filter((item) => `${item.name} ${item.email}`.toLowerCase().includes(term));
  }, [accounts, search]);

  function change(email: string, update: Partial<Pick<PlatformAccount, "role" | "active">>) {
    setAccounts((current) => current.map((item) => item.email === email ? { ...item, ...update } : item));
  }

  async function save(account: PlatformAccount) {
    setSaving(account.email);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/usuarios", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: account.email, role: account.role, active: account.active }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(message(body));
      setNotice(`Permisos actualizados para ${account.name}.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron guardar los permisos.");
      await load();
    } finally {
      setSaving("");
    }
  }

  return (
    <div className="page-stack">
      <section className="surface admin-card">
        <div className="connection-indicator live"><ShieldCheck /></div>
        <div><p className="eyebrow">ACCESO CON GOOGLE</p><h2>Usuarios, capacitadores y administradores</h2><p>El perfil Capacitador puede consultar y editar Scoring, pero no accede a Configuración, Administración, cuotas ni datos personales completos.</p></div>
      </section>
      <section className="surface account-manager">
        <header><div><h2>Permisos de la plataforma</h2><p>{accounts.filter((item) => item.active).length} cuentas activas · {accounts.filter((item) => item.role === "admin" && item.active).length} administradores · {accounts.filter((item) => item.role === "capacitador" && item.active).length} capacitadores</p></div><label><Search /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o email…" /></label><Button variant="outline" onClick={() => void load()}><RefreshCw /> Actualizar</Button></header>
        {notice ? <p className="success-message">{notice}</p> : null}
        {error ? <p className="inline-error" role="alert">{error}</p> : null}
        {loading ? <div className="manager-loading"><LoaderCircle className="spin" /> Cargando usuarios…</div> : (
          <div className="account-table-wrap"><table className="account-table"><thead><tr><th>Integrante</th><th>Usuario de Google</th><th>Rol</th><th>Acceso</th><th /></tr></thead><tbody>
            {rows.map((account) => (
              <tr key={account.email}><td><span className="account-name"><UserRound /><strong>{account.name}</strong></span></td><td>{account.email}</td><td><select value={account.role} onChange={(event) => change(account.email, { role: event.target.value as UserRole })}><option value="usuario">Usuario</option><option value="capacitador">Capacitador</option><option value="admin">Administrador</option></select></td><td><label className="account-access"><Switch checked={account.active} onCheckedChange={(active) => change(account.email, { active })} /><Badge className={account.active ? "status-active" : "status-absent"}>{account.active ? "Activo" : "Inactivo"}</Badge></label></td><td><Button size="sm" disabled={saving === account.email} onClick={() => void save(account)}>{saving === account.email ? <LoaderCircle className="spin" /> : <Save />} Guardar</Button></td></tr>
            ))}
          </tbody></table></div>
        )}
      </section>
    </div>
  );
}
