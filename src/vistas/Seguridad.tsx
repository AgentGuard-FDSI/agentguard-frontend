import { useCallback, useMemo, useState } from "react";

import { api } from "../api/cliente";
import type { EntradaCadena, ResumenSeguridad, Verificacion } from "../api/tipos";
import { AvisoError, Badge, Cargando, Encabezado, Punto, Vacio } from "../components/comunes";
import { useToast } from "../components/Toast";
import { Vista } from "../components/Vista";
import { area, ETIQUETA, fechaHora, herramienta, hora, objetivo, regla, tema, type Estado } from "../lib/formato";
import { limpiar } from "../lib/narrativa";
import { useIntervalo } from "../lib/useIntervalo";
import { usePerfil } from "../sesion";

type Filtro = "TODAS" | "ALLOW" | "BLOCK" | "HITL" | "REJECT";

/** Una fila del registro de auditoría: decisión de authorize() o rechazo del verificador de entrada. */
interface Fila {
  entrada: EntradaCadena;
  estado: Estado;
  nombre: string;
  sobre: [string, string];
  regla: string;
  motivo: string;
}

function aFila(e: EntradaCadena): Fila | null {
  const r = e.registro;
  if (r.tipo === "decision") {
    return {
      entrada: e,
      estado: r.decision?.action as Estado,
      nombre: herramienta(r.tool),
      sobre: objetivo(r.arguments),
      regla: regla(r.decision?.rule ?? ""),
      motivo: limpiar(r.decision?.reason ?? ""),
    };
  }
  if (r.tipo === "verificador_entrada" && r.resultado?.action === "REJECT") {
    const temas: string[] = r.resultado.topics ?? [];
    return {
      entrada: e,
      estado: "REJECT",
      nombre: "Verificador de entrada",
      sobre: ["Tema", temas.map(tema).join(", ")],
      regla: temas.map(tema).join(", ") || "rechazo de entrada",
      motivo: `${limpiar(r.resultado.reason ?? "")}. El modelo no la recibió.`,
    };
  }
  return null;
}

const TITULOS_AVISO: Record<string, string> = {
  entrada_rechazada: "Solicitud rechazada en la entrada",
  acceso_entre_areas: "Acceso a un recurso de otra área",
  alerta_cuenta_comprometida: "Posible cuenta comprometida",
};

