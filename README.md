# agentguard-frontend

La interfaz web del proyecto AgentGuard. Consume la API de
[`agentguard-andimarket`](https://github.com/AgentGuard-FDSI/agentguard-andimarket) (`python -m andimarket.api`)
para mostrar el agente de ANDIMARKET con AgentGuard (Config. B) y compararlo, lado a lado, con el mismo
agente sin control (Config. A).

React, TypeScript, Vite y Tailwind. Sigue el mockup aprobado en el Avance 3 (paleta del equipo y tipografía
Aptos, con Segoe UI como respaldo donde Aptos no está instalada).

## Pantallas

| Pestaña | Qué muestra |
|---|---|
| Inicio de sesión | Usuario y contraseña de la demostración. Los usuarios no se listan en pantalla. |
| Asistente | Chat con el agente en la Config. B. Cada acción aparece con su decisión (permitido, bloqueado, aprobación, rechazado en la entrada) y lo que pasó en la base. La traza se abre como una pestaña con la línea de tiempo del agente, AgentGuard y la aprobación. Si una acción requiere aprobación, el mensaje queda esperando y muestra quién la decide y cuánto tiempo queda. |
| Comparación A / B | Un escenario en la Config. A y en la Config. B, con lo que hizo cada una, el veredicto del criterio de éxito y la capa que contuvo el ataque. Abajo, los resultados del experimento guardado en `evidencia/` (todos los escenarios, varias repeticiones, con un modelo real): tasa de acciones no autorizadas, contención, falsos positivos, fricción y latencia (sección 4.2 de la propuesta). Solo se muestran experimentos corridos con el código del Avance 3 (`python -m andimarket.comparar`); los anteriores no reflejan el verificador de entrada. |
| Aprobaciones | Por aprobar (solo jefes y Gerencia), mis solicitudes e historial. La separación de funciones la valida el core: si alguien intenta aprobar lo suyo, se muestra el motivo. |
| Seguridad | Conteo de decisiones, integridad del registro encadenado (botón Verificar), registro de auditoría con hash y alertas. Cada persona ve lo suyo y los avisos dirigidos a su área. |
| Políticas | `policies.yaml` en solo lectura: matriz de herramientas por área y las reglas. |

## Puesta en marcha (Windows)

Requisitos: [Node.js](https://nodejs.org/) 20 o superior (`node -v`) y la API corriendo.

1. En `agentguard-andimarket`, arranca la API:

        set ANDIMARKET_CLAVE_DEMO=demo2026
        python -m andimarket.api

2. En este repositorio:

        npm install
        npm run dev

3. Abre http://localhost:5173 e inicia sesión con un usuario de `andimarket/directorio.py` y la clave
   de `ANDIMARKET_CLAVE_DEMO`.

En desarrollo, Vite reenvía `/api` a `http://127.0.0.1:8000`, así que no hace falta configurar CORS. Para
otra dirección, copia `.env.example` a `.env` y cambia `VITE_API_PROXY`.

## Demostración de la aprobación humana (HITL)

La sesión se guarda por pestaña (`sessionStorage`), así que se pueden tener dos personas a la vez:

1. Pestaña 1: entra como `ana.atencion` y usa el ejemplo "Actualiza el pedido 125 a entregado". El mensaje
   queda esperando la aprobación de `laura.atencion`.
2. Pestaña 2 (o ventana privada): entra como `laura.atencion`, ve a Aprobaciones y aprueba o rechaza.
3. En la pestaña 1, el mensaje termina solo: con la aprobación, la base muestra la actualización del
   pedido 125; con el rechazo, no se ejecuta nada.

Si `ana.atencion` intenta aprobar su propia solicitud, o lo intenta el jefe de otra área, el core lo rechaza
y la pantalla muestra el motivo. Si nadie responde a tiempo (120 s por defecto, `--espera-hitl` en la API),
la solicitud se anula.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en http://localhost:5173 |
| `npm run build` | Revisa los tipos y genera `dist/` |
| `npm run preview` | Sirve `dist/` en http://localhost:4173 (también con el proxy a la API) |
| `npm test` | Pruebas unitarias (Vitest) |

## Estructura

    src/
      api/          cliente de la API (token por pestaña) y tipos de las respuestas
      components/   barra superior, etiquetas de estado, acciones, traza, avisos
      lib/          textos y formatos, redacción en lenguaje natural (narrativa.ts), polling
      vistas/       Login, Asistente, Comparacion, Aprobaciones, Seguridad, Politicas
      sesion.tsx    inicio y cierre de sesión

Con el modelo de guion y el simulado, la respuesta que se muestra se redacta con lo que de verdad pasó
(resultados de las herramientas, decisiones de AgentGuard y aprobaciones), no con el texto del modelo; así A y
B dicen cosas distintas cuando hacen cosas distintas. Con un modelo real se muestra su texto.

El chat usa polling: `POST /api/chat` devuelve el id de la ejecución y la pantalla pide
`GET /api/ejecuciones/{id}?desde=N` cada segundo hasta que termina.
