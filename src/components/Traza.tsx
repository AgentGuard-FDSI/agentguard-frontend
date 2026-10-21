import { useId, useState } from "react";

import type { Evento } from "../api/tipos";
import { leerTraza, quien, type Paso } from "../lib/narrativa";
import { Badge } from "./comunes";

const PUNTO: Record<string, string> = {
  ALLOW: "bg-allow-dot",
  APPROVED: "bg-allow-dot",
  EJEC: "bg-nocontrol",
  BLOCK: "bg-block-dot",
  REJECTED: "bg-block-dot",
  FALLO: "bg-block-dot",
  HITL: "bg-hitl-dot",
  REJECT: "bg-reject-dot",
  ANULADA: "bg-line-2",
};
const PUNTO_TIPO: Record<string, string> = {
  instruccion: "bg-brand",
  modelo: "bg-lav",
  pide: "bg-lav",
  respuesta: "bg-brand",
  aviso: "bg-hitl-dot",
  nota: "bg-line-2",
};
const ETIQUETA_BADGE: Record<string, string> = { EJEC: "Ejecutado", FALLO: "No se ejecutó" };

function horaSeg(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function Fila({ p, ultimo }: { p: Paso; ultimo: boolean }) {
  const punto = (p.estado && PUNTO[p.estado]) || PUNTO_TIPO[p.tipo] || "bg-line-2";
  const conBadge = p.estado && (p.tipo === "decision" || p.tipo === "verificador" || p.tipo === "hitl");
  return (
    <li className="grid grid-cols-[58px_14px_minmax(0,1fr)] gap-x-2.5">
      <time className="pt-[1px] text-right font-mono text-[10.5px] tabular-nums text-fg-3">{horaSeg(p.ts)}</time>
      <span className="relative flex justify-center" aria-hidden>
        <span className={`relative z-[1] mt-[5px] h-2 w-2 rounded-full ring-2 ring-surface ${punto}`} />
        {!ultimo && <span className="absolute bottom-[-6px] top-[9px] w-px bg-line" />}
      </span>
      <div className="min-w-0 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[.06em] text-fg-3">{p.titulo}</span>
          {conBadge && p.estado && <Badge estado={p.estado} texto={ETIQUETA_BADGE[p.estado]} className="!px-[7px] !py-0 !text-[10.5px]" />}
        </div>
        {p.detalle && (
          <p className={`m-0 mt-0.5 text-[13px] leading-snug ${p.tipo === "instruccion" || p.tipo === "respuesta" ? "text-fg" : "text-fg-2"}`}>
            {p.tipo === "instruccion" ? `“${p.detalle}”` : p.detalle}
          </p>
        )}
        {p.datos && p.datos.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {p.datos.map(([k, v]) => (
              <span key={k} className="rounded-[5px] border border-line bg-bg px-1.5 py-px text-[11px] text-fg-3">
                {k}: <span className="text-fg-2">{v}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

/** La traza de una corrida como una pestaña plegable: una línea de tiempo con cada paso del agente,
 *  de AgentGuard y de la aprobación humana. */
export function Traza({
  eventos,
  respuesta,
  config,
  instruccion,
  abierta: inicial = false,
}: {
  eventos: Evento[];
  respuesta?: string;
  instruccion?: string;
  config?: "A" | "B";
  abierta?: boolean;
}) {
  const [abierta, setAbierta] = useState(inicial);
  const id = useId();
  const traza = leerTraza(eventos, { respuesta, config, instruccion });
  if (!traza.pasos.length) return null;
  const meta = [quien(traza), traza.modelo ? `modelo ${traza.modelo}` : ""].filter(Boolean).join(" · ");

  return (
    <div>
      <button
        type="button"
        aria-expanded={abierta}
        aria-controls={id}
        onClick={() => setAbierta((a) => !a)}
        className={`inline-flex items-center gap-1.5 rounded-t-lg border border-b-0 px-2.5 py-[3px] text-[11.5px] font-medium transition-colors ${
          abierta ? "border-line bg-surface text-fg" : "rounded-b-lg border-b border-line bg-bg text-fg-2 hover:border-line-2 hover:text-fg"
        }`}
      >
        <svg viewBox="0 0 12 12" className={`h-2.5 w-2.5 transition-transform ${abierta ? "rotate-90" : ""}`} aria-hidden>
          <path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Traza
        <span className="rounded-full bg-surface-2 px-1.5 text-[10.5px] tabular-nums text-fg-3">{traza.pasos.length}</span>
      </button>
      {abierta && (
        <div id={id} className="rounded-b-lg rounded-tr-lg border border-line bg-surface">
          {meta && <div className="border-b border-line px-3 py-1.5 text-[11.5px] text-fg-3">{meta}</div>}
          <ol className="m-0 max-h-80 list-none overflow-auto px-2 pb-0.5 pt-3">
            {traza.pasos.map((p, i) => (
              <Fila key={p.clave} p={p} ultimo={i === traza.pasos.length - 1} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
