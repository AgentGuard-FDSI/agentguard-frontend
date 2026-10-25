import { useState, type FormEvent } from "react";

import { ApiError } from "../api/cliente";
import logoGrande from "../assets/logo_big.webp";
import { Wordmark } from "../components/comunes";
import { useSesion } from "../sesion";

/** Inicio de sesión. Los usuarios no se listan: la persona escribe el suyo (nombre.area). */
export default function Login() {
  const { entrar, vencida } = useSesion();
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(vencida ? "Tu sesión venció. Vuelve a iniciar sesión." : null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!usuario.trim() || !clave) {
      setError("Escribe tu usuario y tu contraseña.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await entrar(usuario.trim(), clave);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Usuario o contraseña incorrectos." : (err as Error).message);
      setClave("");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid h-full overflow-auto bg-bg md:grid-cols-2">
      <div className="grid place-items-center bg-[radial-gradient(70%_70%_at_50%_50%,#4a56a0_0%,#3E498C_55%,#2c3470_100%)] px-4 pb-0 pt-6 md:p-8">
        <img
          src={logoGrande}
          alt="Logo de AgentGuard"
          className="w-[min(240px,60%)] drop-shadow-[0_10px_40px_rgba(0,0,0,.25)] [mask-image:radial-gradient(circle_at_50%_50%,#000_48%,transparent_70%)] md:w-[min(520px,90%)]"
        />
      </div>
      <div className="flex items-center justify-center px-4 py-10">
        <form onSubmit={enviar} noValidate className="flex w-full max-w-[380px] flex-col gap-4 rounded-2xl border border-line bg-surface p-7 shadow-panel">
          <div>
            <Wordmark className="text-[26px]" />
            <div className="text-[13px] text-fg-3">ANDIMARKET S.A.S.</div>
          </div>
          <h2>Iniciar sesión</h2>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] text-fg-2">Usuario</span>
            <input
              className="input"
              autoComplete="username"
              placeholder="nombre.area"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] text-fg-2">Contraseña</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
            />
          </label>
          {error && (
            <div role="alert" className="text-[12.5px] text-block">
              {error}
            </div>
          )}
          <button className="btn btn-primary" type="submit" disabled={enviando}>
            {enviando ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
