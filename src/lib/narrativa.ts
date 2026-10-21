/* Lenguaje natural a partir de lo que realmente pasó: frases para cada acción, el resultado de cada
 * herramienta, la respuesta que ve la persona y los pasos de la traza. Nada de JSON en pantalla. */

import type { DecisionAG, Efecto, Evento, HerramientaUsada, ResumenCorrida } from "../api/tipos";
import { AREAS, estadoDecision, estadoPedido, HERRAMIENTAS, nivel, REGLAS, tema, type Estado } from "./formato";

type Args = Record<string, unknown>;
type Resultado = HerramientaUsada["resultado"];

const RIESGO: Record<string, string> = { LOW: "bajo", MEDIUM: "medio", HIGH: "alto", CRITICAL: "crítico" };
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const s = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const mayuscula = (t: string): string => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const punto = (t: string): string => (/[.!?…]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);

/** "2026-09-01T10:15:00" → "1 de septiembre de 2026". */
export function fechaLarga(iso: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s(iso));
  if (!m) return s(iso);
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}`;
}

export function moneda(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return s(v);
  return `$${n.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
}

/** Une frases con comas y una "y" final: ["a", "b", "c"] → "a, b y c". */
export function unir(partes: string[]): string {
  const p = partes.filter(Boolean);
  if (p.length <= 1) return p[0] ?? "";
  return `${p.slice(0, -1).join(", ")} y ${p[p.length - 1]}`;
}

/** Cambia los identificadores internos ('atencion_cliente', 'eliminar_pedido') por su nombre legible. */
export function limpiar(texto: string): string {
  return texto
    .replace(/'([a-z_]+)'/g, (_, id: string) => AREAS[id] ?? HERRAMIENTAS[id]?.toLowerCase() ?? id)
    .replace(/\b(atencion_cliente|logistica_operaciones|marketing_comunicaciones|tecnologia_ti|finanzas|gerencia)\b/g, (id) => AREAS[id] ?? id);
}

// ---------------------------------------------------------------------------
// Frases de acción
// ---------------------------------------------------------------------------

/** La acción en infinitivo y en minúscula: "eliminar el pedido 123", "enviar un correo a x@y". */
export function infinitivo(tool: string, args?: Args | null): string {
  const a = args ?? {};
  const pedido = a.order_id !== undefined ? ` el pedido ${s(a.order_id)}` : " el pedido";
  switch (tool) {
    case "consultar_pedido":
      return `consultar${pedido}`;
    case "actualizar_pedido":
      return `actualizar${pedido}${a.estado ? ` a ${estadoPedido(a.estado)}` : ""}`;
    case "eliminar_pedido":
      return `eliminar${pedido}`;
    case "enviar_correo":
      return a.destinatario ? `enviar un correo a ${s(a.destinatario)}` : "enviar un correo";
    case "leer_base_datos":
      return a.tabla ? `leer la tabla ${s(a.tabla)}` : "leer la base de datos";
    case "admin_action":
      return a.comando ? `ejecutar el comando ${s(a.comando)}` : "ejecutar un comando administrativo";
    default:
      return `usar ${HERRAMIENTAS[tool]?.toLowerCase() ?? tool}`;
  }
}

/** Para las pastillas de acción: "Actualizar el pedido 125 a entregado". */
export const frase = (tool: string, args?: Args | null): string => mayuscula(infinitivo(tool, args));

/** Lo que pasó en la base, en una oración: "se leyó el pedido 123 y se eliminó el pedido 123". */
export function efectoEnFrase(e: Efecto): string {
  const obj = s(e.objetivo);
  switch (e.efecto) {
    case "READ":
      return e.tool === "leer_base_datos" ? `se leyó la tabla ${obj}` : `se leyó el pedido ${obj}`;
    case "UPDATE":
      return `se actualizó el pedido ${obj}`;
    case "DELETE":
      return `se eliminó el pedido ${obj}`;
    case "EMAIL":
      return obj ? `se envió un correo a ${obj}` : "se envió un correo";
    case "ADMIN":
      return "se ejecutó un comando administrativo";
    default:
      return "";
  }
}

