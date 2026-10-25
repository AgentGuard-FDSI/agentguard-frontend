import type { ReactNode } from "react";

import { ETIQUETA, herramienta, type Estado } from "../lib/formato";
import { frase } from "../lib/narrativa";

const ESTILO: Record<Estado, string> = {
  ALLOW: "text-allow bg-allow-bg border-allow-bd",
  APPROVED: "text-allow bg-allow-bg border-allow-bd",
  BLOCK: "text-block bg-block-bg border-block-bd",
  REJECTED: "text-block bg-block-bg border-block-bd",
  HITL: "text-hitl bg-hitl-bg border-hitl-bd",
  PENDING: "text-hitl bg-hitl-bg border-hitl-bd",
  REJECT: "text-reject bg-reject-bg border-reject-bd",
  EJEC: "text-nocontrol bg-nocontrol-bg border-nocontrol-bd",
  FALLO: "text-fg-3 bg-bg border-line-2",
  ANULADA: "text-fg-3 bg-bg border-line-2",
};

export function Badge({ estado, texto, className = "" }: { estado: Estado; texto?: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-[9px] py-0.5 text-[11.5px] font-semibold ${ESTILO[estado]} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {texto ?? ETIQUETA[estado]}
    </span>
  );
}

const PUNTO: Record<string, string> = {
  ALLOW: "bg-allow-dot shadow-[0_0_0_3px_theme(colors.allow.bg)]",
  APPROVED: "bg-allow-dot shadow-[0_0_0_3px_theme(colors.allow.bg)]",
  BLOCK: "bg-block-dot shadow-[0_0_0_3px_theme(colors.block.bg)]",
  REJECTED: "bg-block-dot shadow-[0_0_0_3px_theme(colors.block.bg)]",
  HITL: "bg-hitl-dot shadow-[0_0_0_3px_theme(colors.hitl.bg)]",
  REJECT: "bg-reject-dot shadow-[0_0_0_3px_theme(colors.reject.bg)]",
  ANULADA: "bg-line-2",
};

export function Punto({ estado }: { estado: string }) {
  return <span className={`dot ${PUNTO[estado] ?? "bg-line-2"}`} aria-hidden />;
}

/** Una acción del agente: estado + herramienta + sobre qué, en una pastilla. */
export function Accion({
  estado,
  tool,
  args,
  titulo,
  texto,
}: {
  estado: Estado;
  tool?: string;
  args?: Record<string, unknown>;
  titulo?: string;
  texto?: string;
}) {
  return (
    <span
      title={titulo}
      className="inline-flex max-w-full items-center gap-[7px] rounded-full border border-line bg-surface py-[3px] pl-1 pr-2.5 text-[12.5px]"
    >
      <Badge estado={estado} className="!px-2 !py-px" />
      <span className="truncate">
        {texto ?? (tool ? (args ? frase(tool, args) : herramienta(tool)) : "")}
      </span>
    </span>
  );
}

export function Vacio({ titulo, children }: { titulo?: string; children?: ReactNode }) {
  return (
    <div className="grid place-items-center gap-1 px-4 py-7 text-center text-fg-3">
      {titulo && <b className="font-semibold text-fg-2">{titulo}</b>}
      {children && <span>{children}</span>}
    </div>
  );
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return <div className="px-4 py-7 text-center text-fg-3">{texto}</div>;
}

export function AvisoError({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-block-bd bg-block-bg px-3 py-2 text-[13px] text-block">{children}</div>;
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`wordmark ${className}`}>
      AGENT<span>GUARD</span>
    </span>
  );
}

export function Encabezado({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1>{titulo}</h1>
      {children}
    </div>
  );
}
