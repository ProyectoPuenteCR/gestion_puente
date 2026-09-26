export type DataSource = "google-sheets" | "demo" | "fallback";

export type UserRole = "admin" | "capacitador" | "usuario";

export type PortalUser = {
  name?: string | null;
  email: string;
  image?: string | null;
  role: UserRole;
};

export type CodeOfConductAcceptance = {
  id: string;
  email: string;
  name: string;
  dni: string;
  role: UserRole;
  documentName: string;
  revision: string;
  driveModifiedTime: string;
  acceptedAt: string;
  acceptanceYear: number;
  acceptsCode: boolean;
  acceptsImages: boolean;
  acceptsFee: boolean;
  feeReason: string;
  requiresTutorSignature: boolean;
};

export type CodeOfConductUserStatus = {
  email: string;
  name: string;
  role: UserRole;
  status: "accepted" | "outdated" | "pending";
  acceptedAt: string;
  dni: string;
  requiresTutorSignature: boolean;
};

export type MemberFieldValue = string | boolean;

export type MemberRecord = {
  id: string;
  rowNumber: number;
  values: Record<string, MemberFieldValue>;
  age: number | null;
  ageStatus: "Mayor de edad" | "Menor de edad" | "Sin fecha";
};

export type HistoricalMemberRecord = {
  id: string;
  rowNumber: number;
  bajaDate: string;
  reason: string;
  deactivatedBy: string;
  values: Record<string, MemberFieldValue>;
  age: number | null;
  ageStatus: "Mayor de edad" | "Menor de edad" | "Sin fecha";
};

export type NewMemberRequestStatus = "invitation" | "expired" | "pending" | "approved" | "rejected" | "incorporated";

export type NewMemberRequest = {
  id: string;
  rowNumber: number;
  status: NewMemberRequestStatus;
  createdAt: string;
  expiresAt: string;
  createdBy: string;
  submittedAt: string;
  reviewedAt: string;
  reviewedBy: string;
  rejectionReason: string;
  emailPuente: string;
  incorporatedAt: string;
  incorporatedBy: string;
  memberRowNumber: number | null;
  values: Record<string, MemberFieldValue>;
};

export type ConfigCategory =
  | "HORARIO"
  | "TITULO"
  | "ACTIVIDAD"
  | "TAREA"
  | "TEMA_SCORING"
  | "PANTALLA"
  | "PERMISO"
  | "VALOR_CUOTA"
  | "CUMPLEANOS_AUTOMATICO"
  | "CUMPLEANOS_COPIA"
  | "CUMPLEANOS_CALENDARIO"
  | "CUMPLEANOS_ASUNTO"
  | "CUMPLEANOS_MENSAJE";

export type UserScreen = "inicio" | "convivencia" | "integrantes" | "asistencia" | "cumpleanios" | "cuota" | "desempenos" | "reportes";

export type ConfigItem = {
  rowNumber: number;
  type: ConfigCategory;
  value: string;
  active: boolean;
  order: number;
};

export type BirthdayAutomationSettings = {
  enabled: boolean;
  ccEmail: string;
  calendarEmail: string;
  subjectTemplate: string;
  messageTemplate: string;
};

export type BirthdayAutomationMember = {
  id: string;
  email: string;
  name: string;
  birthDate: string;
};

export type PlatformAccount = {
  rowNumber: number;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
};

export type MemberManagementPayload = {
  headers: string[];
  rows: MemberRecord[];
  config: ConfigItem[];
  accounts: PlatformAccount[];
  canManage: boolean;
  canEdit: boolean;
  currentEmail: string;
};

export type Integrante = {
  id: string;
  matricula: string;
  nombre: string;
  email?: string;
  turno: string;
  anioIngreso: string;
  estado: "Activo" | "Pendiente";
  fechaNacimiento: string | null;
  foto?: string;
};

export type Asistencia = {
  id: string;
  nombre: string;
  fecha: string | null;
  asistio: boolean;
  turno: string;
  motivo: string;
};

export type Cumpleanios = {
  id: string;
  nombre: string;
  fechaNacimiento: string;
  proximoCumpleanios: string;
  diasRestantes: number;
  edadActual: number;
  edadCumple: number;
  mes: number;
  dia: number;
};

export type ScoringColumn = {
  id: string;
  area: string;
  mes: string;
  tarea: string;
  scoreColumn: number;
  observationColumn: number;
};

export type ScoringResult = {
  columnId: string;
  calificacion: number | null;
  observacion: string;
};

export type ScoringMember = {
  id: string;
  rowNumber: number;
  nombre: string;
  turno: string;
  resultados: ScoringResult[];
  final: string;
  finalColumn: number;
};

export type ScoringHistoryRecord = {
  id: string;
  rowNumber: number;
  year: number;
  month: number;
  email: string;
  name: string;
  topic: string;
  score: number | null;
  observation: string;
  updatedAt: string;
  updatedBy: string;
};

export type ScoringPerson = {
  id: string;
  email: string;
  name: string;
  turno: string;
  matricula: string;
};

export type ScoringSnapshot = {
  members: ScoringPerson[];
  records: ScoringHistoryRecord[];
  topics: string[];
  years: number[];
};

export type PerformanceComment = {
  id: string;
  fecha: string;
  emailIntegrante: string;
  integrante: string;
  comentario: string;
  creadoPor: string;
  rolAutor: UserRole;
  anio: number;
};

export type SocialFeeStatus = "" | "P" | "Debe" | "Beca" | "Baja" | "Exento";

export type SocialFeeRecord = {
  id: string;
  rowNumber: number;
  year: number;
  month: number;
  monthName: string;
  email: string;
  name: string;
  status: SocialFeeStatus;
  paidAt: string;
  updatedAt: string;
  updatedBy: string;
};

export type SocialFeeMember = {
  id: string;
  email: string;
  name: string;
};

export type AsistenciaSemanal = {
  dia: string;
  presentes: number;
  porcentaje: number;
};

export type PortalData = {
  source: DataSource;
  connectionError?: string;
  userScreens: UserScreen[];
  integrantes: Integrante[];
  asistencias: Asistencia[];
  cuotas: SocialFeeRecord[];
  cumpleanios: Cumpleanios[];
  asistenciaSemanal: AsistenciaSemanal[];
  habilidades: {
    categorias: string[];
    registros: number;
    columnas: ScoringColumn[];
    integrantes: ScoringMember[];
  };
  scoringHistory: ScoringHistoryRecord[];
  scoringTopics: string[];
  resumen: {
    integrantesActivos: number;
    asistenciaMes: number;
    cumpleaniosProximos: number;
    turnos: {
      manana: number;
      tarde: number;
      ambos: number;
    };
  };
};
