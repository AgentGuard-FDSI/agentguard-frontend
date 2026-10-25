import { useEffect, useRef } from "react";

/** Llama `fn` cada `ms` milisegundos mientras `activo` sea verdadero (y una vez al activarse). */
export function useIntervalo(fn: () => void, ms: number, activo = true): void {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!activo) return;
    ref.current();
    const id = window.setInterval(() => ref.current(), ms);
    return () => window.clearInterval(id);
  }, [ms, activo]);
}
