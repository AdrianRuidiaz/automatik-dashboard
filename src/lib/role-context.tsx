"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { RolUsuario } from "@/lib/types";

const STORAGE_KEY = "automatik:rol";

interface RoleContextValue {
  rol: RolUsuario;
  setRol: (r: RolUsuario) => void;
  listo: boolean;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [rol, setRolState] = useState<RolUsuario>("admin");
  const [listo, setListo] = useState(false);

  // Restaurar el rol elegido al cargar
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(STORAGE_KEY);
      if (guardado === "admin" || guardado === "vendedor" || guardado === "empacador") {
        setRolState(guardado);
      }
    } catch {}
    setListo(true);
  }, []);

  const setRol = (r: RolUsuario) => {
    setRolState(r);
    try { window.localStorage.setItem(STORAGE_KEY, r); } catch {}
  };

  return (
    <RoleContext.Provider value={{ rol, setRol, listo }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole debe usarse dentro de RoleProvider");
  return ctx;
}
