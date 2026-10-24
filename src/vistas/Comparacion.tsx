import { useEffect, useState } from "react";

import { api, ApiError } from "../api/cliente";
import type { Ejecucion, ExperimentoGuardado, LadoComparacion, Metricas, PromptDemo, ResultadoComparacion } from "../api/tipos";
import { AccionesA, AccionesB, Efectos } from "../components/Acciones";
import { AvisoError, Cargando, Encabezado, Vacio } from "../components/comunes";
import { useToast } from "../components/Toast";
import { Traza } from "../components/Traza";
import { Vista } from "../components/Vista";
import { area, CAPAS, nivel, porcentaje } from "../lib/formato";
import { criterio, fechaLarga, redactarRespuesta } from "../lib/narrativa";
import { useEjecucion } from "../lib/useEjecucion";
import { usePerfil } from "../sesion";

/** La misma instrucción en la Config. A (sin control) y en la Config. B (con AgentGuard), lado a lado.
 *  Corre en un laboratorio aislado de la API: no toca la base del chat ni el registro de Seguridad. */
export default function Comparacion() {
  const perfil = usePerfil();
  const toast = useToast();
  const [prompts, setPrompts] = useState<PromptDemo[]>([]);
  const [elegido, setElegido] = useState("inyeccion");
  const [resultados, setResultados] = useState<Record<string, { r: ResultadoComparacion; ejecucion: Ejecucion<ResultadoComparacion> }>>({});
  const [corrida, setCorrida] = useState<{ id: string; prompt: string } | null>(null);
  const [experimentos, setExperimentos] = useState<ExperimentoGuardado[]>([]);
  const [expElegido, setExpElegido] = useState<string | null>(null);

  useEffect(() => {
    api<PromptDemo[]>("/prompts").then(setPrompts).catch(() => {});
    api<ExperimentoGuardado[]>("/comparacion/resultados")
      .then((r) => {
        // Solo experimentos corridos con el código del Avance 3 (verificador de entrada y contención por
        // capa); los anteriores no reflejan los controles actuales.
        const conMetricas = r.filter((e) => e.metricas?.B?.contencion_por_capa);
        setExperimentos(conMetricas);
        if (conMetricas.length) setExpElegido((e) => e ?? conMetricas[conMetricas.length - 1].archivo);
      })
      .catch(() => {});
  }, []);

  const { ejecucion, error } = useEjecucion<ResultadoComparacion>(corrida?.id ?? null, 700);
  useEffect(() => {
    if (!corrida || !ejecucion) return;
    if (ejecucion.estado === "terminada" && ejecucion.resultado) {
      setResultados((r) => ({ ...r, [corrida.prompt]: { r: ejecucion.resultado!, ejecucion } }));
    }
    if (ejecucion.estado === "error") toast(`La comparación falló: ${ejecucion.error}`, "error");
  }, [ejecucion?.estado]); // eslint-disable-line react-hooks/exhaustive-deps

  const corriendo = corrida !== null && (!ejecucion || ejecucion.estado === "en_curso");

  async function correr() {
    try {
      const ej = await api<Ejecucion<ResultadoComparacion>>("/comparacion", { metodo: "POST", cuerpo: { prompt_id: elegido } });
      setCorrida({ id: ej.id, prompt: elegido });
    } catch (e) {
      const err = e as ApiError;
      toast(err.status === 409 ? "Hay otra ejecución en curso; espera a que termine." : err.message, "error");
    }
  }

  async function restaurar() {
    try {
      await api("/demo/reiniciar", { metodo: "POST" });
      toast("Base del chat restaurada desde la base limpia");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  const prompt = prompts.find((p) => p.id === elegido);
  const guardado = resultados[elegido];
  const mostrarCorrida = corrida?.prompt === elegido && corriendo;
  const eventos = guardado?.ejecucion.eventos ?? [];

  return (
    <Vista>
      <Encabezado titulo="Comparación A / B">
        <div className="flex flex-wrap gap-2">
          {perfil.administra_demo && (
            <button type="button" className="btn btn-sm" onClick={() => void restaurar()} title="Copia la base limpia sobre la base del chat">
              Restaurar base del chat
            </button>
          )}
          <button type="button" className="btn btn-sm btn-primary" onClick={() => void correr()} disabled={corriendo || !prompt}>
            {corriendo ? "Corriendo…" : "Correr escenario"}
          </button>
        </div>
      </Encabezado>

      <div className="grid items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="panel">
          <div className="flex flex-col gap-0.5 p-1.5">
            {prompts.map((p, i) => (
              <button
                key={p.id}
                type="button"
                aria-current={p.id === elegido}
                onClick={() => setElegido(p.id)}
                className={`flex items-center justify-between gap-2 rounded-[7px] px-2.5 py-2 text-left text-[13.5px] ${
                  p.id === elegido ? "bg-brand-bg text-fg" : "text-fg-2 hover:bg-surface-2 hover:text-fg"
                }`}
              >
                <span>{p.nombre}</span>
                <span className="flex items-center gap-1.5 text-[11.5px] text-fg-3 tabular-nums">
                  {resultados[p.id] && <span className="h-1.5 w-1.5 rounded-full bg-brand" title="Ya corrido" />}
                  {i + 1}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {prompt && (
            <div className="rounded-xl border border-line bg-surface-2 px-[13px] py-2.5">
              <div>{prompt.texto}</div>
              <div className="mt-1 text-[12px] text-fg-3">
                Lo pide {prompt.sesion.usuario}, {nivel(prompt.sesion.nivel).toLowerCase()} de {area(prompt.sesion.area)}.{" "}
                {prompt.es_ataque ? `Es un ataque (escenario ${prompt.escenario}).` : "Es una solicitud legítima."}
              </div>
            </div>
          )}
          {error && <AvisoError>{error}</AvisoError>}
          <div className="grid gap-4 md:grid-cols-2">
            <Columna config="A" prompt={prompt} lado={guardado?.r.A} corriendo={mostrarCorrida} eventos={eventos} />
            <Columna config="B" prompt={prompt} lado={guardado?.r.B} corriendo={mostrarCorrida} eventos={eventos} />
          </div>
          {experimentos.length > 0 && <PanelExperimento experimentos={experimentos} elegido={expElegido} onElegir={setExpElegido} />}
        </div>
      </div>
    </Vista>
  );
}

function Columna({
  config,
  prompt,
  lado,
  corriendo,
  eventos,
}: {
  config: "A" | "B";
  prompt?: PromptDemo;
  lado?: LadoComparacion;
  corriendo: boolean;
  eventos: Ejecucion["eventos"];
}) {
  let veredicto: { tono: string; texto: string } | null = null;
  if (lado && prompt) {
    if (prompt.es_ataque) {
      veredicto = lado.ataque_exitoso
        ? { tono: "text-block", texto: "✕ El ataque tuvo éxito" }
        : { tono: "text-allow", texto: `✓ Ataque contenido${lado.capa ? ` por ${CAPAS[lado.capa] ?? lado.capa}` : ""}` };
    } else {
      const bloqueada = lado.decisiones_agentguard.some((d) => d.decision === "BLOCK") || lado.verificador_entrada.some((v) => v.accion === "REJECT");
      veredicto = bloqueada ? { tono: "text-block", texto: "✕ Falso positivo: se bloqueó una solicitud legítima" } : { tono: "text-fg-2", texto: "Se atendió la solicitud" };
    }
  }
  const propios = eventos.filter((e) => e.config === config);
  const respuesta = lado ? redactarRespuesta(lado, config, "guion") : "";

  return (
    <div className="panel flex flex-col">
      <div className={`panel-h rounded-t-xl border-t-[3px] ${config === "A" ? "border-t-nocontrol" : "border-t-brand"}`}>
        <h3>{config === "A" ? "A · Sin control" : "B · AgentGuard"}</h3>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 px-4 py-3.5">
        {corriendo ? (
          <Cargando texto="Corriendo…" />
        ) : !lado ? (
          <Vacio>Corre el escenario para ver qué hace esta configuración.</Vacio>
        ) : (
          <>
            {config === "A" ? <AccionesA r={lado} /> : <AccionesB r={lado} />}
            <div className="rounded-xl border border-line bg-surface-2 px-[13px] py-2.5">{respuesta || "(sin respuesta)"}</div>
            <Efectos r={lado} />
            {lado.ataque_exitoso !== null && lado.motivo && (
              <div className="text-[12px] text-fg-3">Criterio de éxito: {criterio(lado.motivo)}.</div>
            )}
            {propios.length > 0 && <Traza eventos={propios} respuesta={respuesta} config={config} instruccion={prompt?.texto} />}
          </>
        )}
      </div>
      {veredicto && !corriendo && <div className={`border-t border-line px-4 py-2.5 text-[13px] font-semibold ${veredicto.tono}`}>{veredicto.texto}</div>}
    </div>
  );
}

/** "groq:openai/gpt-oss-120b" → "Groq · gpt-oss-120b". */
function nombreModelo(m: string | null | undefined): string {
  if (!m) return "Modelo";
  const [proveedor, ...resto] = m.split(":");
  const modelo = resto.join(":").split("/").pop() ?? "";
  return modelo ? `${proveedor.charAt(0).toUpperCase()}${proveedor.slice(1)} · ${modelo}` : m;
}

function de(n: number | null | undefined, total: number | null | undefined): string {
  return `${n ?? 0} de ${total ?? 0}`;
}

/** Las métricas de la sección 4.2 sobre todos los escenarios y repeticiones de un experimento guardado,
 *  corrido con un modelo real (python -m andimarket.comparar). */
function PanelExperimento({
  experimentos,
  elegido,
  onElegir,
}: {
  experimentos: ExperimentoGuardado[];
  elegido: string | null;
  onElegir: (a: string) => void;
}) {
  const exp = experimentos.find((e) => e.archivo === elegido);
  const m: Metricas | null | undefined = exp?.metricas;
  const lat = m?.latencia_authorize_ms;
  const ms = (v: number | null | undefined) => (v === null || v === undefined ? "n/a" : `${v.toLocaleString("es-CO", { maximumFractionDigits: 3 })} ms`);
  const filas = m?.por_prompt ? Object.entries(m.por_prompt) : [];

  return (
    <div className="panel">
      <div className="panel-h flex-wrap">
        <h3>Resultados del experimento</h3>
        {experimentos.length > 1 && (
          <div className="seg" role="group" aria-label="Experimento">
            {experimentos.map((e) => (
              <button key={e.archivo} type="button" aria-pressed={e.archivo === elegido} onClick={() => onElegir(e.archivo)}>
                {nombreModelo(e.modelo)}
              </button>
            ))}
          </div>
        )}
      </div>
      {!m ? (
        <Vacio>Aún no hay resultados guardados en evidencia/.</Vacio>
      ) : (
        <>
          <div className="flex flex-col gap-3 px-4 py-4">
            <div className="text-[12.5px] font-medium text-fg-2">Acciones no autorizadas ejecutadas</div>
            <Barra etiqueta="A · Sin control" valor={m.A.tasa_no_autorizadas} detalle={`${de(m.A.ataques_exitosos, m.A.intentos_de_ataque)} intentos`} color="bg-nocontrol" />
            <Barra etiqueta="B · AgentGuard" valor={m.B.tasa_no_autorizadas} detalle={`${de(m.B.ataques_exitosos, m.B.intentos_de_ataque)} intentos`} color="bg-brand" />
          </div>
          <div className="grid grid-cols-2 border-t border-line md:grid-cols-4">
            <Celda titulo="Contención con AgentGuard" valor={porcentaje(m.B.tasa_contencion)} detalle="de los ataques" />
            <Celda titulo="Falsos positivos" valor={porcentaje(m.B.falsos_positivos)} detalle={`sobre ${m.B.solicitudes_legitimas} legítimas`} />
            <Celda titulo="Fricción" valor={porcentaje(m.B.friccion)} detalle="legítimas que pidieron aprobación" />
            <Celda titulo="Latencia de AgentGuard" valor={ms(lat?.mediana)} detalle={`mediana; p95 de ${ms(lat?.p95)}`} />
          </div>
          {filas.length > 0 && (
            <table className="w-full border-collapse border-t border-line text-[13px]">
              <thead>
                <tr className="text-left text-[12px] text-fg-3">
                  <th className="px-4 py-2 font-medium">Escenario</th>
                  <th className="px-4 py-2 font-medium">Sin control</th>
                  <th className="px-4 py-2 font-medium">AgentGuard</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(([id, f]) => (
                  <tr key={id} className="border-t border-line">
                    <td className="px-4 py-2">{f.nombre}</td>
                    <CeldaEscenario config="A" ataque={f.es_ataque} exitosos={f.A.exitosos} corridas={f.A.corridas} />
                    <CeldaEscenario config="B" ataque={f.es_ataque} exitosos={f.B.exitosos} corridas={f.B.corridas} decisiones={f.B.decisiones} />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="border-t border-line px-4 py-2.5 text-[12px] text-fg-3">
            {nombreModelo(exp?.modelo)}
            {exp?.temperatura !== null && exp?.temperatura !== undefined ? `, temperatura ${exp.temperatura}` : ""}
            {exp?.repeticiones ? `, ${exp.repeticiones} ${exp.repeticiones === 1 ? "repetición" : "repeticiones"} por escenario` : ""}
            {exp?.fecha ? `. Corrido el ${fechaLarga(exp.fecha)}` : ""}.
            {m.errores ? ` Se excluyeron ${m.errores} corridas con error.` : ""}
          </div>
        </>
      )}
    </div>
  );
}

function Barra({ etiqueta, valor, detalle, color }: { etiqueta: string; valor: number | null; detalle: string; color: string }) {
  const pct = Math.max(0, Math.min(1, valor ?? 0)) * 100;
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)_auto] items-center gap-3" title={`${etiqueta}: ${porcentaje(valor)} (${detalle})`}>
      <span className="text-[12.5px] text-fg-2">{etiqueta}</span>
      <span className="h-2.5 overflow-hidden rounded-full bg-surface-2">
        <span className={`block h-full rounded-full ${color}`} style={{ width: `${pct}%`, minWidth: pct > 0 ? 4 : 0 }} />
      </span>
      <span className="whitespace-nowrap text-[12.5px] tabular-nums">
        <b className="font-semibold text-fg">{porcentaje(valor)}</b> <span className="text-fg-3">({detalle})</span>
      </span>
    </div>
  );
}

function CeldaEscenario({
  config,
  ataque,
  exitosos,
  corridas,
  decisiones,
}: {
  config: "A" | "B";
  ataque: boolean;
  exitosos: number | null;
  corridas: number;
  decisiones?: string[] | null;
}) {
  if (!ataque) {
    const bloqueada = decisiones?.includes("BLOCK");
    return <td className={`px-4 py-2 ${bloqueada ? "text-block" : "text-fg-2"}`}>{bloqueada ? "Bloqueada" : "Atendida"}</td>;
  }
  const n = exitosos ?? 0;
  // Sin control nada contiene un ataque: si no tuvo éxito es porque el modelo no obedeció.
  const sinExito = config === "A" ? "El modelo no obedeció" : "Contenido";
  const veces = corridas === 1 ? "" : n === 0 ? ` (${corridas} de ${corridas})` : "";
  return (
    <td className={`px-4 py-2 tabular-nums ${n > 0 ? "font-semibold text-block" : config === "A" ? "text-fg-2" : "text-allow"}`}>
      {n > 0 ? `Tuvo éxito ${de(n, corridas)} ${corridas === 1 ? "vez" : "veces"}` : `${sinExito}${veces}`}
    </td>
  );
}

function Celda({ titulo, valor, detalle, color = "" }: { titulo: string; valor: string; detalle?: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-r border-line px-4 py-3.5 md:border-b-0 [&:nth-child(2n)]:border-r-0 md:[&:nth-child(2n)]:border-r md:last:!border-r-0">
      <small className="text-[12px] text-fg-3">{titulo}</small>
      <b className={`text-[20px] font-semibold tabular-nums ${color}`}>{valor}</b>
      {detalle && <small className="text-[12px] text-fg-3">{detalle}</small>}
    </div>
  );
}
