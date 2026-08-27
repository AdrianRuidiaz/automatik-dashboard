"use client";

import { useCallback, useEffect, useState } from "react";

export type Tema = "dark" | "light";

const STORAGE_KEY = "atmk_tema";

export function obtenerTemaGuardado(): Tema {
  if (typeof window === "undefined") return "dark";
  const guardado = window.localStorage.getItem(STORAGE_KEY);
  return guardado === "light" ? "light" : "dark";
}

export function aplicarTema(tema: Tema) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("light", tema === "light");
  window.localStorage.setItem(STORAGE_KEY, tema);
}

// Script inline para <head>: corre antes del primer paint (bloqueante,
// como cualquier <script> sin defer/async en <head>) asi que agrega la
// clase .light antes de que el navegador pinte el primer frame -- evita el
// flash de tema oscuro por defecto seguido de un salto a claro una vez que
// React hidrata. Se inyecta via dangerouslySetInnerHTML en layout.tsx
// porque layout.tsx es un server component y no puede leer localStorage el
// mismo (eso solo existe en el navegador).
export const TEMA_INLINE_SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem("${STORAGE_KEY}");
    if (t === "light") document.documentElement.classList.add("light");
  } catch (e) {}
})();
`;

// Hook para leer/cambiar el tema desde un componente cliente (ej. el
// selector en Configuracion > Apariencia). El estado inicial es "dark" en
// el primer render (para que coincida con el HTML servido por el server,
// que nunca sabe el tema real) y se corrige en el primer useEffect,
// leyendo lo que el script inline de layout.tsx ya aplico al <html>.
export function useTema() {
  const [tema, setTemaState] = useState<Tema>("dark");

  useEffect(() => {
    // Correccion post-mount intencional (ver comentario arriba): el estado
    // inicial debe ser "dark" en el primer render para coincidir con el HTML
    // del server, y recien aca se ajusta al valor real que el script inline
    // ya aplico.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTemaState(document.documentElement.classList.contains("light") ? "light" : "dark");
  }, []);

  const setTema = useCallback((nuevo: Tema) => {
    aplicarTema(nuevo);
    setTemaState(nuevo);
  }, []);

  return { tema, setTema };
}
