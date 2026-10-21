import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { ProveedorToast } from "./components/Toast";
import "./index.css";
import { ProveedorSesion } from "./sesion";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ProveedorToast>
      <ProveedorSesion>
        <App />
      </ProveedorSesion>
    </ProveedorToast>
  </StrictMode>,
);
