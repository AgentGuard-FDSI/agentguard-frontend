# Guía por rol

Qué ve y qué puede hacer cada persona en la interfaz. El área y el nivel salen de la sesión; los usuarios de
demostración están en `andimarket/directorio.py` de `agentguard-andimarket`.

| Rol | Qué hace en la demo |
|---|---|
| **Empleado** | Usa el asistente. Lo permitido se ejecuta, lo no autorizado se bloquea y las acciones de riesgo medio o alto quedan esperando a un jefe. Puede ver sus propias solicitudes. |
| **Jefe de área** | Además de lo anterior, aprueba o rechaza las solicitudes de su área en Aprobaciones. No puede aprobar lo propio. |
| **Gerencia** | Aprobador de última instancia: ve las solicitudes de otras áreas y el comparativo A/B. No tiene herramientas operativas. |
| **Tecnología** | Recibe las alertas de seguridad (acceso entre áreas, intentos repetidos) y puede verificar la integridad del registro. |

## Pantallas por rol

- **Asistente:** todos.
- **Aprobaciones:** quien aprueba (jefes y Gerencia) ve «por aprobar»; todos ven «mis solicitudes» e historial.
- **Seguridad:** cada persona ve su actividad y los avisos dirigidos a su área.
- **Comparación A / B:** muestra un escenario en ambas configuraciones y los resultados del experimento guardado.
- **Políticas:** la matriz de herramientas por área, en solo lectura.

## Recorrido sugerido de la demostración

1. Como empleado de atención al cliente, pide una consulta de pedido: se permite.
2. Pide algo no autorizado (por ejemplo, eliminar un pedido): se bloquea y la pantalla muestra el motivo.
3. Pide actualizar un pedido: queda esperando la aprobación del jefe de área.
4. En otra pestaña, entra como el jefe y aprueba o rechaza. El mensaje de la primera pestaña termina solo.
5. En Seguridad, verifica la cadena de auditoría y revisa las alertas.
6. En Comparación A / B, ve el mismo escenario sin control y con AgentGuard.

El detalle de la aprobación humana está en el [README](../README.md#demostración-de-la-aprobación-humana-hitl).
