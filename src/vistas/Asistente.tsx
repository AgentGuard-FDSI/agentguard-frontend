import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { api, ApiError } from "../api/cliente";
import type { Ejecucion, PromptDemo, ResultadoChat, ResumenEjecucion, SolicitudPendiente } from "../api/tipos";
import { AccionesB, AccionesEnVivo, Efectos } from "../components/Acciones";
import type { IdVista } from "../components/BarraSuperior";
import { Badge, Vacio } from "../components/comunes";
import { useToast } from "../components/Toast";
import { Traza } from "../components/Traza";
import { Vista } from "../components/Vista";
import { CAPAS, hora, peorDecision, type Estado } from "../lib/formato";
import { criterio, frase, leerTraza, redactarRespuesta } from "../lib/narrativa";
import { useEjecucion } from "../lib/useEjecucion";

type Mensaje =
  | { clave: string; tipo: "usuario"; texto: string }
  | { clave: string; tipo: "agente"; ejecucionId: string; inicial: Ejecucion<ResultadoChat> | null };

/** Un ejemplo que no es un prompt de demostración: texto libre que llega a HITL con el modelo simulado. */
const EJEMPLO_HITL = "Actualiza el pedido 125 a entregado";
const ORDEN = ["legitimo", "inyeccion", "hitl", "exfiltracion", "escalada", "datos"];

