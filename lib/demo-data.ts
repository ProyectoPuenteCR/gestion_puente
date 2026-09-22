import type { Asistencia, Integrante, PortalData } from "@/lib/portal-types";

const turnos = ["De 10 a 13hs", "De 15 a 18hs", "Ambos turnos"];

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildDemoIntegrantes(): Integrante[] {
  return Array.from({ length: 57 }, (_, index) => {
    const number = index + 1;
    const birthDate = new Date(Date.UTC(1996 + (number % 15), number % 12, (number * 3) % 27 + 1));
    return {
      id: `demo-integrante-${number}`,
      matricula: String(number).padStart(3, "0"),
      nombre: `Integrante ${String(number).padStart(3, "0")}`,
      email: `integrante.${number}@proyecto-puente.org`,
      turno: turnos[number % turnos.length],
      anioIngreso: String(2010 + (number % 17)),
      estado: number % 11 === 0 ? "Pendiente" : "Activo",
      fechaNacimiento: isoDate(birthDate),
    };
  });
}

function buildDemoAsistencias(integrantes: Integrante[]): Asistencia[] {
  const today = new Date();
  const rows: Asistencia[] = [];

  for (let dayOffset = 0; dayOffset < 28; dayOffset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - dayOffset);
    integrantes.slice(0, 34).forEach((integrante, index) => {
      const asistio = (index + dayOffset) % 6 !== 0;
      rows.push({
        id: `demo-asistencia-${dayOffset}-${index}`,
        nombre: integrante.nombre,
        fecha: isoDate(date),
        asistio,
        turno: integrante.turno,
        motivo: asistio ? "" : "Ausencia registrada",
      });
    });
  }
  return rows;
}

export function getDemoRows() {
  const integrantes = buildDemoIntegrantes();
  const asistencias = buildDemoAsistencias(integrantes);
  return { integrantes, asistencias };
}

export function demoPortalDataBase(): Pick<PortalData, "source" | "integrantes" | "asistencias" | "cuotas" | "habilidades" | "scoringHistory" | "scoringTopics" | "userScreens"> {
  const { integrantes, asistencias } = getDemoRows();
  return {
    source: "demo",
    userScreens: ["inicio", "integrantes", "asistencia", "cumpleanios", "cuota", "reportes"],
    integrantes,
    asistencias,
    cuotas: integrantes.flatMap((integrante, memberIndex) => Array.from({ length: 8 }, (_, monthIndex) => ({
      id: `demo-cuota-${memberIndex}-${monthIndex + 1}`,
      rowNumber: memberIndex * 8 + monthIndex + 2,
      year: new Date().getFullYear(),
      month: monthIndex + 1,
      monthName: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto"][monthIndex],
      email: integrante.email ?? "",
      name: integrante.nombre,
      status: memberIndex % 13 === 0 ? "Exento" as const : monthIndex < 6 ? "P" as const : monthIndex === 6 ? "Debe" as const : "" as const,
      paidAt: monthIndex < 6 ? new Date().toISOString() : "",
      updatedAt: new Date().toISOString(),
      updatedBy: "demo@proyecto-puente.org",
    }))),
    scoringTopics: ["Armado de PC", "Armado de Notebook", "Impresoras", "DVTICS"],
    scoringHistory: integrantes.slice(0, 34).flatMap((integrante, memberIndex) => [
      { id: `demo-history-${memberIndex}-4`, rowNumber: memberIndex * 3 + 2, year: new Date().getFullYear(), month: 4, email: integrante.email ?? "", name: integrante.nombre, topic: "Armado de PC", score: memberIndex % 5 ? 8 : 6, observation: memberIndex % 5 ? "Buen desempeño" : "Puede mejorar", updatedAt: new Date().toISOString(), updatedBy: "demo@proyecto-puente.org" },
      { id: `demo-history-${memberIndex}-5`, rowNumber: memberIndex * 3 + 3, year: new Date().getFullYear(), month: 5, email: integrante.email ?? "", name: integrante.nombre, topic: "Armado de Notebook", score: memberIndex % 4 ? 9 : null, observation: memberIndex % 4 ? "Buena presentación" : "", updatedAt: new Date().toISOString(), updatedBy: "demo@proyecto-puente.org" },
      { id: `demo-history-${memberIndex}-8`, rowNumber: memberIndex * 3 + 4, year: new Date().getFullYear(), month: 8, email: integrante.email ?? "", name: integrante.nombre, topic: "DVTICS", score: memberIndex % 3 ? 8 : 7, observation: "Conoce los conceptos", updatedAt: new Date().toISOString(), updatedBy: "demo@proyecto-puente.org" },
    ]),
    habilidades: {
      categorias: ["PCs", "Impresoras", "Redes"],
      registros: integrantes.length,
      columnas: [
        { id: "demo-abril", area: "PCs", mes: "ABRIL", tarea: "Armado de PC", scoreColumn: 2, observationColumn: 3 },
        { id: "demo-mayo", area: "Impresoras", mes: "MAYO", tarea: "Armado de Notebook", scoreColumn: 4, observationColumn: 5 },
        { id: "demo-agosto", area: "Redes", mes: "AGOSTO", tarea: "DVTICS", scoreColumn: 6, observationColumn: 7 },
      ],
      integrantes: integrantes.map((integrante, index) => ({
          id: `demo-scoring-${integrante.id}`,
          rowNumber: index + 5,
        nombre: integrante.nombre,
        turno: integrante.turno,
          final: "",
          finalColumn: 8,
        resultados: [
          { columnId: "demo-abril", calificacion: index % 5 ? 8 : 6, observacion: index % 5 ? "Buen desempeño" : "Puede mejorar" },
          { columnId: "demo-mayo", calificacion: index % 4 ? 9 : null, observacion: index % 4 ? "Buena presentación" : "" },
          { columnId: "demo-agosto", calificacion: index % 3 ? 8 : 7, observacion: "Conoce los conceptos" },
        ],
      })),
    },
  };
}
