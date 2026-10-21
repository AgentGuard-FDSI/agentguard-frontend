/* Formas de las respuestas de la API (andimarket/api en agentguard-andimarket). */

export type Accion = "ALLOW" | "BLOCK" | "HITL";

export interface Perfil {
  usuario: string;
  area: string;
  nivel: string;
  aprueba_hitl: boolean;
  herramientas: string[];
  administra_demo: boolean;
}

export interface Salud {
  ok: boolean;
  politica: string;
  verificador_entrada: boolean;
  modelo_chat: string;
  ejecucion_en_curso: boolean;
}

export interface SesionDemo {
  usuario: string;
  area: string;
  nivel: string;
}

export interface PromptDemo {
  id: string;
  nombre: string;
  texto: string;
  es_ataque: boolean;
  escenario: number | null;
  sesion: SesionDemo;
}

export interface Evento {
  seq: number;
  ts: string;
  tipo: "agente" | "agentguard" | "modelo" | "hitl_pendiente" | "hitl_resuelta" | "seccion" | "info";
  texto: string;
  config?: "A" | "B";
  [extra: string]: unknown;
}

export interface SolicitudPendiente {
  solicitud: number;
  herramienta: string;
  argumentos: Record<string, unknown>;
  motivo: string;
  aprobador_sugerido: string | null;
  espera_segundos: number;
}

export interface VeredictoEntrada {
  accion: "PASS" | "REJECT";
  temas: string[];
  reglas: string[];
  motivo: string;
  notificado: boolean;
}

export interface DecisionAG {
  herramienta: string;
  argumentos: Record<string, unknown>;
  decision: Accion;
  regla: string;
  motivo: string;
  aprobado: boolean | null;
  aprobador: string | null;
  autorizada: boolean;
}

export interface HerramientaUsada {
  herramienta: string;
  argumentos: Record<string, unknown>;
  resultado: { ok?: boolean; error?: string; data?: unknown; [k: string]: unknown };
}

export interface Efecto {
  tool: string;
  efecto: "READ" | "UPDATE" | "DELETE" | "EMAIL" | "ADMIN" | "ERROR";
  objetivo: string | null;
  filas_afectadas: number;
}

export interface Aviso {
  kind: string;
  prioridad: string;
  area_destino: string;
  usuario: string | null;
  motivo: string;
  ts: string;
  detalle: Record<string, unknown>;
}

/** Lo común a una corrida de la Config. A o B (resumen_corrida en config_b.py). */
export interface ResumenCorrida {
  verificador_entrada: VeredictoEntrada[];
  decisiones_agentguard: DecisionAG[];
  avisos: Aviso[];
  herramientas_solicitadas: HerramientaUsada[];
  respuesta_final: string;
  efectos: Efecto[];
}

export interface ResultadoChat extends ResumenCorrida {
  configuracion: "B";
  modelo: string;
  ataque: { escenario: number | null; exitoso: boolean; motivo: string; capa: string | null } | null;
}

export interface LadoComparacion extends ResumenCorrida {
  run_id: string;
  ataque_exitoso: boolean | null;
  motivo: string | null;
  capa: string | null;
}

export interface ResultadoComparacion {
  prompt: PromptDemo;
  A: LadoComparacion;
  B: LadoComparacion;
}

export interface MetricasConfig {
  intentos_de_ataque: number;
  ataques_exitosos: number;
  tasa_no_autorizadas: number | null;
  tasa_contencion: number | null;
  solicitudes_legitimas: number;
  falsos_positivos: number | null;
  friccion: number | null;
  decisiones: Record<Accion, number> | null;
  rechazos_entrada: number | null;
  contencion_por_capa: Record<string, number>;
}

export interface PorPrompt {
  nombre: string;
  es_ataque: boolean;
  A: { corridas: number; exitosos: number | null; decisiones: string[] | null };
  B: { corridas: number; exitosos: number | null; decisiones: string[] | null };
}

export interface Metricas {
  errores: number;
  por_prompt?: Record<string, PorPrompt>;
  A: MetricasConfig;
  B: MetricasConfig;
  latencia_authorize_ms: { llamadas: number; mediana: number | null; p95: number | null };
}

export interface ResultadoExperimento {
  modelo: string;
  repeticiones: number;
  metricas: Metricas;
  reporte_md: string;
}

export interface ExperimentoGuardado {
  archivo: string;
  modelo: string | null;
  fecha: string | null;
  temperatura: string | null;
  repeticiones: number | null;
  aprobador: string | null;
  metricas: Metricas | null;
}

export type EstadoEjecucion = "en_curso" | "esperando_aprobacion" | "terminada" | "error";

export interface Ejecucion<R = ResultadoChat> {
  id: string;
  tipo: "chat" | "comparacion" | "experimento";
  run_id: string | null;
  estado: EstadoEjecucion;
  entrada: string;
  creada: string;
  terminada: string | null;
  solicitud_pendiente: SolicitudPendiente | null;
  eventos: Evento[];
  ultimo_evento: number;
  resultado: R | null;
  error: string | null;
}

export interface ResumenEjecucion {
  id: string;
  tipo: string;
  run_id: string | null;
  estado: EstadoEjecucion;
  entrada: string;
  creada: string;
  respuesta: string | null;
}

export interface Solicitud {
  id: number;
  ts: string;
  run_id: string | null;
  solicitante: SesionDemo;
  herramienta: string;
  argumentos: Record<string, unknown>;
  motivo: string;
  estado: "PENDING" | "APPROVED" | "REJECTED" | "ANULADA";
  aprobador: string | null;
  ts_decision: string | null;
  comentario: string | null;
}

/** Una entrada del log encadenado (AuditChain); `registro` depende de `registro.tipo`. */
export interface EntradaCadena {
  seq: number;
  ts: string;
  hash: string;
  prev_hash: string;
  registro: Registro;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Registro = { tipo: string; [k: string]: any };

export interface Aprobaciones {
  puedo_aprobar: boolean;
  pendientes: Solicitud[];
  mias: Solicitud[];
  recientes: EntradaCadena[];
}

export interface Verificacion {
  integra: boolean;
  entradas_verificadas: number;
  cabeza: { seq: number; hash: string } | null;
  roto_en: number | null;
  motivo: string;
}

export interface ResumenSeguridad {
  decisiones: Record<Accion, number>;
  rechazos_entrada: number;
  avisos: number;
  alertas_prioritarias: number;
  pendientes_para_mi: number;
  integridad: Verificacion;
}

export interface PoliticaHerramienta {
  areas: string[];
  risk: string;
  action: Accion;
  args?: Record<string, unknown>;
}

export interface Politicas {
  archivo: string;
  version: number;
  organizacion: { dominio_corporativo?: string; aprobador_ultima_instancia?: string };
  verificador_entrada: {
    habilitado?: boolean;
    temas?: string[];
    notificar_area?: string;
    mensaje_rechazo?: string;
    area_propietaria?: Record<string, string>;
  };
  regla_entre_areas: {
    habilitada?: boolean;
    alerta_tras?: { intentos: number; ventana_minutos: number };
    notificar_alerta?: string;
  };
  areas: Record<string, { description: string; levels: string[] }>;
  herramientas: Record<string, PoliticaHerramienta>;
  mi_area: { area: string; nivel: string; herramientas: string[]; aprueba_hitl: boolean };
}
