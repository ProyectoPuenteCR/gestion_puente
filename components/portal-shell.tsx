"use client";

import { type ReactNode, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  BookOpenCheck,
  CakeSlice,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  CircleUserRound,
  ClipboardPenLine,
  Download,
  FileChartColumn,
  FileText,
  Home,
  Menu,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRoundCheck,
  UserRoundX,
  UsersRound,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfigurationManager } from "@/components/configuration-manager";
import { CodeOfConductView } from "@/components/code-of-conduct-view";
import { AttendanceCalendar } from "@/components/attendance-calendar";
import { BirthdaysView } from "@/components/birthdays-view";
import { Input } from "@/components/ui/input";
import { IntegrantesManager } from "@/components/integrantes-manager";
import { ScoringMatrix } from "@/components/scoring-matrix";
import { PerformanceView } from "@/components/performance-view";
import { SocialFeeManager } from "@/components/social-fee-manager";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Integrante, PortalData, PortalUser } from "@/lib/portal-types";
import { UserAdminManager } from "@/components/user-admin-manager";
import { ThemeToggle } from "@/components/theme-toggle";

type ViewId = "inicio" | "convivencia" | "integrantes" | "asistencia" | "cumpleanios" | "cuota" | "habilidades" | "desempenos" | "reportes" | "configuracion" | "administracion";

const navigation: Array<{ id: ViewId; label: string; icon: typeof Home }> = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "convivencia", label: "Código de Convivencia", icon: FileText },
  { id: "integrantes", label: "Integrantes", icon: UsersRound },
  { id: "asistencia", label: "Asistencia", icon: BookOpenCheck },
  { id: "cumpleanios", label: "Cumpleaños", icon: CakeSlice },
  { id: "cuota", label: "Cuota", icon: CircleDollarSign },
  { id: "habilidades", label: "Scoring", icon: Sparkles },
  { id: "desempenos", label: "Desempeños", icon: ClipboardPenLine },
  { id: "reportes", label: "Estadísticas", icon: FileChartColumn },
  { id: "configuracion", label: "Configuración", icon: SlidersHorizontal },
  { id: "administracion", label: "Administración", icon: Settings },
];

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function turnType(value: string) {
  const normalized = normalize(value);
  if (normalized.includes("ambos") || normalized.includes("2 turnos")) return "ambos";
  if (normalized.includes("10") || normalized.includes("manana")) return "manana";
  if (normalized.includes("15") || normalized.includes("tarde")) return "tarde";
  return "otro";
}

function shortTurn(value: string) {
  const type = turnType(value);
  if (type === "manana") return "Mañana";
  if (type === "tarde") return "Tarde";
  if (type === "ambos") return "Ambos";
  return value || "Sin turno";
}

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(`${value}T12:00:00`),
  );
}

function MetricCard({
  label,
  value,
  supporting,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  supporting?: string;
  icon: typeof Home;
  tone: "teal" | "blue" | "coral" | "purple";
}) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <div className="metric-icon"><Icon /></div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {supporting ? <span>{supporting}</span> : null}
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: Integrante["estado"] }) {
  return <Badge className={status === "Activo" ? "status-active" : "status-pending"}>{status}</Badge>;
}

function TurnBadge({ turno }: { turno: string }) {
  const type = turnType(turno);
  return <span className={`turn-badge turn-${type}`}>{shortTurn(turno)}</span>;
}