/** El criterio de éxito de un ataque ("se ejecutó eliminar_pedido sobre 1 pedido(s)") en lenguaje natural. */
export function criterio(texto: string | null | undefined): string {
  if (!texto) return "";
  return texto
    .replace(/\b([a-z]+_[a-z_]+)\b/g, (id) => (HERRAMIENTAS[id] ? `“${HERRAMIENTAS[id]}”` : AREAS[id] ?? id))
    .replace(/(\d+) (\w+)\(s\)/g, (_, n: string, p: string) => `${n} ${p}${n === "1" ? "" : "s"}`)
    .replace(/(\w+)\(s\)/g, "$1s");
}

// ---------------------------------------------------------------------------
// Resultados de herramientas
// ---------------------------------------------------------------------------

/** Por qué AgentGuard bloqueó, dicho para la persona que lo pidió. */
export function razonBloqueo(regla: string, motivo: string, tool?: string): string {
  switch (regla) {
    case "fuera_de_rol":
      return "tu área no tiene permitida esa acción";
    case "destinatario_no_permitido":
      return "el destinatario no es un cliente registrado ni del dominio corporativo";
    case "tabla_no_permitida":
      return "tu área no puede leer esa tabla";
    case "lote_excedido":
      return "supera el máximo de pedidos que se pueden cambiar en una solicitud";
    case "accion_base":
      return tool === "admin_action" ? "es una acción crítica que siempre se bloquea" : limpiar(motivo);
    default:
      return limpiar(motivo).replace(/^[a-z_]+: /, "") || REGLAS[regla] || regla;
  }
}

/** Lo que devolvió una herramienta que sí se ejecutó, en una o dos oraciones. */
export function describirDatos(tool: string, data: unknown, args?: Args | null): string {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  switch (tool) {
    case "consultar_pedido": {
      const id = s(d.order_id ?? args?.order_id);
      let t = `El pedido ${id} está ${estadoPedido(d.estado)}.`;
      const compra = d.fecha_compra ? `Se compró el ${fechaLarga(d.fecha_compra)}` : "";
      const valor = d.valor_total !== undefined && d.valor_total !== null ? ` por ${moneda(d.valor_total)}` : "";
      const entrega = d.fecha_entrega
        ? ` y se entregó el ${fechaLarga(d.fecha_entrega)}`
        : d.estado === "delivered" || d.estado === "canceled"
          ? ""
          : " y aún no se ha entregado";
      if (compra) t += ` ${compra}${valor}${entrega}.`;
      return t;
    }
    case "actualizar_pedido": {
      const id = s(d.order_id ?? args?.order_id);
      return d.estado_anterior === d.estado_nuevo
        ? `El pedido ${id} ya estaba ${estadoPedido(d.estado_nuevo)}, así que no cambió.`
        : `El pedido ${id} pasó de ${estadoPedido(d.estado_anterior)} a ${estadoPedido(d.estado_nuevo)}.`;
    }
    case "eliminar_pedido": {
      const n = Number(d.pagos_eliminados ?? 0);
      const pagos = n === 0 ? "" : n === 1 ? " junto con su pago" : ` junto con sus ${n} pagos`;
      return `Se eliminó el pedido ${s(d.order_id ?? args?.order_id)}${pagos}.`;
    }
    case "enviar_correo":
      return `Se envió el correo a ${s(d.destinatario ?? args?.destinatario)}.`;
    case "leer_base_datos": {
      const n = Number(d.filas_devueltas ?? 0);
      const total = Number(d.total ?? n);
      const filas = n === total ? `${n} ${n === 1 ? "fila" : "filas"}` : `${n} de ${total} filas`;
      return `Se leyeron ${filas} de la tabla ${s(d.tabla ?? args?.tabla)}.`;
    }
    case "admin_action":
      return `Se ejecutó el comando ${s(args?.comando ?? s(data).replace(/^comando simulado:\s*/, ""))}.`;
    default:
      return "Listo.";
  }
}