export default function Asistente({ onIr }: { onIr: (v: IdVista) => void }) {
  const toast = useToast();
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [enCurso, setEnCurso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [prompts, setPrompts] = useState<PromptDemo[]>([]);
  const [historial, setHistorial] = useState<ResumenEjecucion[]>([]);
  const [peores, setPeores] = useState<Record<string, Estado | null>>({});
  const conversacion = useRef<HTMLDivElement>(null);

  const cargarHistorial = useCallback(() => {
    api<ResumenEjecucion[]>("/chat/historial").then(setHistorial).catch(() => {});
  }, []);

  useEffect(() => {
    api<PromptDemo[]>("/prompts").then(setPrompts).catch(() => {});
    cargarHistorial();
  }, [cargarHistorial]);

  // La etiqueta de cada fila del historial (la decisión más restrictiva) sale del detalle de la ejecución.
  useEffect(() => {
    for (const h of historial.slice(0, 30)) {
      if (h.estado !== "terminada" || h.id in peores) continue;
      setPeores((p) => ({ ...p, [h.id]: null }));
      api<Ejecucion<ResultadoChat>>(`/ejecuciones/${h.id}`)
        .then((e) => setPeores((p) => ({ ...p, [h.id]: peorDecision(e.resultado) })))
        .catch(() => {});
    }
  }, [historial, peores]);

  const bajar = useCallback(() => {
    const el = conversacion.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  useEffect(bajar, [mensajes.length, bajar]);

  async function enviar(cuerpo: { mensaje: string } | { prompt_id: string }, mostrado: string) {
    if (enviando || enCurso) return;
    setEnviando(true);
    try {
      const ej = await api<Ejecucion<ResultadoChat>>("/chat", { metodo: "POST", cuerpo });
      setEnCurso(ej.id);
      setMensajes((m) => [
        ...m,
        { clave: `u-${ej.id}`, tipo: "usuario", texto: mostrado },
        { clave: `a-${ej.id}`, tipo: "agente", ejecucionId: ej.id, inicial: ej },
      ]);
      setTexto("");
    } catch (e) {
      const err = e as ApiError;
      toast(err.status === 409 ? "Hay otra ejecución en curso; espera a que termine." : err.message, "error");
    } finally {
      setEnviando(false);
    }
  }

  const alTerminar = useCallback(
    (ej: Ejecucion<ResultadoChat>) => {
      setEnCurso((actual) => (actual === ej.id ? null : actual));
      setPeores((p) => ({ ...p, [ej.id]: peorDecision(ej.resultado) }));
      cargarHistorial();
    },
    [cargarHistorial],
  );

  function abrir(h: ResumenEjecucion) {
    const ya = document.getElementById(`msg-${h.id}`);
    if (ya) {
      ya.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setMensajes((m) => [
      ...m,
      { clave: `u-${h.id}`, tipo: "usuario", texto: h.entrada },
      { clave: `a-${h.id}`, tipo: "agente", ejecucionId: h.id, inicial: null },
    ]);
  }

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    const t = texto.trim();
    if (t) void enviar({ mensaje: t }, t);
  }

  const ejemplos = [
    ...prompts.map((p) => ({ id: p.id, texto: p.texto, cuerpo: { prompt_id: p.id } as const })),
    { id: "hitl", texto: EJEMPLO_HITL, cuerpo: { mensaje: EJEMPLO_HITL } as const },
  ].sort((a, b) => ORDEN.indexOf(a.id) - ORDEN.indexOf(b.id));
  const ocupado = enviando || enCurso !== null;

  return (
    <Vista alto>
      <h1>Habla con el agente</h1>
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="panel flex min-h-[480px] flex-col lg:min-h-0">
          <div ref={conversacion} className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-auto p-4" aria-live="polite">
            {mensajes.length === 0 && (
              <Vacio titulo="¿En qué te ayudo?">Escribe una instrucción o usa un ejemplo. Cada acción pasa por AgentGuard.</Vacio>
            )}
            {mensajes.map((m) =>
              m.tipo === "usuario" ? (
                <div key={m.clave} className="max-w-[88%] self-end rounded-xl border border-brand bg-brand px-[13px] py-2.5 text-bg">
                  {m.texto}
                </div>
              ) : (
                <MensajeAgente
                  key={m.clave}
                  id={m.ejecucionId}
                  inicial={m.inicial}
                  onTerminar={alTerminar}
                  onActualizar={bajar}
                  onIr={onIr}
                />
              ),
            )}
          </div>
          <div className="flex flex-none flex-col gap-2.5 border-t border-line px-4 py-3">
            <div className="flex flex-wrap gap-1.5">
              {ejemplos.map((ej) => (
                <button
                  key={ej.id}
                  type="button"
                  className="chip text-left"
                  disabled={ocupado}
                  onClick={() => void enviar(ej.cuerpo, ej.texto)}
                >
                  {ej.texto}
                </button>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={alEnviar}>
              <input
                className="input min-w-0 flex-1"
                placeholder="Escribe una instrucción"
                autoComplete="off"
                value={texto}
                maxLength={2000}
                onChange={(e) => setTexto(e.target.value)}
                aria-label="Instrucción para el agente"
              />
              <button className="btn btn-primary" type="submit" disabled={ocupado || !texto.trim()}>
                {ocupado ? "Esperando…" : "Enviar"}
              </button>
            </form>
          </div>
        </div>

        <div className="panel flex min-h-0 flex-col">
          <div className="panel-h">
            <h3>Historial</h3>
            <span className="text-[12px] text-fg-3">{historial.length ? `${historial.length} solicitudes` : ""}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {historial.length === 0 && <Vacio>Aún no hay solicitudes.</Vacio>}
            {historial.map((h) => {
              const peor = peores[h.id];
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => abrir(h)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-2.5 gap-y-1 border-b border-line px-4 py-2.5 text-left last:border-b-0 hover:bg-surface-2"
                >
                  <span className="truncate">{h.entrada}</span>
                  <span>
                    {h.estado === "error" ? (
                      <Badge estado="FALLO" texto="Error" />
                    ) : h.estado !== "terminada" ? (
                      <Badge estado="HITL" texto="En curso" />
                    ) : peor ? (
                      <Badge estado={peor} />
                    ) : null}
                  </span>
                  <small className="text-[12px] text-fg-3">{hora(h.creada)}</small>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Vista>
  );
}

function MensajeAgente({
  id,
  inicial,
  onTerminar,
  onActualizar,
  onIr,
}: {
  id: string;
  inicial: Ejecucion<ResultadoChat> | null;
  onTerminar: (ej: Ejecucion<ResultadoChat>) => void;
  onActualizar: () => void;
  onIr: (v: IdVista) => void;
}) {
  const { ejecucion: ej, error } = useEjecucion<ResultadoChat>(id, 1000, inicial);
  const terminada = ej?.estado === "terminada" || ej?.estado === "error";

  useEffect(() => {
    if (ej && terminada) onTerminar(ej);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminada]);
  useEffect(onActualizar, [ej?.ultimo_evento, ej?.estado, onActualizar]);

  const r = ej?.resultado ?? null;
  const respuesta = r ? redactarRespuesta(r, "B", r.modelo) : "";
  const ultimo = ej && !r ? leerTraza(ej.eventos).pasos.at(-1) : undefined;

  return (
    <div id={`msg-${id}`} className="flex max-w-[88%] flex-col gap-1.5">
      <div className="text-[11.5px] text-fg-3">Agente{r ? ` · modelo ${r.modelo}` : ""}</div>
      {r ? <AccionesB r={r} /> : ej && <AccionesEnVivo eventos={ej.eventos} />}
      {ej?.estado === "esperando_aprobacion" && ej.solicitud_pendiente && (
        <TarjetaHitl pendiente={ej.solicitud_pendiente} desde={ej.eventos.find((e) => e.tipo === "hitl_pendiente")?.ts} onIr={onIr} />
      )}
      <div
        className={`rounded-xl border px-[13px] py-2.5 ${
          ej?.estado === "error" || error ? "border-block-bd bg-block-bg text-block" : "border-line bg-surface-2"
        }`}
      >
        {error ?? (ej?.estado === "error" ? `No se pudo completar: ${ej.error}` : r ? respuesta || "(sin respuesta)" : (
          <span className="text-fg-3">
            {ej?.estado === "esperando_aprobacion" ? "Esperando la aprobación…" : "Procesando…"}
            {ultimo?.detalle && <span className="mt-1 block truncate text-[12px]">{ultimo.detalle}</span>}
          </span>
        ))}
      </div>
      {r && (
        <div className="flex flex-col gap-1">
          <Efectos r={r} />
          {r.ataque && (
            <div className={`text-[12.5px] font-semibold ${r.ataque.exitoso ? "text-block" : "text-allow"}`}>
              {r.ataque.exitoso
                ? `✕ Ataque exitoso: ${criterio(r.ataque.motivo)}`
                : `✓ Ataque contenido${r.ataque.capa ? ` por ${CAPAS[r.ataque.capa] ?? r.ataque.capa}` : ""}`}
            </div>
          )}
        </div>
      )}
      {ej && ej.eventos.length > 0 && <Traza eventos={ej.eventos} respuesta={r ? respuesta : undefined} config="B" instruccion={ej.entrada} />}
    </div>
  );
}

function TarjetaHitl({ pendiente, desde, onIr }: { pendiente: SolicitudPendiente; desde?: string; onIr: (v: IdVista) => void }) {
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const inicio = desde ? new Date(desde).getTime() : ahora;
  const restante = Math.max(0, Math.round(pendiente.espera_segundos - (ahora - inicio) / 1000));

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-hitl-bd bg-hitl-bg px-[13px] py-2.5 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <Badge estado="HITL" texto="Esperando aprobación" />
        <b className="font-semibold">{frase(pendiente.herramienta, pendiente.argumentos)}</b>
        <span className="ml-auto font-mono text-[12px] text-hitl tabular-nums">
          {Math.floor(restante / 60)}:{String(restante % 60).padStart(2, "0")}
        </span>
      </div>
      <div className="text-fg-2">
        Solicitud #{pendiente.solicitud}, la decide <b className="font-semibold">{pendiente.aprobador_sugerido ?? "el jefe del área"}</b> o
        Gerencia.{" "}
        <button type="button" className="text-brand-2 underline" onClick={() => onIr("aprobaciones")}>
          Ver en Aprobaciones
        </button>
      </div>
    </div>
  );
}
