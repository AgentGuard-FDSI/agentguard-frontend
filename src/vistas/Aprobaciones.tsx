import { useCallback, useEffect, useState, type ReactNode } from "react";

import { api, ApiError } from "../api/cliente";
import type { Aprobaciones as Datos, EntradaCadena, Solicitud } from "../api/tipos";
import { AvisoError, Badge, Cargando, Encabezado, Vacio } from "../components/comunes";
import { useToast } from "../components/Toast";
import { Vista } from "../components/Vista";
import { area, fechaHora, hora, REGLAS_APROBACION } from "../lib/formato";
import { frase, limpiar } from "../lib/narrativa";
import { useIntervalo } from "../lib/useIntervalo";
import { usePerfil } from "../sesion";

type Filtro = "pendientes" | "mias" | "historial";

/** Bandeja HITL. Quién puede aprobar lo decide el core (separación de funciones), no esta pantalla. */
export default function Aprobaciones({ onCambio }: { onCambio: (n: number) => void }) {
  const perfil = usePerfil();
  const toast = useToast();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>(perfil.aprueba_hitl ? "pendientes" : "mias");
  const [comentarios, setComentarios] = useState<Record<number, string>>({});
  const [negadas, setNegadas] = useState<Record<number, string>>({});
  const [decidiendo, setDecidiendo] = useState<number | null>(null);

  const cargar = useCallback(() => {
    api<Datos>("/aprobaciones")
      .then((d) => {
        setDatos(d);
        setError(null);
        onCambio(d.pendientes.length);
      })
      .catch((e: Error) => setError(e.message));
  }, [onCambio]);

  useIntervalo(cargar, 3000);
  useEffect(() => setNegadas({}), [filtro]);

  async function decidir(s: Solicitud, aprobar: boolean) {
    setDecidiendo(s.id);
    try {
      await api(`/aprobaciones/${s.id}`, { metodo: "POST", cuerpo: { aprobar, comentario: comentarios[s.id] ?? "" } });
      toast(`Solicitud #${s.id} ${aprobar ? "aprobada" : "rechazada"}`);
      cargar();
    } catch (e) {
      const err = e as ApiError;
      setNegadas((n) => ({ ...n, [s.id]: (err.regla && REGLAS_APROBACION[err.regla]) || err.message }));
      cargar();
    } finally {
      setDecidiendo(null);
    }
  }

  const contar = (f: Filtro) => (!datos ? 0 : f === "pendientes" ? datos.pendientes.length : f === "mias" ? datos.mias.length : datos.recientes.length);

  return (
    <Vista>
      <Encabezado titulo="Aprobaciones">
        <div className="seg" role="group" aria-label="Filtro">
          {(
            [
              ["pendientes", "Por aprobar"],
              ["mias", "Mis solicitudes"],
              ["historial", "Historial"],
            ] as const
          ).map(([f, nombre]) => (
            <button key={f} type="button" aria-pressed={filtro === f} onClick={() => setFiltro(f)}>
              {nombre}
              {f !== "historial" && contar(f) > 0 && <span className="ml-1.5 text-fg-3 tabular-nums">{contar(f)}</span>}
            </button>
          ))}
        </div>
      </Encabezado>

      {error && <AvisoError>{error}</AvisoError>}

      <div className="panel">
        {!datos ? (
          <Cargando />
        ) : filtro === "pendientes" ? (
          !datos.puedo_aprobar ? (
            <Vacio titulo="Tu nivel no aprueba solicitudes">
              Solo el jefe de cada área (y Gerencia como última instancia) decide las acciones que requieren aprobación.
            </Vacio>
          ) : datos.pendientes.length === 0 ? (
            <Vacio>No tienes solicitudes por aprobar.</Vacio>
          ) : (
            datos.pendientes.map((s) => (
              <Fila key={s.id} s={s}>
                <input
                  className="input w-[180px] !py-1.5 !text-[12.5px]"
                  placeholder="Comentario"
                  value={comentarios[s.id] ?? ""}
                  maxLength={500}
                  onChange={(e) => setComentarios((c) => ({ ...c, [s.id]: e.target.value }))}
                  aria-label={`Comentario para la solicitud ${s.id}`}
                />
                <button type="button" className="btn btn-sm btn-ok" disabled={decidiendo === s.id} onClick={() => void decidir(s, true)}>
                  Aprobar
                </button>
                <button type="button" className="btn btn-sm btn-no" disabled={decidiendo === s.id} onClick={() => void decidir(s, false)}>
                  Rechazar
                </button>
                {negadas[s.id] && <span className="basis-full text-right text-[12.5px] text-block">{negadas[s.id]}</span>}
              </Fila>
            ))
          )
        ) : filtro === "mias" ? (
          datos.mias.length === 0 ? (
            <Vacio>No tienes solicitudes esperando aprobación.</Vacio>
          ) : (
            datos.mias.map((s) => (
              <Fila key={s.id} s={s}>
                <Badge estado="HITL" texto="Pendiente" />
                <span className="text-[12.5px] text-fg-3">Esperando al jefe del área o a Gerencia</span>
              </Fila>
            ))
          )
        ) : datos.recientes.length === 0 ? (
          <Vacio>Sin decisiones todavía.</Vacio>
        ) : (
          datos.recientes.map((e) => <FilaHistorial key={e.seq} e={e} />)
        )}
      </div>
    </Vista>
  );
}

