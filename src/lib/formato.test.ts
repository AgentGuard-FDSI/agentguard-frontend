import { describe, expect, it } from "vitest";

import type { DecisionAG, ResumenCorrida } from "../api/tipos";
import { estadoDecision, objetivo, peorDecision, porcentaje } from "./formato";

const decision = (d: Partial<DecisionAG>): DecisionAG => ({
  herramienta: "actualizar_pedido",
  argumentos: {},
  decision: "HITL",
  regla: "accion_base",
  motivo: "",
  aprobado: null,
  aprobador: null,
  autorizada: false,
  ...d,
});

const corrida = (r: Partial<ResumenCorrida>): ResumenCorrida => ({
  verificador_entrada: [],
  decisiones_agentguard: [],
  avisos: [],
  herramientas_solicitadas: [],
  respuesta_final: "",
  efectos: [],
  ...r,
});

describe("objetivo", () => {
  it("muestra el pedido y el estado nuevo en español", () => {
    expect(objetivo({ order_id: "125", estado: "delivered" })).toEqual(["Pedido", "125, a entregado"]);
  });
  it("muestra el destinatario, la tabla o el comando", () => {
    expect(objetivo({ destinatario: "a@b.test", contenido: "x" })).toEqual(["Para", "a@b.test"]);
    expect(objetivo({ tabla: "clientes" })).toEqual(["Tabla", "clientes"]);
    expect(objetivo({ comando: "reiniciar" })).toEqual(["Comando", "reiniciar"]);
    expect(objetivo(undefined)).toEqual(["", ""]);
  });
});

describe("estadoDecision", () => {
  it("distingue el resultado de una aprobación humana", () => {
    expect(estadoDecision(decision({ aprobado: true, aprobador: "laura.atencion" }))).toBe("APPROVED");
    expect(estadoDecision(decision({ aprobado: false, aprobador: "laura.atencion" }))).toBe("REJECTED");
    expect(estadoDecision(decision({ aprobado: false, aprobador: "sin_respuesta" }))).toBe("ANULADA");
    expect(estadoDecision(decision({ decision: "BLOCK" }))).toBe("BLOCK");
  });
});

describe("peorDecision", () => {
  it("el rechazo de entrada gana a todo", () => {
    const r = corrida({ verificador_entrada: [{ accion: "REJECT", temas: [], reglas: [], motivo: "", notificado: true }] });
    expect(peorDecision(r)).toBe("REJECT");
  });
  it("BLOCK gana a ALLOW", () => {
    const r = corrida({ decisiones_agentguard: [decision({ decision: "ALLOW" }), decision({ decision: "BLOCK" })] });
    expect(peorDecision(r)).toBe("BLOCK");
  });
  it("un HITL muestra cómo terminó la aprobación", () => {
    const aprobada = corrida({ decisiones_agentguard: [decision({ aprobado: true, aprobador: "laura.atencion" })] });
    expect(peorDecision(aprobada)).toBe("APPROVED");
    expect(peorDecision(corrida({ decisiones_agentguard: [decision({})] }))).toBe("HITL");
  });
  it("sin acciones no hay etiqueta", () => {
    expect(peorDecision(corrida({}))).toBeNull();
    expect(peorDecision(null)).toBeNull();
  });
});

describe("porcentaje", () => {
  it("redondea y marca n/a", () => {
    expect(porcentaje(1)).toBe("100 %");
    expect(porcentaje(0.333)).toBe("33 %");
    expect(porcentaje(null)).toBe("n/a");
  });
});