function MemberTable({ integrantes, limit }: { integrantes: Integrante[]; limit?: number }) {
  const rows = typeof limit === "number" ? integrantes.slice(0, limit) : integrantes;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Matrícula</TableHead>
          <TableHead>Integrante</TableHead>
          <TableHead>Turno</TableHead>
          <TableHead>Año de ingreso</TableHead>
          <TableHead>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((integrante) => (
          <TableRow key={integrante.id}>
            <TableCell className="font-semibold text-slate-500">{integrante.matricula}</TableCell>
            <TableCell className="font-semibold text-slate-900">{integrante.nombre}</TableCell>
            <TableCell><TurnBadge turno={integrante.turno} /></TableCell>
            <TableCell>{integrante.anioIngreso}</TableCell>
            <TableCell><StatusBadge status={integrante.estado} /></TableCell>
          </TableRow>
        ))}
        {!rows.length ? (
          <TableRow><TableCell colSpan={5} className="empty-cell">No se encontraron integrantes.</TableCell></TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}

function DashboardView({ data, integrantes, onNavigate }: { data: PortalData; integrantes: Integrante[]; onNavigate: (view: ViewId) => void }) {
  const recent = [...integrantes].sort((a, b) => Number(b.matricula) - Number(a.matricula));
  return (
    <div className="page-stack">
      <section className="metrics-grid" aria-label="Indicadores generales">
        <MetricCard label="Integrantes activos" value={data.resumen.integrantesActivos} supporting={`${data.integrantes.length} registrados`} icon={UsersRound} tone="teal" />
        <MetricCard label="Asistencia del mes" value={`${data.resumen.asistenciaMes}%`} supporting="sobre registros del mes" icon={Activity} tone="blue" />
        <MetricCard label="Cumpleaños próximos" value={data.resumen.cumpleaniosProximos} supporting="en los próximos 30 días" icon={CakeSlice} tone="coral" />
        <MetricCard label="Turnos" value={`${data.resumen.turnos.manana} · ${data.resumen.turnos.tarde}`} supporting={`${data.resumen.turnos.ambos} en ambos turnos`} icon={CalendarDays} tone="purple" />
      </section>

      <section className="dashboard-grid">
        <article className="surface chart-card">
          <div className="section-heading">
            <div><p className="eyebrow">ÚLTIMOS 7 DÍAS</p><h2>Asistencia semanal</h2></div>
            <Badge variant="outline">Presentes y porcentaje</Badge>
          </div>
          <div className="chart-wrap" aria-label="Gráfico de asistencia semanal">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.asistenciaSemanal} margin={{ top: 16, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#e8eef5" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dia" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <ChartTooltip contentStyle={{ borderRadius: 14, border: "1px solid #dbe5ef", boxShadow: "0 12px 24px rgba(15, 23, 42, .08)" }} />
                <Bar yAxisId="left" dataKey="presentes" fill="#2f6fed" radius={[8, 8, 2, 2]} maxBarSize={36} name="Presentes" />
                <Line yAxisId="right" type="monotone" dataKey="porcentaje" stroke="#0f9f98" strokeWidth={3} dot={{ r: 4, fill: "#0f9f98", strokeWidth: 0 }} name="Asistencia %" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="surface birthdays-card">
          <div className="section-heading"><div><p className="eyebrow">AGENDA</p><h2>Próximos cumpleaños</h2></div></div>
          <div className="birthday-list">
            {data.cumpleanios.slice(0, 4).map((item) => (
              <div className="birthday-row" key={item.id}>
                <span className="birthday-icon"><CakeSlice /></span>
                <div><strong>{item.nombre}</strong><p>{formatDate(item.proximoCumpleanios)}</p></div>
                <Badge className="birthday-days">{item.diasRestantes === 0 ? "Hoy" : `${item.diasRestantes} días`}</Badge>
              </div>
            ))}
          </div>
          <button className="text-link" onClick={() => onNavigate("cumpleanios")}>Ver calendario completo <ChevronRight /></button>
        </article>
      </section>

      <section className="surface table-card">
        <div className="section-heading">
          <div><p className="eyebrow">ALTAS RECIENTES</p><h2>Integrantes</h2></div>
          <Button variant="outline" onClick={() => onNavigate("integrantes")}>Ver todos <ChevronRight /></Button>
        </div>
        <MemberTable integrantes={recent} limit={6} />
      </section>
    </div>
  );
}

function StatisticsView({ data, integrantes }: { data: PortalData; integrantes: Integrante[] }) {
  const availableYears = useMemo(() => [...new Set([
    new Date().getFullYear() + 1,
    new Date().getFullYear(),
    new Date().getFullYear() - 1,
    ...data.cuotas.map((item) => item.year),
  ])].sort((a, b) => b - a), [data.cuotas]);
  const [year, setYear] = useState(new Date().getFullYear());

  const memberStats = useMemo(() => integrantes.map((member) => {
    const rows = data.cuotas.filter((item) => item.year === year && (item.email === member.email || normalize(item.name) === normalize(member.nombre)));
    const paid = rows.filter((item) => item.status === "P").length;
    const debt = rows.filter((item) => item.status === "Debe").length;
    const excluded = rows.filter((item) => item.status === "Beca" || item.status === "Baja" || item.status === "Exento").length;
    const computable = paid + debt;
    return {
      id: member.id,
      name: member.nombre,
      email: member.email ?? "",
      paid,
      debt,
      excluded,
      pending: Math.max(0, 12 - paid - debt - excluded),
      rate: computable ? Math.round((paid / computable) * 100) : 0,
      computable,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "es")), [data.cuotas, integrantes, year]);

  const monthlyStats = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const rows = data.cuotas.filter((item) => item.year === year && item.month === index + 1);
    const paid = rows.filter((item) => item.status === "P").length;
    const debt = rows.filter((item) => item.status === "Debe").length;
    const computable = paid + debt;
    return { month: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][index], pagaron: paid, noPagaron: debt, cumplimiento: computable ? Math.round((paid / computable) * 100) : 0 };
  }), [data.cuotas, year]);

  const totals = useMemo(() => {
    const paid = monthlyStats.reduce((sum, item) => sum + item.pagaron, 0);
    const debt = monthlyStats.reduce((sum, item) => sum + item.noPagaron, 0);
    const computable = paid + debt;
    return {
      paid,
      debt,
      rate: computable ? Math.round((paid / computable) * 100) : 0,
      membersWithDebt: memberStats.filter((item) => item.debt > 0).length,
    };
  }, [memberStats, monthlyStats]);

  function downloadRosterCsv() {
    const lines = [
      ["Matrícula", "Integrante", "Turno", "Año de ingreso", "Estado"],
      ...integrantes.map((item) => [item.matricula, item.nombre, shortTurn(item.turno), item.anioIngreso, item.estado]),
    ];
    const csv = lines.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "integrantes-proyecto-puente.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadStatisticsCsv() {
    const lines: Array<Array<string | number>> = [
      ["Estadísticas de cuota social", year],
      [],
      ["Mes", "Pagaron", "No pagaron", "Cumplimiento"],
      ...monthlyStats.map((item) => [item.month, item.pagaron, item.noPagaron, `${item.cumplimiento}%`]),
      [],
      ["Integrante", "email-puente", "Pagadas", "Adeudadas", "No computan", "Sin cargar", "Cumplimiento"],
      ...memberStats.map((item) => [item.name, item.email, item.paid, item.debt, item.excluded, item.pending, `${item.rate}%`]),
    ];
    const csv = lines.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `estadisticas-cuota-social-${year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-stack statistics-page">
      <section className="surface statistics-hero">
        <div><p className="eyebrow">CUOTA SOCIAL · INDICADORES</p><h2>Estadísticas de cumplimiento</h2><p>Comparación mensual de quienes pagaron y quienes tienen la cuota marcada como Debe.</p></div>
        <div className="statistics-actions"><label><span>Año</span><select value={year} onChange={(event) => setYear(Number(event.target.value))}>{availableYears.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><Button variant="outline" onClick={downloadStatisticsCsv}><Download /> Estadísticas CSV</Button><Button variant="outline" onClick={downloadRosterCsv}><Download /> Padrón CSV</Button></div>
      </section>

      <section className="mini-metrics statistics-metrics">
        <div><CircleDollarSign /><span><p>Cumplimiento general</p><strong>{totals.rate}%</strong><small>Pagó / (Pagó + Debe)</small></span></div>
        <div><UserRoundCheck /><span><p>Pagos registrados</p><strong>{totals.paid}</strong><small>durante {year}</small></span></div>
        <div><UserRoundX /><span><p>Cuotas sin pagar</p><strong>{totals.debt}</strong><small>estado Debe</small></span></div>
        <div><UsersRound /><span><p>Integrantes con deuda</p><strong>{totals.membersWithDebt}</strong><small>al menos una cuota</small></span></div>
      </section>

      <section className="surface statistics-chart-card">
        <div className="section-heading"><div><p className="eyebrow">EVOLUCIÓN MENSUAL · {year}</p><h2>Pagaron y no pagaron por mes</h2></div><Badge variant="outline">Beca, Baja y Exento no computan</Badge></div>
        <div className="statistics-chart" aria-label={`Gráfico mensual de cumplimiento de cuota ${year}`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyStats} margin={{ top: 18, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#e8eef5" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis yAxisId="count" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <ChartTooltip contentStyle={{ borderRadius: 14, border: "1px solid #dbe5ef", boxShadow: "0 12px 24px rgba(15, 23, 42, .08)" }} />
              <Legend />
              <Bar yAxisId="count" dataKey="pagaron" fill="#16a46b" radius={[7, 7, 2, 2]} maxBarSize={28} name="Pagaron" />
              <Bar yAxisId="count" dataKey="noPagaron" fill="#e05d55" radius={[7, 7, 2, 2]} maxBarSize={28} name="No pagaron (Debe)" />
              <Line yAxisId="rate" type="monotone" dataKey="cumplimiento" stroke="#2f6fed" strokeWidth={3} dot={{ r: 3, fill: "#2f6fed", strokeWidth: 0 }} name="Cumplimiento %" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="surface statistics-table-card">
        <div className="section-heading"><div><p className="eyebrow">DETALLE POR INTEGRANTE · {year}</p><h2>Tasa de cumplimiento de pago</h2></div><Badge variant="outline">{memberStats.length} integrantes</Badge></div>
        <div className="statistics-table-wrap"><Table><TableHeader><TableRow><TableHead>Integrante</TableHead><TableHead>Pagadas</TableHead><TableHead>Adeudadas</TableHead><TableHead>No computan</TableHead><TableHead>Sin cargar</TableHead><TableHead>Cumplimiento</TableHead></TableRow></TableHeader><TableBody>{memberStats.map((item) => <TableRow key={item.id}><TableCell><strong>{item.name}</strong><small>{item.email}</small></TableCell><TableCell>{item.paid}</TableCell><TableCell className={item.debt ? "statistics-debt" : ""}>{item.debt}</TableCell><TableCell>{item.excluded}</TableCell><TableCell>{item.pending}</TableCell><TableCell><Badge className={item.computable === 0 ? "fee-status-empty" : item.rate >= 80 ? "score-high" : item.rate >= 60 ? "score-medium" : "score-low"}>{item.computable ? `${item.rate}%` : "Sin datos"}</Badge></TableCell></TableRow>)}</TableBody></Table></div>
      </section>
    </div>
  );
}

export function PortalShell({
  data,
  user,
  logoutControl,
  conductAcceptanceRequired,
}: {
  data: PortalData;
  user: PortalUser;
  logoutControl: ReactNode;
  conductAcceptanceRequired: boolean;
}) {
  const router = useRouter();
  const isAdmin = user.role === "admin";
  const isTrainer = user.role === "capacitador";
  const canEditScoring = isAdmin || isTrainer;
  const [view, setView] = useState<ViewId>(() => conductAcceptanceRequired ? "convivencia" : isAdmin ? "inicio" : isTrainer ? "habilidades" : (data.userScreens[0] ?? "integrantes"));
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const availableNavigation = useMemo(
    () => {
      if (conductAcceptanceRequired) return navigation.filter((item) => item.id === "convivencia");
      if (isAdmin) return navigation;
      if (isTrainer) return navigation.filter((item) => item.id === "convivencia" || item.id === "cumpleanios" || item.id === "habilidades" || item.id === "desempenos");
      const allowed = new Set<string>(["convivencia", ...data.userScreens]);
      return navigation.filter((item) => allowed.has(item.id));
    },
    [conductAcceptanceRequired, data.userScreens, isAdmin, isTrainer],
  );

  const filteredMembers = useMemo(() => {
    const term = normalize(search.trim());
    return data.integrantes.filter((integrante) => {
      const matchesSearch = !term || normalize(`${integrante.nombre} ${integrante.matricula}`).includes(term);
      return matchesSearch;
    });
  }, [data.integrantes, search]);

  const filteredAttendance = useMemo(() => {
    const term = normalize(search.trim());
    return data.asistencias.filter((row) => !term || normalize(row.nombre).includes(term));
  }, [data.asistencias, search]);

  function refresh() {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 650);
  }

  const title = view === "desempenos" && !isAdmin ? "Mi desempeño" : availableNavigation.find((item) => item.id === view)?.label ?? "Inicio";

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="portal-sidebar">
        <SidebarHeader className="sidebar-brand-wrap">
          <div className="sidebar-brand">
            <Image className="sidebar-logo" src="/logo-proyecto-puente.jpg" alt="Proyecto Puente" width={180} height={118} priority />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {availableNavigation.map((item) => {
                  const Icon = item.icon;
                  const label = item.id === "desempenos" && !isAdmin ? "Mi desempeño" : item.label;
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton isActive={view === item.id} onClick={() => setView(item.id)} tooltip={label}>
                        <Icon /><span>{label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="privacy-box"><ShieldCheck /><span>Vista segura<br /><small>Sin datos médicos</small></span></div>
          {logoutControl}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="portal-main">
        <header className="topbar">
          <div className="topbar-title"><SidebarTrigger className="sidebar-trigger"><Menu /></SidebarTrigger><div><p>Panel de gestión</p><h1>{title}</h1></div></div>
          <div className="topbar-actions">
            {view !== "convivencia" && view !== "integrantes" && view !== "configuracion" && view !== "administracion" && view !== "desempenos" && view !== "cuota" && view !== "habilidades" ? <label className="search-box"><Search /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar integrante…" aria-label="Buscar integrante" /></label> : null}
            <ThemeToggle />
            <Button variant="outline" size="icon" onClick={refresh} aria-label="Actualizar datos"><RefreshCw className={refreshing ? "spin" : ""} /></Button>
            <button className="notification-button" aria-label="Notificaciones"><Bell /><span>2</span></button>
            <div className="user-chip">
              <CircleUserRound />
              <span>
                <small>{isAdmin ? "Administrador" : isTrainer ? "Capacitador" : "Usuario"}</small>
                <strong>{user.name || user.email}</strong>
              </span>
            </div>
          </div>
        </header>

        {data.source !== "google-sheets" ? (
          <div className={data.source === "fallback" ? "source-banner error" : "source-banner"}>
            <ShieldCheck />
            <span><strong>{data.source === "fallback" ? "No se pudo conectar a Google Sheets." : "Estás viendo una demostración con datos ficticios."}</strong>{data.connectionError ? ` ${data.connectionError}` : " Carga las variables de Vercel para activar la planilla real."}</span>
          </div>
        ) : null}

        <main className="content-area">
          {view === "inicio" ? <DashboardView data={data} integrantes={filteredMembers} onNavigate={setView} /> : null}
          {view === "convivencia" ? <CodeOfConductView user={user} locked={conductAcceptanceRequired} /> : null}
          {view === "integrantes" ? <IntegrantesManager data={data} onNavigate={(next) => setView(next)} /> : null}
          {view === "asistencia" ? <AttendanceCalendar rows={filteredAttendance} /> : null}
          {view === "cumpleanios" ? <BirthdaysView items={data.cumpleanios} showPrivateDetails={isAdmin} /> : null}
          {view === "cuota" ? <SocialFeeManager /> : null}
          {view === "habilidades" && canEditScoring ? <ScoringMatrix data={data} /> : null}
          {view === "desempenos" ? <PerformanceView key={`${user.email}:${user.role}`} data={data} user={user} /> : null}
          {view === "reportes" ? <StatisticsView data={data} integrantes={filteredMembers} /> : null}
          {view === "configuracion" && isAdmin ? <ConfigurationManager /> : null}
          {view === "administracion" && isAdmin ? <UserAdminManager /> : null}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
