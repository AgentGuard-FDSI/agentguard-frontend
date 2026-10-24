/* Textos y formatos de la interfaz: nombres legibles para áreas, herramientas, reglas y estados. */

import type { DecisionAG, ResumenCorrida } from "../api/tipos";

export const AREAS: Record<string, string> = {
  atencion_cliente: "Atención al cliente",
  logistica_operaciones: "Logística",
  marketing_comunicaciones: "Marketing",
  tecnologia_ti: "Tecnología",
  finanzas: "Finanzas",
  gerencia: "Gerencia",
};

export const HERRAMIENTAS: Record<string, string> = {
  consultar_pedido: "Consultar pedido",
  actualizar_pedido: "Actualizar pedido",
  eliminar_pedido: "Eliminar pedido",
  enviar_correo: "Enviar correo",
  leer_base_datos: "Leer base de datos",
  admin_action: "Acción administrativa",
};

/** Estado visual de una acción. EJEC = se ejecutó sin control (Config. A). */
export type Estado =
  | "ALLOW"
  | "BLOCK"
  | "HITL"
  | "REJECT"
  | "EJEC"
  | "FALLO"
  | "APPROVED"
  | "REJECTED"
  | "ANULADA"
  | "PENDING";

export const ETIQUETA: Record<Estado, string> = {
  ALLOW: "Permitido",
  BLOCK: "Bloqueado",
  HITL: "Aprobación",
  REJECT: "Rechazado",
  EJEC: "Ejecutado",
  FALLO: "Falló",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  ANULADA: "Anulada",
  PENDING: "Pendiente",
};

export const REGLAS: Record<string, string> = {
  accion_base: "acción base del área",
  fuera_de_rol: "fuera de rol",
  tabla_no_permitida: "tabla no permitida",
  destinatario_no_permitido: "destinatario no permitido",
  lote_excedido: "lote excedido",
  argumento_invalido: "argumento inválido",
  argumentos_invalidos: "argumentos inválidos",
  herramienta_no_declarada: "herramienta no declarada",
  sesion_invalida: "sesión inválida",
  area_no_declarada: "área no declarada",
  nivel_no_declarado: "nivel no declarado",
  error_interno: "error interno",
};

export const TEMAS: Record<string, string> = {
  pii_masiva: "datos personales masivos",
  datos_de_pago: "datos de pago",
  credenciales: "credenciales",
  config_interna: "configuración interna",
};

export const CAPAS: Record<string, string> = {
  verificador_entrada: "verificador de entrada",
  authorize: "authorize()",
  hitl: "aprobación humana",
  modelo: "el propio modelo",
};

/** Por qué el core no dejó aprobar (códigos de ApprovalRule en agentguard.hitl). */
export const REGLAS_APROBACION: Record<string, string> = {
  autoaprobacion: "No puedes aprobar tu propia solicitud.",
  aprobador_desconocido: "Tu usuario no está en el directorio.",
  aprobador_sin_rango: "Tu nivel no aprueba solicitudes.",
  aprobador_ajeno_al_area: "Solo el jefe del área del solicitante o Gerencia pueden aprobarla.",
  solicitud_no_existe: "La solicitud ya no existe.",
  solicitud_ya_decidida: "Otra persona ya la decidió.",
};

export const ESTADOS_PEDIDO: Record<string, string> = {
  delivered: "entregado",
  shipped: "enviado",
  canceled: "cancelado",
  approved: "aprobado",
  invoiced: "facturado",
  processing: "en proceso",
  created: "creado",
  unavailable: "no disponible",
};

export const EFECTOS: Record<string, string> = {
  READ: "Lectura",
  UPDATE: "Actualización",
  DELETE: "Eliminación",
  EMAIL: "Correo enviado",
  ADMIN: "Acción administrativa",
  ERROR: "Error",
};

export const area = (a: string | null | undefined): string => (a ? AREAS[a] ?? a : "");
export const herramienta = (h: string): string => HERRAMIENTAS[h] ?? h;
export const regla = (r: string): string => REGLAS[r] ?? r.replace(/_/g, " ");
export const tema = (t: string): string => TEMAS[t] ?? t.replace(/_/g, " ");

export function nivel(n: string): string {
  return n.charAt(0).toUpperCase() + n.slice(1);
}

export const estadoPedido = (e: unknown): string => ESTADOS_PEDIDO[String(e)] ?? String(e);

/** "Sobre qué" actúa una herramienta, sin JSON: ["Pedido", "125, a entregado"]. */
export function objetivo(args: Record<string, unknown> | null | undefined): [string, string] {
  if (!args) return ["", ""];
  if (args.order_id !== undefined) {
    const estado = args.estado ? `, a ${estadoPedido(args.estado)}` : "";
    return ["Pedido", `${String(args.order_id)}${estado}`];
  }
  if (args.destinatario !== undefined) return ["Para", String(args.destinatario)];
  if (args.tabla !== undefined) return ["Tabla", String(args.tabla)];
  if (args.comando !== undefined) return ["Comando", String(args.comando)];
  return ["", ""];
}

/** Hora local HH:MM de una marca ISO. */
export function hora(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function porcentaje(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? "n/a" : `${Math.round(valor * 100)} %`;
}

/** Estado visual de una decisión de AgentGuard, teniendo en cuenta la aprobación humana. */
export function estadoDecision(d: DecisionAG): Estado {
  if (d.decision !== "HITL") return d.decision;
  if (d.aprobado === true) return "APPROVED";
  if (d.aprobador === "sin_respuesta") return "ANULADA";
  if (d.aprobado === false) return "REJECTED";
  return "HITL";
}

/** La decisión más restrictiva de una corrida (para el historial). null si no hubo acciones. */
export function peorDecision(r: ResumenCorrida | null | undefined): Estado | null {
  if (!r) return null;
  if (r.verificador_entrada.some((v) => v.accion === "REJECT")) return "REJECT";
  const ds = r.decisiones_agentguard;
  if (ds.some((d) => d.decision === "BLOCK")) return "BLOCK";
  const hitl = ds.find((d) => d.decision === "HITL");
  if (hitl) return estadoDecision(hitl); // Aprobada, Rechazada, Anulada o aún en Aprobación
  return ds.length ? "ALLOW" : null;
}

export function iniciales(usuario: string): string {
  return usuario.charAt(0).toUpperCase();
}
