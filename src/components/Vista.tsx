import type { ReactNode } from "react";

/** Contenedor de cada pestaña (mismo ancho y márgenes que el mockup). */
export function Vista({ children, alto = false }: { children: ReactNode; alto?: boolean }) {
  return (
    <section
      className={`mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-4 pb-10 pt-[22px] md:px-6 ${
        alto ? "lg:h-full lg:pb-5" : ""
      }`}
    >
      {children}
    </section>
  );
}