export default function Seguridad() {
  const perfil = usePerfil();
  const toast = useToast();
  const [resumen, setResumen] = useState<ResumenSeguridad | null>(null);
  const [registro, setRegistro] = useState<EntradaCadena[] | null>(null);
  const [alertas, setAlertas] = useState<EntradaCadena[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("TODAS");
  const [busqueda, setBusqueda] = useState("");
  const [verificando, setVerificando] = useState(false);

  const cargar = useCallback(() => {
    Promise.all([
      api<ResumenSeguridad>("/seguridad/resumen"),
      api<EntradaCadena[]>("/seguridad/registro?limite=500"),
      api<EntradaCadena[]>("/seguridad/alertas"),
    ])
      .then(([r, g, a]) => {
        setResumen(r);
        setRegistro(g);
        setAlertas(a);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  useIntervalo(cargar, 5000);

  async function verificar() {
    setVerificando(true);
    try {
      const v = await api<Verificacion>("/seguridad/verificar");
      setResumen((r) => (r ? { ...r, integridad: v } : r));
      toast(
        v.integra
          ? `Cadena verificada: ${v.entradas_verificadas} entradas, sin alteraciones`
          : `¡Cadena alterada en la entrada ${v.roto_en}! ${v.motivo}`,
        v.integra ? "normal" : "error",
      );
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setVerificando(false);
    }
  }

  const filas = useMemo(() => (registro ?? []).map(aFila).filter((f): f is Fila => f !== null), [registro]);
  const q = busqueda.trim().toLowerCase();
  const visibles = filas.filter(
    (f) =>
      (filtro === "TODAS" || f.estado === filtro) &&
      (!q || `${f.nombre} ${f.sobre.join(" ")} ${f.regla} ${f.motivo}`.toLowerCase().includes(q)),
  );
  const integra = resumen?.integridad.integra ?? true;

  return (
    <Vista>
      <Encabezado titulo="Seguridad">
        <span className="text-[12.5px] text-fg-3">
          Tus decisiones y los avisos dirigidos a {area(perfil.area)}. Cada registro está encadenado con SHA-256.
        </span>
      </Encabezado>
      {error && <AvisoError>{error}</AvisoError>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.3fr)]">
        {(["ALLOW", "BLOCK", "HITL", "REJECT"] as const).map((d) => {
          const n = !resumen ? "–" : d === "REJECT" ? resumen.rechazos_entrada : resumen.decisiones[d];
          const estilos = {
            ALLOW: "border-t-allow-dot text-allow",
            BLOCK: "border-t-block-dot text-block",
            HITL: "border-t-hitl-dot text-hitl",
            REJECT: "border-t-reject-dot text-reject",
          }[d];
          return (
            <div key={d} className={`panel flex flex-col gap-0.5 border-t-[3px] px-4 py-3 ${estilos}`}>
              <small className="text-[12px] text-fg-3">{d === "REJECT" ? "Rechazado en la entrada" : ETIQUETA[d]}</small>
              <b className="text-[24px] font-semibold leading-tight tabular-nums">{n}</b>
            </div>
          );
        })}
        <div className="panel col-span-2 flex items-center gap-3 px-4 py-3 lg:col-span-1">
          <div
            className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-full text-bg ${
              integra ? "bg-allow-dot shadow-[0_0_0_4px_theme(colors.allow.bg)]" : "bg-block-dot shadow-[0_0_0_4px_theme(colors.block.bg)]"
            }`}
            aria-hidden
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              {integra ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M12 6v8M12 18h.01" />}
            </svg>
          </div>
          <div className="min-w-0">
            <b className="block font-semibold">{integra ? "Registro íntegro" : "Registro alterado"}</b>
            <small className="text-[12px] text-fg-3">
              {resumen
                ? integra
                  ? `${resumen.integridad.entradas_verificadas} entradas sin alteraciones`
                  : `Se rompe en la entrada ${resumen.integridad.roto_en}; avisa a Tecnología`
                : "Verificando…"}
            </small>
          </div>
          <button type="button" className="btn btn-sm btn-ghost ml-auto" onClick={() => void verificar()} disabled={verificando}>
            Verificar
          </button>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="panel">
          <div className="panel-h">
            <h3>Registro de auditoría</h3>
            <span className="text-[12px] text-fg-3">{registro ? `${visibles.length} de ${filas.length}` : ""}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <input
              className="input !w-[220px] !py-1.5 !text-[13px]"
              placeholder="Buscar herramienta, pedido o correo"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar en el registro"
            />
            <div className="flex flex-wrap gap-1.5">
              {(["TODAS", "ALLOW", "BLOCK", "HITL", "REJECT"] as const).map((f) => (
                <button key={f} type="button" className="chip !py-[3px]" aria-pressed={filtro === f} onClick={() => setFiltro(f)}>
                  {f === "TODAS" ? "Todas" : ETIQUETA[f]}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              <div className="grid grid-cols-[14px_minmax(150px,1.1fr)_minmax(140px,1.2fr)_150px_minmax(120px,1fr)_70px_64px] items-center gap-3.5 border-b border-line px-4 py-2 text-[11.5px] text-fg-3">
                <span />
                <span>Herramienta</span>
                <span>Sobre</span>
                <span>Decisión</span>
                <span>Regla</span>
                <span>Hora</span>
                <span>Hash</span>
              </div>
              {!registro ? (
                <Cargando />
              ) : visibles.length === 0 ? (
                <Vacio>{filas.length ? "Nada coincide con el filtro." : "Aún no hay registros tuyos. Usa el Asistente."}</Vacio>
              ) : (
                visibles.map((f) => <FilaRegistro key={f.entrada.seq} f={f} />)
              )}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>Alertas</h3>
            <span className="text-[12px] text-fg-3">{alertas.length || ""}</span>
          </div>
          {alertas.length === 0 ? (
            <Vacio>Sin alertas.</Vacio>
          ) : (
            alertas.map((a) => {
              const r = a.registro;
              const prioritaria = r.prioridad === "PRIORITARIA";
              return (
                <details key={a.seq} className="group border-b border-line last:border-b-0">
                  <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-[11px] [&::-webkit-details-marker]:hidden">
                    <Punto estado={prioritaria ? "BLOCK" : r.kind === "entrada_rechazada" ? "REJECT" : "HITL"} />
                    <b className="min-w-0 flex-1 text-[13px] font-semibold">{TITULOS_AVISO[r.kind] ?? r.kind}</b>
                    <span className="text-[11.5px] text-fg-3 tabular-nums">{hora(a.ts)}</span>
                    <span className="text-[10px] text-fg-3 transition-transform group-open:rotate-90">▶</span>
                  </summary>
                  <p className="m-0 px-4 pb-3 pl-[34px] text-[12.5px] text-fg-2">
                    {limpiar(r.motivo ?? "")}
                    <br />
                    <span className="text-fg-3">
                      {r.usuario ? `La originó ${r.usuario} y se avisó a ` : "Se avisó a "}
                      {area(r.area_destino)}
                      {prioritaria ? ", con prioridad alta." : "."}
                    </span>
                  </p>
                </details>
              );
            })
          )}
        </div>
      </div>
    </Vista>
  );
}

function FilaRegistro({ f }: { f: Fila }) {
  const r = f.entrada.registro;
  const ap = r.aprobacion as { aprobado: boolean; aprobador: string; comentario?: string; regla?: string | null } | null | undefined;
  return (
    <details className="border-b border-line last:border-b-0">
      <summary className="grid cursor-pointer list-none grid-cols-[14px_minmax(150px,1.1fr)_minmax(140px,1.2fr)_150px_minmax(120px,1fr)_70px_64px] items-center gap-3.5 px-4 py-[11px] hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <Punto estado={f.estado} />
        <span className="truncate font-semibold">{f.nombre}</span>
        <span className="flex min-w-0 items-center gap-[7px]">
          {f.sobre[0] && <span className="flex-none rounded-[5px] border border-line-2 px-1.5 text-[11px] text-fg-3">{f.sobre[0]}</span>}
          <span className="truncate">{f.sobre[1]}</span>
        </span>
        <span>
          <Badge estado={f.estado} />
        </span>
        <span className="truncate text-[12.5px] text-fg-3">{f.regla}</span>
        <span className="text-[13px] text-fg-2 tabular-nums">{hora(f.entrada.ts)}</span>
        <span className="font-mono text-[11.5px] text-fg-3">{f.entrada.hash.slice(0, 6)}</span>
      </summary>
      <dl className="m-0 grid grid-cols-[110px_minmax(0,1fr)] gap-x-3.5 gap-y-1 px-4 pb-3.5 pl-11 pt-1 text-[13px]">
        <dt className="text-fg-3">Motivo</dt>
        <dd className="m-0">{f.motivo}</dd>
        <dt className="text-fg-3">Usuario</dt>
        <dd className="m-0">
          {r.usuario} · {area(r.area)} · {r.nivel}
        </dd>
        {ap && (
          <>
            <dt className="text-fg-3">Aprobación</dt>
            <dd className="m-0">
              {ap.aprobado ? "Aprobada" : "No aprobada"} por {ap.aprobador}
              {ap.comentario ? ` · “${ap.comentario}”` : ""}
            </dd>
          </>
        )}
        {r.tipo === "decision" && (
          <>
            <dt className="text-fg-3">Se ejecutó</dt>
            <dd className="m-0">{r.autorizada ? "Sí" : "No"}</dd>
          </>
        )}
        <dt className="text-fg-3">Corrida</dt>
        <dd className="m-0 break-all font-mono text-[12px]">{r.run_id ?? "—"}</dd>
        <dt className="text-fg-3">Registrado</dt>
        <dd className="m-0">
          {fechaHora(f.entrada.ts)} · entrada #{f.entrada.seq}
        </dd>
        <dt className="text-fg-3">Hash</dt>
        <dd className="m-0 break-all font-mono text-[11.5px] text-fg-2">{f.entrada.hash}</dd>
        <dt className="text-fg-3">Hash anterior</dt>
        <dd className="m-0 break-all font-mono text-[11.5px] text-fg-3">{f.entrada.prev_hash}</dd>
      </dl>
    </details>
  );
}
