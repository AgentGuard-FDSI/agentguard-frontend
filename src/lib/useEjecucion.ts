import { useEffect, useRef, useState } from "react";

import { api, ApiError } from "../api/cliente";
import type { Ejecucion, Evento } from "../api/tipos";
import { useIntervalo } from "./useIntervalo";

const ACTIVOS = new Set(["en_curso", "esperando_aprobacion"]);

/** Polling de una ejecución: pide solo los eventos nuevos (?desde=N) hasta que termina. */
export function useEjecucion<R>(id: string | null, ms = 1000, inicial?: Ejecucion<R> | null) {
  const [ejecucion, setEjecucion] = useState<Ejecucion<R> | null>(inicial ?? null);
  const [error, setError] = useState<string | null>(null);
  const eventos = useRef<Evento[]>(inicial?.eventos ?? []);
  const ultimo = useRef(inicial?.ultimo_evento ?? 0);
  const ocupado = useRef(false);

  useEffect(() => {
    eventos.current = inicial?.eventos ?? [];
    ultimo.current = inicial?.ultimo_evento ?? 0;
    setEjecucion(inicial ?? null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const activa = id !== null && error === null && (ejecucion === null || ACTIVOS.has(ejecucion.estado));

  useIntervalo(
    async () => {
      if (!id || ocupado.current) return;
      ocupado.current = true;
      try {
        const datos = await api<Ejecucion<R>>(`/ejecuciones/${id}?desde=${ultimo.current}`);
        eventos.current = [...eventos.current, ...datos.eventos];
        ultimo.current = datos.ultimo_evento;
        setEjecucion({ ...datos, eventos: eventos.current });
      } catch (e) {
        setError(e instanceof ApiError && e.status === 404 ? "La ejecución ya no existe (¿se reinició la API?)." : String((e as Error).message));
      } finally {
        ocupado.current = false;
      }
    },
    ms,
    activa,
  );

  return { ejecucion, error, activa };
}
