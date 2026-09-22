import { demoPortalDataBase } from "@/lib/demo-data";
import { hasGoogleSheetsConfig, readGoogleSheetsData } from "@/lib/google-sheets";
import type {
  Asistencia,
  AsistenciaSemanal,
  Cumpleanios,
  Integrante,
  PortalData,
  UserRole,
} from "@/lib/portal-types";

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function turnKind(turno: string) {
  const value = normalize(turno);
  if (value.includes("ambos") || value.includes("2 turnos")) return "ambos";
  if (value.includes("10") || value.includes("manana")) return "manana";
  if (value.includes("15") || value.includes("tarde")) return "tarde";
  return "otro";
}

function calculateUpcomingBirthdays(integrantes: Integrante[]): Cumpleanios[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const isoLocal = (date: Date) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  const ageAt = (birthYear: number, month: number, day: number, date: Date) => {
    let age = date.getFullYear() - birthYear;
    if (date.getMonth() + 1 < month || (date.getMonth() + 1 === month && date.getDate() < day)) age -= 1;
    return age;
  };
  return integrantes
    .flatMap((integrante) => {
      if (!integrante.fechaNacimiento) return [];
      const parts = integrante.fechaNacimiento.split("-").map(Number) as [number, number, number];
      if (parts.length !== 3 || parts.some(Number.isNaN)) return [];
      let next = new Date(now.getFullYear(), parts[1] - 1, parts[2]);
      if (next < now) next = new Date(now.getFullYear() + 1, parts[1] - 1, parts[2]);
      const diasRestantes = Math.round((next.getTime() - now.getTime()) / 86_400_000);
      return [
        {
          id: `cumple-${integrante.id}`,
          nombre: integrante.nombre,
          fechaNacimiento: integrante.fechaNacimiento,
          proximoCumpleanios: isoLocal(next),
          diasRestantes,
          edadActual: ageAt(parts[0], parts[1], parts[2], now),
          edadCumple: ageAt(parts[0], parts[1], parts[2], next),
          mes: parts[1],
          dia: parts[2],
        },
      ];
    })
    .sort((a, b) => a.diasRestantes - b.diasRestantes || a.nombre.localeCompare(b.nombre, "es"));
}

function weeklyAttendance(asistencias: Asistencia[]): AsistenciaSemanal[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (6 - offset));
    const iso = date.toISOString().slice(0, 10);
    const rows = asistencias.filter((row) => row.fecha === iso);
    const presentes = rows.filter((row) => row.asistio).length;
    return {
      dia: DAY_LABELS[date.getDay()],
      presentes,
      porcentaje: rows.length ? Math.round((presentes / rows.length) * 100) : 0,
    };
  });
}

function buildPortalData(base: Omit<PortalData, "cumpleanios" | "asistenciaSemanal" | "resumen">): PortalData {
  const cumpleanios = calculateUpcomingBirthdays(base.integrantes);
  const asistenciaSemanal = weeklyAttendance(base.asistencias);
  const month = new Date().toISOString().slice(0, 7);
  const currentMonth = base.asistencias.filter((row) => row.fecha?.startsWith(month));
  const attended = currentMonth.filter((row) => row.asistio).length;
  const monthRate = currentMonth.length ? Math.round((attended / currentMonth.length) * 100) : 0;
  const turnos = base.integrantes.reduce(
    (counts, integrante) => {
      const kind = turnKind(integrante.turno);
      if (kind === "manana") counts.manana += 1;
      if (kind === "tarde") counts.tarde += 1;
      if (kind === "ambos") counts.ambos += 1;
      return counts;
    },
    { manana: 0, tarde: 0, ambos: 0 },
  );

  return {
    ...base,
    cumpleanios,
    asistenciaSemanal,
    resumen: {
      integrantesActivos: base.integrantes.filter((item) => item.estado === "Activo").length,
      asistenciaMes: monthRate,
      cumpleaniosProximos: cumpleanios.filter((item) => item.diasRestantes <= 30).length,
      turnos,
    },
  };
}

function withSharedBirthdayCalendar(scoped: PortalData, source: PortalData): PortalData {
  const cumpleanios = source.cumpleanios.map((item) => ({
    ...item,
    fechaNacimiento: `2000-${String(item.mes).padStart(2, "0")}-${String(item.dia).padStart(2, "0")}`,
    edadActual: 0,
    edadCumple: 0,
  }));
  return {
    ...scoped,
    userScreens: [...new Set([...scoped.userScreens, "cumpleanios" as const, "desempenos" as const])],
    cumpleanios,
    resumen: {
      ...scoped.resumen,
      cumpleaniosProximos: cumpleanios.filter((item) => item.diasRestantes <= 30).length,
    },
  };
}

export async function getPortalData(): Promise<PortalData> {
  if (!hasGoogleSheetsConfig()) return buildPortalData(demoPortalDataBase());
  try {
    const live = await readGoogleSheetsData();
    return buildPortalData({ source: "google-sheets", ...live });
  } catch (error) {
    const demo = demoPortalDataBase();
    return buildPortalData({
      ...demo,
      source: "fallback",
      connectionError: error instanceof Error ? error.message : "No se pudo leer la planilla.",
    });
  }
}

export function scopePortalData(data: PortalData, viewer: { email: string; role: UserRole }): PortalData {
  if (viewer.role === "admin") return data;
  const email = viewer.email.trim().toLowerCase();
  const ownMembers = data.integrantes.filter((item) => item.email?.trim().toLowerCase() === email);
  // Asistencias sólo guarda nombres; evitamos atribuir registros si el nombre no es único.
  const nameCounts = new Map<string, number>();
  for (const member of data.integrantes) {
    const name = normalize(member.nombre).trim();
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }
  const uniqueNames = new Set(ownMembers.map((item) => normalize(item.nombre).trim()).filter((name) => nameCounts.get(name) === 1));
  const ownAttendance = data.asistencias.filter((item) => uniqueNames.has(normalize(item.nombre).trim()));
  const ownFees = data.cuotas.filter((item) => {
    const recordEmail = item.email?.trim().toLowerCase();
    return recordEmail ? recordEmail === email : uniqueNames.has(normalize(item.name).trim());
  });
  if (viewer.role === "capacitador") {
    const scoped = buildPortalData({
      source: data.source,
      connectionError: data.connectionError,
      userScreens: [],
      integrantes: data.integrantes.map((item) => ({ ...item, anioIngreso: "—", fechaNacimiento: null })),
      asistencias: ownAttendance,
      cuotas: ownFees,
      habilidades: { categorias: [], registros: 0, columnas: [], integrantes: [] },
      scoringHistory: data.scoringHistory,
      scoringTopics: data.scoringTopics,
    });
    return withSharedBirthdayCalendar(scoped, data);
  }
  const scoped = buildPortalData({
    source: data.source,
    connectionError: data.connectionError,
    userScreens: data.userScreens,
    integrantes: ownMembers,
    asistencias: ownAttendance,
    cuotas: ownFees,
    habilidades: { categorias: [], registros: 0, columnas: [], integrantes: [] },
    scoringHistory: data.scoringHistory.filter((item) => item.email?.trim().toLowerCase() === email),
    scoringTopics: data.scoringTopics,
  });
  return withSharedBirthdayCalendar(scoped, data);
}