function Fila({ s, children }: { s: Solicitud; children: ReactNode }) {
  return (
    <div className="grid items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-col gap-[3px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-fg-3 tabular-nums">#{s.id}</span>
          <b className="font-semibold">{frase(s.herramienta, s.argumentos)}</b>
        </div>
        <div className="text-[12.5px] text-fg-3">
          Lo pidió {s.solicitante.usuario}, de {area(s.solicitante.area)}, a las {hora(s.ts)}. {motivoSolicitud(s.motivo)}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">{children}</div>
    </div>
  );
}

function FilaHistorial({ e }: { e: EntradaCadena }) {
  const r = e.registro;
  let estado: "APPROVED" | "REJECTED" | "ANULADA" | "BLOCK" = "ANULADA";
  let detalle = "";
  if (r.tipo === "hitl_decidida") {
    estado = r.estado === "APPROVED" ? "APPROVED" : "REJECTED";
    detalle = `${r.estado === "APPROVED" ? "La aprobó" : "La rechazó"} ${r.aprobador}${r.comentario ? `: “${r.comentario}”` : ""}`;
  } else if (r.tipo === "hitl_intento_rechazado") {
    estado = "BLOCK";
    detalle = `${r.aprobador} intentó decidirla: ${REGLAS_APROBACION[r.regla] ?? r.motivo}`;
  } else {
    detalle = limpiar(r.motivo ?? "");
  }
  return (
    <div className="grid items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-col gap-[3px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-fg-3 tabular-nums">#{r.solicitud}</span>
          {r.tool && <b className="font-semibold">{frase(r.tool, r.arguments)}</b>}
        </div>
        <div className="text-[12.5px] text-fg-3">
          {r.solicitante ? `Lo pidió ${r.solicitante}, el ${fechaHora(e.ts)}` : fechaHora(e.ts)}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <Badge estado={estado} texto={estado === "BLOCK" ? "Intento denegado" : undefined} />
        <span className="text-[12.5px] text-fg-3">{detalle}</span>
      </div>
    </div>
  );
}

/** "actualizar_pedido: requiere aprobación humana (riesgo MEDIUM)" → "Requiere aprobación humana, riesgo medio." */
function motivoSolicitud(m: string): string {
  const riesgo: Record<string, string> = { LOW: "bajo", MEDIUM: "medio", HIGH: "alto", CRITICAL: "crítico" };
  const sinTool = limpiar(m).replace(/^[a-z_]+: /, "");
  const r = /\(riesgo (\w+)\)\s*$/.exec(sinTool);
  const base = sinTool.replace(/\s*\(riesgo \w+\)\s*$/, "");
  const texto = base.charAt(0).toUpperCase() + base.slice(1);
  return r ? `${texto}, riesgo ${riesgo[r[1]] ?? r[1]}.` : texto ? `${texto}.` : "";
}
