import type { Evento, ResumenCorrida } from "../api/tipos";
import { estadoDecision, regla, tema, type Estado } from "../lib/formato";
import { efectoEnFrase, limpiar, unir } from "../lib/narrativa";
import { Accion } from "./comunes";

/** Las acciones de una corrida de la Config. B: verificador de entrada y cada decisión de AgentGuard. */
export function AccionesB({ r }: { r: ResumenCorrida }) {
  const rechazos = r.verificador_entrada.filter((v) => v.accion === "REJECT");
  if (!rechazos.length && !r.decisiones_agentguard.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {rechazos.map((v, i) => (
        <Accion
          key={`v${i}`}
          estado="REJECT"
          texto={`Verificador de entrada: ${unir(v.temas.map(tema)) || "rechazado"}`}
          titulo={`${limpiar(v.motivo)}${v.notificado ? ". Se avisó a Tecnología" : ""}.`}
        />
      ))}
      {r.decisiones_agentguard.map((d, i) => (
        <Accion
          key={i}
          estado={estadoDecision(d)}
          tool={d.herramienta}
          args={d.argumentos}
          titulo={`${regla(d.regla)}: ${limpiar(d.motivo)}${d.aprobador && d.aprobador !== "sin_respuesta" ? `. Decidió ${d.aprobador}` : ""}`}
        />
      ))}
    </div>
  );
}

/** Las acciones de la Config. A: todo lo que pidió el modelo se ejecutó, sin control. */
export function AccionesA({ r }: { r: ResumenCorrida }) {
  if (!r.herramientas_solicitadas.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {r.herramientas_solicitadas.map((h, i) => (
        <Accion
          key={i}
          estado={h.resultado?.ok === false ? "FALLO" : "EJEC"}
          tool={h.herramienta}
          args={h.argumentos}
          titulo={h.resultado?.ok === false ? limpiar(String(h.resultado.error ?? "")) : "Se ejecutó sin ningún control"}
        />
      ))}
    </div>
  );
}

const PATRON = /^\[agentguard\] (ALLOW|BLOCK|HITL) \[[^\]]+\] ([a-z_]+)/;

/** Mientras la corrida avanza: las decisiones que ya llegaron en los eventos. */
export function AccionesEnVivo({ eventos }: { eventos: Evento[] }) {
  const vistas: { estado: Estado; tool?: string; texto?: string }[] = [];
  let ultimaTool: string | undefined;
  for (const e of eventos) {
    const pide = /^\[agent\] herramienta solicitada: (\w+)/.exec(e.texto);
    if (pide) ultimaTool = pide[1];
    if (e.texto.startsWith("[agentguard] verificador de entrada: REJECT")) vistas.push({ estado: "REJECT", texto: "Verificador de entrada" });
    const m = PATRON.exec(e.texto);
    if (m) vistas.push({ estado: m[1] as Estado, tool: ultimaTool ?? m[2] });
  }
  if (!vistas.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {vistas.map((v, i) => (
        <Accion key={i} estado={v.estado} tool={v.tool} texto={v.texto} />
      ))}
    </div>
  );
}

/** Lo que realmente pasó en la base (bitácora de efectos), que es lo que decide si un ataque tuvo éxito. */
export function Efectos({ r }: { r: ResumenCorrida }) {
  const reales = r.efectos.filter((e) => e.efecto !== "ERROR");
  if (!reales.length) return <div className="text-[12px] text-fg-3">En la base no hubo cambios ni lecturas.</div>;
  const partes = reales.map((e, i) => (
    <span key={i} className={e.efecto === "READ" ? "" : "font-semibold text-fg-2"}>
      {efectoEnFrase(e)}
    </span>
  ));
  return (
    <div className="text-[12px] text-fg-3">
      En la base{" "}
      {partes.map((p, i) => (
        <span key={i}>
          {i > 0 && (i === partes.length - 1 ? " y " : ", ")}
          {p}
        </span>
      ))}
      .
    </div>
  );
}
