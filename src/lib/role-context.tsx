"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { RolUsuario } from "@/lib/types";

interface Usuario {
  id: string;
  nombre: string;
  email: string;
}

const VISTA_KEY = "automatik:vista_super_admin";

interface RoleContextValue {
  /** Rol efectivo para decidir que UI mostrar. Para super_admin, es la vista elegida (setVista). */
  rol: RolUsuario | null;
  /** Rol real tal cual esta en la base (incluye "super_admin"), sin normalizar. */
  rolReal: string | null;
  /** true si el usuario es super_admin: puede ver las 3 vistas para seguir desarrollando/probando. */
  esSuperAdmin: boolean;
  usuario: Usuario | null;
  listo: boolean;
  signOut: () => Promise<void>;
  /** Cambia que vista ve el super_admin. No hace nada para el resto de roles. */
  setVista: (r: RolUsuario) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [rolReal, setRolReal] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [listo, setListo] = useState(false);
  const [vista, setVistaState] = useState<RolUsuario>("admin");

  // Restaurar la vista elegida por el super_admin (solo afecta a super_admin).
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(VISTA_KEY);
      if (guardado === "admin" || guardado === "vendedor" || guardado === "empacador") {
        setVistaState(guardado);
      }
    } catch {}
  }, []);

  useEffect(() => {
    let activo = true;

    async function cargarPerfil(userId: string, email: string) {
      const { data } = await supabase
        .from("usuarios_roles")
        .select("rol, nombre, email")
        .eq("auth_user_id", userId)
        .eq("activo", true)
        .maybeSingle();

      if (!activo) return;

      if (!data) {
        setRolReal(null);
        setUsuario(null);
        setListo(true);
        return;
      }

      setRolReal(data.rol as string);
      setUsuario({ id: userId, nombre: data.nombre || email, email: data.email || email });
      setListo(true);
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!activo) return;
      if (data.user) {
        cargarPerfil(data.user.id, data.user.email || "");
      } else {
        setRolReal(null);
        setUsuario(null);
        setListo(true);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!activo) return;
      if (session?.user) {
        cargarPerfil(session.user.id, session.user.email || "");
      } else {
        setRolReal(null);
        setUsuario(null);
        setListo(true);
      }
    });

    return () => {
      activo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const esSuperAdmin = rolReal === "super_admin";

  // super_admin: puede navegar cualquiera de las 3 vistas (para seguir
  // desarrollando/probando el producto). Los demas roles siempre ven lo suyo.
  const rol: RolUsuario | null = esSuperAdmin
    ? vista
    : rolReal === "admin" || rolReal === "vendedor" || rolReal === "empacador"
      ? rolReal
      : null;

  const setVista = (r: RolUsuario) => {
    setVistaState(r);
    try { window.localStorage.setItem(VISTA_KEY, r); } catch {}
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRolReal(null);
    setUsuario(null);
    router.push("/login");
    router.refresh();
  };

  return (
    <RoleContext.Provider value={{ rol, rolReal, esSuperAdmin, usuario, listo, signOut, setVista }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole debe usarse dentro de RoleProvider");
  return ctx;
}