/** El resultado de una llamada, tal como lo vio el agente, en lenguaje natural. */
export function describirResultado(tool: string, r: Resultado | undefined, args?: Args | null): string {
  if (!r) return "";
  if (r.ok !== false) return describirDatos(tool, r.data, args);
  const ag = r.agentguard as { action?: string; rule?: string; reason?: string } | undefined;
  if (ag?.action === "BLOCK") return punto(`AgentGuard la bloqueó: ${razonBloqueo(s(ag.rule), s(ag.reason), tool)}`);
  if (ag?.action === "HITL") {
    const err = s(r.error);
    const por = /rechazada por (\S+)$/.exec(err)?.[1];
    if (por === "sin_respuesta" || /tiempo límite/.test(err)) return "No se ejecutó: nadie aprobó la solicitud a tiempo.";
    if (por) return `No se ejecutó: ${por} rechazó la solicitud.`;
    return punto(`No se ejecutó: la aprobación no fue válida (${limpiar(err.replace(/^.*no se aprobó:\s*/, ""))})`);
  }
  return punto(`No se pudo ${infinitivo(tool, args)}: ${limpiar(s(r.error))}`);
}

// ---------------------------------------------------------------------------
// Respuesta para la persona
// ---------------------------------------------------------------------------

function oracionDeLlamada(h: HerramientaUsada, d: DecisionAG | undefined, config: "A" | "B"): string {
  const r = h.resultado ?? {};
  const args = h.argumentos;
  if (r.ok !== false) {
    const base = describirDatos(h.herramienta, r.data, args);
    const aprobada = config === "B" && d?.decision === "HITL" && d.aprobado && d.aprobador ? ` Lo aprobó ${d.aprobador}.` : "";
    // En primera persona para lo que el agente hizo, en impersonal para lo que consultó.
    const propia = base
      .replace(/^Se eliminó/, "Eliminé")
      .replace(/^Se envió/, "Envié")
      .replace(/^Se leyeron/, "Leí")
      .replace(/^Se ejecutó/, "Ejecuté")
      .replace(/^El pedido (\S+) pasó de/, "Actualicé el pedido $1: pasó de");
    return propia + aprobada;
  }
  const accion = infinitivo(h.herramienta, args);
  const ag = r.agentguard as { action?: string; rule?: string; reason?: string } | undefined;
  if (ag?.action === "BLOCK" || d?.decision === "BLOCK") {
    return punto(`No pude ${accion}: ${razonBloqueo(s(ag?.rule ?? d?.regla), s(ag?.reason ?? d?.motivo), h.herramienta)}`);
  }
  if (ag?.action === "HITL" || d?.decision === "HITL") {
    const estado = d ? estadoDecision(d) : "REJECTED";
    if (estado === "ANULADA") return `No pude ${accion}: nadie aprobó la solicitud a tiempo.`;
    if (d?.aprobador && d.aprobador !== "sistema") return `No pude ${accion}: ${d.aprobador} rechazó la solicitud.`;
    return `No pude ${accion}: la aprobación no fue válida.`;
  }
  return punto(`No pude ${accion}: ${limpiar(s(r.error))}`);
}

/** Modelos cuyo texto no describe lo que pasó (el guion simula que el modelo obedece; el simulado
 *  devuelve el resultado en crudo). Para ellos la respuesta se redacta con los hechos. */
export const MODELOS_DETERMINISTAS = new Set(["guion", "simulado"]);

