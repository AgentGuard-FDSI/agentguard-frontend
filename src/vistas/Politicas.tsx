import { useEffect, useState, type ReactNode } from "react";

import { api } from "../api/cliente";
import type { Accion, Politicas as Datos } from "../api/tipos";
import { AvisoError, Cargando, Encabezado } from "../components/comunes";
import { Vista } from "../components/Vista";
import { area, ETIQUETA, herramienta, tema } from "../lib/formato";

const CELDA: Record<Accion | "none", string> = {
  ALLOW: "h-3 w-3 rounded-full bg-allow-dot",
  HITL: "h-3 w-3 rounded-full bg-hitl-dot",
  BLOCK: "h-3 w-3 rounded-full bg-block-dot",
  none: "h-0.5 w-3 rounded-sm bg-line-2",
};

const RIESGO: Record<string, string> = { LOW: "bajo", MEDIUM: "medio", HIGH: "alto", CRITICAL: "crítico" };

/** policies.yaml en solo lectura: quién puede usar cada herramienta y con qué restricciones. */
export default function Politicas() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Datos>("/politicas").then(setDatos).catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <Vista><AvisoError>{error}</AvisoError></Vista>;
  if (!datos) return <Cargando />;

  const areas = Object.keys(datos.areas);
  const herramientas = Object.entries(datos.herramientas);
  const ultima = datos.organizacion.aprobador_ultima_instancia;
  const alerta = datos.regla_entre_areas.alerta_tras;

  return (
    <Vista>
      <Encabezado titulo="Políticas">
        <div className="flex flex-wrap gap-3.5 text-[12.5px] text-fg-2">
          {(["ALLOW", "HITL", "BLOCK"] as const).map((a) => (
            <span key={a} className="inline-flex items-center gap-1.5">
              <i className={`inline-block ${CELDA[a]}`} />
              {a === "HITL" ? "Requiere aprobación" : a === "ALLOW" ? "Permitido" : ETIQUETA[a]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <i className={`inline-block ${CELDA.none}`} />
            Sin acceso
          </span>
        </div>
      </Encabezado>

      <div className="text-[12.5px] text-fg-3">
        Solo lectura, tal como está en <span className="font-mono">{datos.archivo}</span> (versión {datos.version}). Tu área,{" "}
        <b className="font-semibold text-fg-2">{area(datos.mi_area.area)}</b>, puede usar:{" "}
        {datos.mi_area.herramientas.length ? datos.mi_area.herramientas.map(herramienta).join(", ") : "ninguna herramienta"}
        {datos.mi_area.aprueba_hitl ? ". Como nivel más alto del área, apruebas solicitudes HITL." : "."}
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse">
          <thead>
            <tr>
              <th className="border-b border-line px-3 py-[11px] text-left text-[12.5px] font-medium text-fg-3">Herramienta</th>
              {areas.map((a) => (
                <th
                  key={a}
                  className={`border-b border-line px-3 py-[11px] text-center text-[12.5px] font-medium ${
                    a === datos.mi_area.area ? "bg-brand-bg text-brand" : "text-fg-3"
                  }`}
                >
                  {area(a)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {herramientas.map(([nombre, h]) => (
              <tr key={nombre} className="[&:last-child>td]:border-b-0">
                <td className="border-b border-line px-3 py-[11px] text-left">
                  <span className="font-semibold">{herramienta(nombre)}</span>
                  <span className="ml-2 text-[12px] text-fg-3">riesgo {RIESGO[h.risk] ?? h.risk}</span>
                </td>
                {areas.map((a) => {
                  const accion = h.areas.includes(a) ? h.action : "none";
                  const texto = accion === "none" ? "Sin acceso" : ETIQUETA[accion];
                  return (
                    <td key={a} className={`border-b border-line px-3 py-[11px] text-center ${a === datos.mi_area.area ? "bg-brand-bg/50" : ""}`}>
                      <i className={`inline-block align-middle ${CELDA[accion]}`} title={`${herramienta(nombre)} · ${area(a)}: ${texto}`} />
                      <span className="sr-only">{texto}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel grid lg:grid-cols-3">
        <Seccion titulo="Restricciones">
          {herramientas
            .filter(([, h]) => h.args && Object.keys(h.args).length)
            .map(([nombre, h]) => (
              <Regla key={nombre} titulo={herramienta(nombre)}>
                {describirArgs(h.args!)}
              </Regla>
            ))}
          <Regla titulo={herramienta("admin_action")}>Bloqueada siempre, incluso para Tecnología.</Regla>
        </Seccion>
        <Seccion titulo="Quién aprueba">
          <Regla titulo="Nunca el solicitante">No hay autoaprobación: el core la rechaza aunque la pida un jefe.</Regla>
          <Regla titulo="Jefe del área">Solo el nivel más alto del área del solicitante decide.</Regla>
          {ultima && <Regla titulo={area(ultima)}>Aprobador de última instancia (también cuando quien pide es el jefe).</Regla>}
          <Regla titulo="Sin respuesta">Si nadie decide a tiempo, la solicitud se anula y la acción no se ejecuta.</Regla>
        </Seccion>
        <Seccion titulo="Entrada y áreas">
          {datos.verificador_entrada.habilitado && (
            <Regla titulo="Verificador de entrada">
              Rechaza antes del modelo los pedidos de {(datos.verificador_entrada.temas ?? []).map(tema).join(", ")} y avisa a{" "}
              {area(datos.verificador_entrada.notificar_area)}.
            </Regla>
          )}
          {datos.regla_entre_areas.habilitada && (
            <>
              <Regla titulo="Recurso de otra área">Se bloquea y se avisa al área dueña.</Regla>
              {alerta && (
                <Regla titulo="Intentos repetidos">
                  {alerta.intentos} en {alerta.ventana_minutos} minutos generan una alerta prioritaria a{" "}
                  {area(datos.regla_entre_areas.notificar_alerta)}.
                </Regla>
              )}
            </>
          )}
          {datos.organizacion.dominio_corporativo && (
            <Regla titulo="Dominio corporativo">
              <span className="font-mono text-[12.5px]">{datos.organizacion.dominio_corporativo}</span>
            </Regla>
          )}
        </Seccion>
      </div>
    </Vista>
  );
}

function describirArgs(args: Record<string, unknown>): string {
  const partes: string[] = [];
  if (typeof args.max_items_per_request === "number") {
    partes.push(args.max_items_per_request === 1 ? "Un pedido por solicitud." : `Máximo ${args.max_items_per_request} pedidos por solicitud.`);
  }
  if (Array.isArray(args.recipient_in)) {
    const nombres: Record<string, string> = { clientes_registrados: "clientes registrados", dominio_corporativo: "el dominio corporativo" };
    partes.push(`Solo a ${args.recipient_in.map((r) => nombres[String(r)] ?? String(r)).join(" o a ")}.`);
  }
  if (args.table_by_area && typeof args.table_by_area === "object") {
    partes.push(
      Object.entries(args.table_by_area as Record<string, string[]>)
        .map(([a, tablas]) => `${area(a)}: ${tablas.join(" y ")}`)
        .join(". ") + ".",
    );
  }
  return partes.join(" ");
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 border-b border-line px-[18px] py-4 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
      <h3 className="text-[13px] uppercase tracking-[.06em] text-brand">{titulo}</h3>
      <dl className="m-0 flex flex-col gap-2">{children}</dl>
    </section>
  );
}

function Regla({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-semibold">{titulo}</dt>
      <dd className="m-0">{children}</dd>
    </div>
  );
}
