/** Paleta del equipo: blanco base #FFFFF9, cian #A0FEF8, índigo #3E498C, lavanda #CEC4FF, ciruela #90467E.
 *  Los colores de estado (permitido, bloqueado, aprobación, rechazo) son los del mockup aprobado. */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#FFFFF9",
        surface: { DEFAULT: "#FFFFFF", 2: "#F5F2FF" },
        line: { DEFAULT: "#E9E6F4", 2: "#D9D2FA" },
        fg: { DEFAULT: "#262D5C", 2: "#555D8A", 3: "#8A8FAE" },
        brand: { DEFAULT: "#3E498C", hover: "#4C58A3", 2: "#90467E", bg: "#EEEBFF" },
        cyan: "#A0FEF8",
        lav: "#CEC4FF",
        allow: { DEFAULT: "#157A60", dot: "#2DBF97", bg: "#E4FCF8", bd: "#B5F1E6" },
        block: { DEFAULT: "#B23A5E", dot: "#D9567B", bg: "#FCEDF2", bd: "#F2C9D6" },
        hitl: { DEFAULT: "#9A6512", dot: "#E2A447", bg: "#FFF5E2", bd: "#F3DDB0" },
        reject: { DEFAULT: "#90467E", dot: "#A85A95", bg: "#F6EAF3", bd: "#E5C8DC" },
        nocontrol: { DEFAULT: "#B5532B", bg: "#FDF0E8", bd: "#F2CDB9" },
      },
      fontFamily: {
        sans: ["Aptos", "Aptos Display", "Segoe UI Variable Text", "Segoe UI", "system-ui", "sans-serif"],
        brand: ["Chakra Petch", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "Cascadia Mono", "Consolas", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(38,45,92,.05), 0 4px 14px rgba(38,45,92,.05)",
        toast: "0 10px 30px rgba(38,45,92,.18)",
      },
    },
  },
  plugins: [],
};