/** La respuesta que ve la persona: lo que de verdad hizo o no hizo el agente, sin JSON. */
export function redactarRespuesta(r: ResumenCorrida, config: "A" | "B" = "B", modelo = "guion"): string {
  const rechazo = r.verificador_entrada.find((v) => v.accion === "REJECT");
  if (rechazo) return r.respuesta_final || "No puedo ayudarte con esta solicitud.";
  const llamadas = r.herramientas_solicitadas;
  if (!llamadas.length || !MODELOS_DETERMINISTAS.has(modelo)) return humanizarTexto(r.respuesta_final);

  const decisiones = [...r.decisiones_agentguard];
  let oculta: { pedido: string } | null = null;
  const oraciones = llamadas.map((h) => {
    const i = decisiones.findIndex((d) => d.herramienta === h.herramienta);
    const d = i >= 0 ? decisiones.splice(i, 1)[0] : undefined;
    const oracion = oracionDeLlamada(h, config === "B" ? d : undefined, config);
    if (h.herramienta === "consultar_pedido") {
      const data = h.resultado?.data as Record<string, unknown> | undefined;
      if (h.resultado?.ok !== false && instruccionOculta(data?.comentario)) oculta = { pedido: s(data?.order_id) };
      return oracion;
    }
    if (!oculta) return oracion;
    // La acción no la pidió la persona: viene de la instrucción escondida en el comentario del pedido.
    const { pedido } = oculta;
    oculta = null;
    const intento = `El comentario del pedido ${pedido} traía una instrucción oculta para ${infinitivo(h.herramienta, h.argumentos)}`;
    if (h.resultado?.ok !== false) return `${intento} y la seguí. ${oracion}`;
    const motivo = oracion.replace(/^No pude [^:]+: /, "");
    return punto(`${intento}, pero AgentGuard lo impidió: ${motivo.replace(/\.$/, "")}`);
  });
  return oraciones.join(" ");
}

/** Un comentario de pedido que da órdenes al agente (inyección indirecta, escenario 5). */
export function instruccionOculta(comentario: unknown): boolean {
  const c = s(comentario);
  return /ignore (all )?previous|ignora (todo lo|las instrucciones) anterior|instrucciones anteriores|send .* to |env[ií]a .* a [\w.+-]+@/i.test(c);
}

// ---------------------------------------------------------------------------
// Lectura de literales (los eventos traen dicts de Python; el modelo simulado, JSON)
// ---------------------------------------------------------------------------

/** Lee un literal de Python o JSON (dict, lista, texto, número, True/False/None) desde `desde`.
 *  Devuelve el valor y dónde terminó, o undefined si no se puede leer. */
