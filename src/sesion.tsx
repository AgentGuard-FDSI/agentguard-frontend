import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { alVencerseLaSesion, api, guardarToken, hayToken } from "./api/cliente";
import type { Perfil } from "./api/tipos";

interface Sesion {
  perfil: Perfil | null;
  restaurando: boolean;
  vencida: boolean;
  entrar: (usuario: string, clave: string) => Promise<void>;
  salir: () => Promise<void>;
}

const ContextoSesion = createContext<Sesion | null>(null);

/** Sesión de la persona: login con la API, perfil (/me) y cierre. La identidad la pone la API. */
export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [restaurando, setRestaurando] = useState(hayToken());
  const [vencida, setVencida] = useState(false);

  useEffect(() => {
    alVencerseLaSesion(() => {
      setPerfil(null);
      setVencida(true);
    });
    if (hayToken()) {
      api<Perfil>("/me")
        .then(setPerfil)
        .catch(() => guardarToken(null))
        .finally(() => setRestaurando(false));
    }
    return () => alVencerseLaSesion(null);
  }, []);

  const entrar = useCallback(async (usuario: string, clave: string) => {
    const r = await api<{ token: string; usuario: Perfil }>("/login", { metodo: "POST", cuerpo: { usuario, clave } });
    guardarToken(r.token);
    setVencida(false);
    setPerfil(r.usuario);
  }, []);

  const salir = useCallback(async () => {
    try {
      await api("/logout", { metodo: "POST" });
    } catch {
      /* si la API no responde, igual se cierra en el navegador */
    }
    guardarToken(null);
    setPerfil(null);
  }, []);

  return (
    <ContextoSesion.Provider value={{ perfil, restaurando, vencida, entrar, salir }}>{children}</ContextoSesion.Provider>
  );
}

export function useSesion(): Sesion {
  const s = useContext(ContextoSesion);
  if (!s) throw new Error("useSesion fuera de ProveedorSesion");
  return s;
}

/** El perfil de quien inició sesión (solo dentro de la aplicación, ya autenticada). */
export function usePerfil(): Perfil {
  const { perfil } = useSesion();
  if (!perfil) throw new Error("usePerfil sin sesión");
  return perfil;
}
