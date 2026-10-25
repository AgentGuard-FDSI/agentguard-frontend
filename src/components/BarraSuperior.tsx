import logoPequeno from "../assets/logo_sm.webp";
import { area, iniciales, nivel } from "../lib/formato";
import { usePerfil, useSesion } from "../sesion";
import { Wordmark } from "./comunes";

export const VISTAS = [
  { id: "asistente", nombre: "Asistente" },
  { id: "comparacion", nombre: "Comparación A / B" },
  { id: "aprobaciones", nombre: "Aprobaciones" },
  { id: "seguridad", nombre: "Seguridad" },
  { id: "politicas", nombre: "Políticas" },
] as const;

export type IdVista = (typeof VISTAS)[number]["id"];

export function BarraSuperior({
  vista,
  onIr,
  pendientes,
}: {
  vista: IdVista;
  onIr: (id: IdVista) => void;
  pendientes: number;
}) {
  const perfil = usePerfil();
  const { salir } = useSesion();

  return (
    <header className="z-10 flex-none border-b border-line bg-surface">
      <div className="flex min-h-[60px] flex-wrap items-center gap-x-5 gap-y-2 px-4 md:flex-nowrap md:px-6">
        <div className="flex flex-none items-center gap-[9px] py-2">
          <img src={logoPequeno} alt="" className="h-[34px] w-[34px] object-contain" />
          <Wordmark className="text-[16px]" />
        </div>

        <nav
          aria-label="Secciones"
          className="order-3 -mx-1 flex min-h-[44px] w-full gap-0.5 self-stretch overflow-x-auto [scrollbar-width:none] md:order-none md:mx-0 md:w-auto"
        >
          {VISTAS.map((v) => {
            const activa = v.id === vista;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onIr(v.id)}
                aria-current={activa ? "page" : undefined}
                className={`relative flex items-center gap-[7px] whitespace-nowrap px-3 ${
                  activa
                    ? "font-semibold text-brand after:absolute after:inset-x-2.5 after:bottom-0 after:h-[3px] after:rounded-t-[3px] after:bg-brand"
                    : "text-fg-2 hover:text-fg"
                }`}
              >
                {v.nombre}
                {v.id === "aprobaciones" && pendientes > 0 && (
                  <span className="rounded-full bg-brand-2 px-[7px] text-[11px] font-semibold text-bg">{pendientes}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex flex-none items-center gap-3">
          <div className="hidden text-right leading-tight md:block">
            <b className="block text-[13px] font-semibold">{perfil.usuario}</b>
            <small className="text-[12px] text-fg-3">
              {area(perfil.area)} · {nivel(perfil.nivel)}
            </small>
          </div>
          <div className="grid h-8 w-8 place-items-center rounded-full bg-lav font-bold text-brand" aria-hidden>
            {iniciales(perfil.usuario)}
          </div>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => void salir()}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  );
}