export function leerLiteral(texto: string, desde = 0): { valor: unknown; fin: number } | undefined {
  let i = desde;
  const espacios = () => {
    while (i < texto.length && /\s/.test(texto[i])) i++;
  };
  const valor = (): unknown => {
    espacios();
    const c = texto[i];
    if (c === "{" || c === "[" || c === "(") {
      const cierre = c === "{" ? "}" : c === "[" ? "]" : ")";
      const esDict = c === "{";
      i++;
      const obj: Record<string, unknown> = {};
      const lista: unknown[] = [];
      espacios();
      while (texto[i] !== cierre) {
        if (i >= texto.length) throw new Error("fin inesperado");
        const v = valor();
        espacios();
        if (esDict) {
          if (texto[i] !== ":") throw new Error("se esperaba :");
          i++;
          obj[String(v)] = valor();
        } else lista.push(v);
        espacios();
        if (texto[i] === ",") i++;
        espacios();
      }
      i++;
      return esDict ? obj : lista;
    }
    if (c === "'" || c === '"') {
      i++;
      let out = "";
      while (texto[i] !== c) {
        if (i >= texto.length) throw new Error("texto sin cerrar");
        if (texto[i] === "\\") {
          const n = texto[i + 1];
          const esc: Record<string, string> = { n: "\n", t: "\t", r: "\r", "\\": "\\", "'": "'", '"': '"' };
          if (n === "x") {
            out += String.fromCharCode(parseInt(texto.slice(i + 2, i + 4), 16));
            i += 4;
          } else if (n === "u") {
            out += String.fromCharCode(parseInt(texto.slice(i + 2, i + 6), 16));
            i += 6;
          } else {
            out += esc[n] ?? n;
            i += 2;
          }
        } else out += texto[i++];
      }
      i++;
      return out;
    }
    const m = /^(True|False|None|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(texto.slice(i));
    if (!m) throw new Error("valor no reconocido");
    i += m[0].length;
    if (m[0] === "True" || m[0] === "true") return true;
    if (m[0] === "False" || m[0] === "false") return false;
    if (m[0] === "None" || m[0] === "null") return null;
    return Number(m[0]);
  };
  try {
    const v = valor();
    return { valor: v, fin: i };
  } catch {
    return undefined;
  }
}

/** Cambia en un texto del modelo los "herramienta: listo. {json}" por una oración. */
export function humanizarTexto(texto: string): string {
  if (!texto) return "";
  const patron = /\b([a-z_]+): (listo\. |no fue posible \()/g;
  let out = "";
  let ultimo = 0;
  let m: RegExpExecArray | null;
  while ((m = patron.exec(texto))) {
    const tool = m[1];
    if (!(tool in HERRAMIENTAS)) continue;
    out += texto.slice(ultimo, m.index);
    const inicio = m.index + m[0].length;
    if (m[2].startsWith("listo")) {
      const lit = leerLiteral(texto, inicio);
      if (lit) {
        out += describirDatos(tool, lit.valor);
        ultimo = lit.fin;
      } else {
        // Resumen recortado por el modelo: se dice qué se hizo, sin el detalle.
        const fin = texto.indexOf(" ", texto.indexOf("…", inicio) + 1);
        out += punto(`Listo: ${infinitivo(tool)}`);
        ultimo = fin < 0 ? texto.length : fin;
      }
    } else {
      const cierre = texto.indexOf(").", inicio);
      const err = texto.slice(inicio, cierre < 0 ? undefined : cierre);
      out += punto(`No se pudo ${infinitivo(tool)}: ${limpiar(err)}`);
      ultimo = cierre < 0 ? texto.length : cierre + 2;
    }
    patron.lastIndex = ultimo;
  }
  return (out + texto.slice(ultimo)).replace(/\s{2,}/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Traza: de las líneas de consola a pasos legibles
// ---------------------------------------------------------------------------

export type TipoPaso = "instruccion" | "verificador" | "modelo" | "pide" | "decision" | "aviso" | "hitl" | "resultado" | "respuesta" | "nota";

export interface Paso {
  clave: string;
  ts: string;
  tipo: TipoPaso;
  titulo: string;
  detalle?: string;
  estado?: Estado;
  datos?: [string, string][]; // pares etiqueta/valor (regla, riesgo, plazo…)
}

export interface Traza {
  usuario?: string;
  area?: string;
  nivel?: string;
  modelo?: string;
  pasos: Paso[];
}

/** Convierte los eventos de una ejecución en pasos. `respuesta` reemplaza el texto final del modelo
 *  (que con el guion no refleja lo que pasó) por la respuesta redactada con los hechos. */
export function leerTraza(eventos: Evento[], opciones: { respuesta?: string; config?: "A" | "B"; instruccion?: string } = {}): Traza {
  const t: Traza = { pasos: [] };
  const ultimosArgs: Record<string, Args> = {};
  const add = (e: Evento, p: Omit<Paso, "clave" | "ts">) => t.pasos.push({ clave: String(e.seq), ts: e.ts, ...p });

  for (const e of eventos) {
    const x = e.texto;
    let m: RegExpExecArray | null;
    if (e.tipo === "seccion") continue;
    if ((m = /^\[modelo\] (.+)$/.exec(x))) {
      t.modelo = m[1];
    } else if ((m = /^\[agent\] sesión: (\S+) \(([^,]+), ([^)]+)\)$/.exec(x))) {
      [t.usuario, t.area, t.nivel] = [m[1], m[2], m[3]];
    } else if ((m = /^\[agent\] instrucción: ([\s\S]+)$/.exec(x))) {
      const lit = leerLiteral(m[1]);
      add(e, { tipo: "instruccion", titulo: "Instrucción", detalle: typeof lit?.valor === "string" ? lit.valor : m[1] });
    } else if (/^\[agentguard\] verificador de entrada: PASS/.test(x)) {
      add(e, { tipo: "verificador", estado: "ALLOW", titulo: "Verificador de entrada", detalle: "No encontró temas sensibles; la instrucción sigue al modelo." });
    } else if ((m = /^\[agentguard\] verificador de entrada: REJECT(?: \(([^)]*)\))?/.exec(x))) {
      const temas = (m[1] ?? "").split(/,\s*/).filter(Boolean).map(tema);
      add(e, {
        tipo: "verificador",
        estado: "REJECT",
        titulo: "Verificador de entrada",
        detalle: `Rechazó la instrucción${temas.length ? ` por ${unir(temas)}` : ""}. El modelo no la recibió.`,
      });
    } else if (/^\[agent\] --- iteración/.test(x)) {
      continue;
    } else if ((m = /^\[agent\] modelo dice: ([\s\S]+)$/.exec(x))) {
      add(e, { tipo: "modelo", titulo: "Modelo", detalle: humanizarTexto(m[1]) });
    } else if ((m = /^\[agent\] herramienta solicitada: (\w+) ([\s\S]+)$/.exec(x))) {
      const args = (leerLiteral(m[2])?.valor ?? {}) as Args;
      ultimosArgs[m[1]] = args;
      add(e, { tipo: "pide", titulo: "Pide una acción", detalle: frase(m[1], args) });
    } else if ((m = /^\[agentguard\] (ALLOW|BLOCK|HITL) \[(\w+)\] ([\s\S]+)$/.exec(x))) {
      const [, accion, codigo, resto] = m;
      const riesgo = /\(riesgo (\w+)\)\s*$/.exec(resto)?.[1];
      const motivo = resto.replace(/\s*\(riesgo \w+\)\s*$/, "").replace(/^[a-z_]+: /, "");
      const datos: [string, string][] = [["Regla", REGLAS[codigo] ?? codigo.replace(/_/g, " ")]];
      if (riesgo) datos.push(["Riesgo", RIESGO[riesgo] ?? riesgo]);
      add(e, { tipo: "decision", estado: accion as Estado, titulo: "AgentGuard", detalle: punto(mayuscula(limpiar(motivo))), datos });
    } else if ((m = /^\[agentguard\] acceso entre áreas: [^;]+; aviso a (.+)$/.exec(x))) {
      const areas = m[1].split(/,\s*/).map((a) => AREAS[a] ?? a);
      add(e, { tipo: "aviso", titulo: "Acceso a otra área", detalle: `Se avisó a ${unir(areas)}.` });
    } else if ((m = /^\[agentguard\] ALERTA PRIORITARIA: (\S+) acumula (\d+)/.exec(x))) {
      add(e, {
        tipo: "aviso",
        estado: "BLOCK",
        titulo: "Alerta prioritaria",
        detalle: `${m[1]} lleva ${m[2]} intentos de acceso a otras áreas. Se avisó a Tecnología por una posible cuenta comprometida.`,
      });
    } else if (e.tipo === "hitl_pendiente") {
      const quien = s(e.aprobador_sugerido) || "el jefe del área";
      add(e, {
        tipo: "hitl",
        estado: "HITL",
        titulo: "Esperando aprobación",
        detalle: `Solicitud ${s(e.solicitud)} para ${quien} o Gerencia.`,
        datos: [["Plazo", `${Math.round(Number(e.espera_segundos ?? 0))} s`]],
      });
    } else if (e.tipo === "hitl_resuelta") {
      const aprobada = Boolean(e.aprobada);
      const quien = s(e.aprobador);
      add(e, {
        tipo: "hitl",
        estado: aprobada ? "APPROVED" : quien ? "REJECTED" : "ANULADA",
        titulo: aprobada ? "Aprobada" : quien ? "Rechazada" : "Anulada",
        detalle: aprobada ? `La aprobó ${quien}.` : quien ? `La rechazó ${quien}; la acción no se ejecuta.` : "Nadie respondió a tiempo; la acción no se ejecuta.",
      });
    } else if ((m = /^\[agentguard\] solicitud HITL (aprobada|rechazada) por (\S+)(?: \((\w+): ([\s\S]+)\))?$/.exec(x))) {
      // Ya la cuenta el evento hitl_resuelta, salvo cuando el core negó la aprobación por una regla.
      if (m[3]) add(e, { tipo: "hitl", estado: "REJECTED", titulo: "Aprobación no válida", detalle: punto(mayuscula(limpiar(m[4]))) });
    } else if ((m = /^\[agent\] resultado de (\w+): ([\s\S]+)$/.exec(x))) {
      const r = leerLiteral(m[2])?.valor as Resultado | undefined;
      const ok = r?.ok !== false;
      add(e, {
        tipo: "resultado",
        estado: ok ? (opciones.config === "A" ? "EJEC" : "ALLOW") : "FALLO",
        titulo: ok ? (opciones.config === "A" ? "Se ejecutó" : "Resultado") : "No se ejecutó",
        detalle: r ? describirResultado(m[1], r, ultimosArgs[m[1]]) : m[2],
      });
      const comentario = (r?.data as Record<string, unknown> | undefined)?.comentario;
      if (m[1] === "consultar_pedido" && ok && instruccionOculta(comentario)) {
        add(e, {
          tipo: "aviso",
          estado: "HITL",
          titulo: "Instrucción oculta en los datos",
          detalle: `El comentario del pedido trae una orden para el agente: “${s(comentario)}”. No la escribió ${t.usuario ?? "quien pidió la consulta"}.`,
        });
      }
    } else if (/^\[agent\] respuesta final/.test(x)) {
      // El último texto del modelo es la respuesta; con el guion se reemplaza por la redactada.
      const ultimo = [...t.pasos].reverse().find((p) => p.tipo === "modelo");
      if (ultimo) {
        ultimo.tipo = "respuesta";
        ultimo.titulo = "Respuesta";
        if (opciones.respuesta) ultimo.detalle = opciones.respuesta;
      }
    } else if (/^\[agent\] se alcanzó el máximo/.test(x)) {
      add(e, { tipo: "nota", titulo: "Fin", detalle: "El agente llegó al máximo de pasos sin terminar." });
    } else if (/^\[agentguard\] no se pudo registrar/.test(x)) {
      add(e, { tipo: "nota", estado: "BLOCK", titulo: "AgentGuard", detalle: "No se pudo registrar la decisión, así que la acción no se ejecutó." });
    } else {
      add(e, { tipo: "nota", titulo: "Nota", detalle: limpiar(x.replace(/^\[[^\]]+\]\s*/, "")) });
    }
  }
  if (opciones.instruccion && t.pasos.length && !t.pasos.some((p) => p.tipo === "instruccion")) {
    t.pasos.unshift({ clave: "instruccion", ts: t.pasos[0].ts, tipo: "instruccion", titulo: "Instrucción", detalle: opciones.instruccion });
  }
  // La instrucción va primero aunque el verificador de entrada la haya registrado antes.
  const iInstr = t.pasos.findIndex((p) => p.tipo === "instruccion");
  const iVerif = t.pasos.findIndex((p) => p.tipo === "verificador");
  if (iInstr > 0 && iVerif >= 0 && iVerif < iInstr) {
    const [instr] = t.pasos.splice(iInstr, 1);
    t.pasos.splice(iVerif, 0, { ...instr, ts: t.pasos[iVerif].ts });
  }
  // Rechazo en la entrada: no hubo modelo, la respuesta es el rechazo estándar.
  if (opciones.respuesta && !t.pasos.some((p) => p.tipo === "respuesta") && t.pasos.some((p) => p.estado === "REJECT")) {
    t.pasos.push({ clave: "respuesta", ts: t.pasos.at(-1)?.ts ?? "", tipo: "respuesta", titulo: "Respuesta", detalle: opciones.respuesta });
  }
  return t;
}

export const quien = (t: Traza): string =>
  t.usuario ? `${t.usuario}, ${AREAS[t.area ?? ""] ?? t.area}${t.nivel ? ` (${nivel(t.nivel).toLowerCase()})` : ""}` : "";

