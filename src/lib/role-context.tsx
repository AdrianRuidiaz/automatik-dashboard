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

interface RoleContextValue {
  rol: RolUsuario | null;
  usuario: Usuario | null;
  listo: boolean;
  signOut: () => Promise<void>;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [rol, setRol] = useState<RolUsuario | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [listo, setListo] = useState(false);

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
        setRol(null);
        setUsuario(null);
        setListo(true);
        return;
      }

      // super_admin usa la misma UI que admin; el permiso extra vive en el rol real.
      const rolNormalizado = data.rol === "super_admin" ? "admin" : (data.rol as RolUsuario);
      setRol(rolNormalizado);
      setUsuario({ id: userId, nombre: data.nombre || email, email: data.email || email });
      setListo(true);
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!activo) return;
      if (data.user) {
        cargarPerfil(data.user.id, data.user.email || "");
      } else {
        setRol(null);
        setUsuario(null);
        setListo(true);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!activo) return;
      if (session?.user) {
        cargarPerfil(session.user.id, session.user.email || "");
      } else {
        setRol(null);
        setUsuario(null);
        setListo(true);
      }
    });

    return () => {
      activo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setRol(null);
    setUsuario(null);
    router.push("/login");
    router.refresh();
  };

  return (
    <RoleContext.Provider value={{ rol, usuario, listo, signOut }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole debe usarse dentro de RoleProvider");
  return ctx;
}
