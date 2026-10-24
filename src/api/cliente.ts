/* Cliente de la API. El token de sesión vive en sessionStorage: es por pestaña (sirve para probar
   la aprobación HITL con dos usuarios en dos pestañas) y se borra al cerrarla. */

const BASE = String(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const CLAVE_TOKEN = "agentguard.token";

export class ApiError extends Error {
  constructor(
    public status: number,
    mensaje: string,
    public detalle?: unknown,
  ) {
    super(mensaje);
    this.name = "ApiError";
  }

  /** Código de la regla que devolvió el core (p. ej. "autoaprobacion"), si lo hay. */
  get regla(): string | undefined {
    const d = this.detalle as { regla?: string } | undefined;
    return typeof d === "object" && d ? d.regla : undefined;
  }
}

function leerToken(): string | null {
  try {
    return sessionStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

let token: string | null = leerToken();
let alVencerse: (() => void) | null = null;

export function guardarToken(nuevo: string | null): void {
  token = nuevo;
  try {
    if (nuevo) sessionStorage.setItem(CLAVE_TOKEN, nuevo);
    else sessionStorage.removeItem(CLAVE_TOKEN);
  } catch {
    /* sin almacenamiento: la sesión dura lo que la página */
  }
}

export function hayToken(): boolean {
  return token !== null;
}

/** Se llama cuando la API responde 401 a una petición con token (sesión vencida o API reiniciada). */
export function alVencerseLaSesion(fn: (() => void) | null): void {
  alVencerse = fn;
}

function mensajeDe(status: number, detalle: unknown): string {
  if (typeof detalle === "string") return detalle;
  if (detalle && typeof detalle === "object" && "motivo" in detalle) return String((detalle as { motivo: string }).motivo);
  if (Array.isArray(detalle)) return "La petición no es válida.";
  return `Error ${status} de la API.`;
}

export async function api<T>(ruta: string, opciones: { metodo?: "GET" | "POST"; cuerpo?: unknown } = {}): Promise<T> {
  const { metodo = "GET", cuerpo } = opciones;
  const cabeceras: Record<string, string> = {};
  if (cuerpo !== undefined) cabeceras["Content-Type"] = "application/json";
  if (token) cabeceras.Authorization = `Bearer ${token}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE}/api${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ApiError(0, "No se pudo conectar con la API. Revisa que esté corriendo (python -m andimarket.api).");
  }

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const detalle = datos?.detail;
    if (respuesta.status === 401 && token && ruta !== "/login") {
      guardarToken(null);
      alVencerse?.();
    }
    throw new ApiError(respuesta.status, mensajeDe(respuesta.status, detalle), detalle);
  }
  return datos as T;
}
