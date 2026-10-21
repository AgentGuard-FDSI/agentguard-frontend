import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type Tono = "normal" | "error";
const ContextoToast = createContext<(texto: string, tono?: Tono) => void>(() => {});

/** Avisos breves abajo a la derecha (y anunciados a lectores de pantalla). */
export function ProveedorToast({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<{ texto: string; tono: Tono } | null>(null);
  const temporizador = useRef<number>();

  const mostrar = useCallback((texto: string, tono: Tono = "normal") => {
    setAviso({ texto, tono });
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => setAviso(null), tono === "error" ? 5000 : 3200);
  }, []);

  return (
    <ContextoToast.Provider value={mostrar}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-5 right-5 z-30 max-w-[360px]">
        {aviso && (
          <div
            className={`rounded-lg border px-3.5 py-2.5 text-[13px] shadow-toast ${
              aviso.tono === "error" ? "border-block-bd bg-block-bg text-block" : "border-line-2 bg-surface-2 text-fg"
            }`}
          >
            {aviso.texto}
          </div>
        )}
      </div>
    </ContextoToast.Provider>
  );
}

export const useToast = () => useContext(ContextoToast);
