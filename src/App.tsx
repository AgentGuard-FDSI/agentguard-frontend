import { useEffect, useState } from "react";

import { api } from "./api/cliente";
import type { Aprobaciones as DatosAprobaciones } from "./api/tipos";
import { BarraSuperior, VISTAS, type IdVista } from "./components/BarraSuperior";
import { Cargando } from "./components/comunes";
import { useIntervalo } from "./lib/useIntervalo";
import { useSesion } from "./sesion";
import Aprobaciones from "./vistas/Aprobaciones";
import Asistente from "./vistas/Asistente";
import Comparacion from "./vistas/Comparacion";
import Login from "./vistas/Login";
import Politicas from "./vistas/Politicas";
import Seguridad from "./vistas/Seguridad";

/** La pestaña activa vive en el hash (#asistente, #aprobaciones, ...) para que recargar no la pierda. */
function vistaDelHash(): IdVista {
  const id = window.location.hash.replace("#", "") as IdVista;
  return VISTAS.some((v) => v.id === id) ? id : "asistente";
}

export default function App() {
  const { perfil, restaurando } = useSesion();
  const [vista, setVista] = useState<IdVista>(vistaDelHash);
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    const alCambiar = () => setVista(vistaDelHash());
    window.addEventListener("hashchange", alCambiar);
    return () => window.removeEventListener("hashchange", alCambiar);
  }, []);

  // Contador de la pestaña Aprobaciones (solo para quien puede aprobar).
  useIntervalo(
    () => {
      api<DatosAprobaciones>("/aprobaciones")
        .then((d) => setPendientes(d.pendientes.length))
        .catch(() => {});
    },
    5000,
    Boolean(perfil?.aprueba_hitl),
  );

  if (restaurando) return <Cargando texto="Recuperando la sesión…" />;
  if (!perfil) return <Login />;

  const ir = (id: IdVista) => {
    window.location.hash = id;
    setVista(id);
  };

  return (
    <div className="flex h-full flex-col">
      <BarraSuperior vista={vista} onIr={ir} pendientes={pendientes} />
      <main className="min-h-0 flex-1 overflow-auto" id="contenido">
        {vista === "asistente" && <Asistente onIr={ir} />}
        {vista === "comparacion" && <Comparacion />}
        {vista === "aprobaciones" && <Aprobaciones onCambio={setPendientes} />}
        {vista === "seguridad" && <Seguridad />}
        {vista === "politicas" && <Politicas />}
      </main>
    </div>
  );
}
