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

interface ClienteOption {
  id: string;
  nombre: string;
}

const VISTA_KEY = "automatik:vista_super_admin";
const CLIENTE_KEY = "automatik:cliente_activo_super_admin";

interface RoleContextValue {
  /** Rol efectivo para decidir que UI mostrar. Para super_admin, es la vista elegida (setVista). */
  rol: RolUsuario | null;
  /** Rol real tal cual esta en la base (incluye "super_admin"), sin normalizar. */
  rolReal: string | null;
  /** true si el usuario es super_admin: puede ver las 3 vistas y dar soporte a cualquier cliente. */
  esSuperAdmin: boolean;
  usuario: Usuario | null;
  listo: boolean;
  signOut: () => Promise<void>;
  /** Cambia que vista ve el super_admin. No hace nada para el resto de roles. */
  setVista: (r: RolUsuario) => void;
  /** cliente_id a usar en todas las consultas de datos. Para super_admin es el
   *  cliente elegido en modo soporte; para el resto, siempre es el suyo. */
  clienteId: string | null;
  /** Nombre del cliente activo, solo para mostrarlo en la UI. */
  clienteNombre: string | null;
  /** Lista de clientes disponibles para elegir (poblada solo para super_admin). */
  clientesDisponibles: ClienteOption[];
  /** Cambia el cliente activo (modo soporte). No hace nada para el resto de roles. */
  setCliente: (id: string) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [rolReal, setRolReal] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [clientePropioId, setClientePropioId] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [vista, setVistaState] = useState<RolUsuario>("admin");

  // Modo soporte (solo super_admin): a que cliente se esta viendo/ayudando.
  const [clienteActivoId, setClienteActivoId] = useState<string | null>(null);
  const [clientesDisponibles, setClientesDisponibles] = useState<ClienteOption[]>([]);

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
        .select("rol, nombre, email, cliente_id")
        .eq("auth_user_id", userId)
        .eq("activo", true)
        .maybeSingle();

      if (!activo) return;

      if (!data) {
        setRolReal(null);
        setUsuario(null);
        setClientePropioId(null);
        setListo(true);
        return;
      }

      setRolReal(data.rol as string);
      setUsuario({ id: userId, nombre: data.nombre || email, email: data.email || email });
      setClientePropioId(data.cliente_id as string);

      // Solo el super_admin necesita conocer el resto de clientes (modo
      // soporte "vista desarrollador"). El resto de roles nunca deben poder
      // elegir otro cliente, ni siquiera si la RLS lo permitiera.
      if (data.rol === "super_admin") {
        const { data: clientes } = await supabase
          .from("clientes")
          .select("id, nombre")
          .order("nombre", { ascending: true });
        if (!activo) return;
        const opciones = (clientes as ClienteOption[]) || [];
        setClientesDisponibles(opciones);

        let guardado: string | null = null;
        try { guardado = window.localStorage.getItem(CLIENTE_KEY); } catch {}
        const existeGuardado = guardado && opciones.some((c) => c.id === guardado);
        setClienteActivoId(existeGuardado ? guardado : (data.cliente_id as string));
      }

      setListo(true);
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!activo) return;
      if (data.user) {
        cargarPerfil(data.user.id, data.user.email || "");
      } else {
        setRolReal(null);
        setUsuario(null);
        setClientePropioId(null);
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
        setClientePropioId(null);
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

  // Para super_admin, todas las consultas usan el cliente elegido en modo
  // soporte. Para el resto, siempre es su propio cliente: esto evita
  // depender de un cliente fijo hardcodeado a nivel de build.
  const clienteId = esSuperAdmin ? (clienteActivoId ?? clientePropioId) : clientePropioId;
  const clienteNombre = clientesDisponibles.find((c) => c.id === clienteId)?.nombre ?? null;

  const setVista = (r: RolUsuario) => {
    setVistaState(r);
    try { window.localStorage.setItem(VISTA_KEY, r); } catch {}
  };

  const setCliente = (id: string) => {
    setClienteActivoId(id);
    try { window.localStorage.setItem(CLIENTE_KEY, id); } catch {}
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRolReal(null);
    setUsuario(null);
    setClientePropioId(null);
    router.push("/login");
    router.refresh();
  };

  return (
    <RoleContext.Provider
      value={{
        rol, rolReal, esSuperAdmin, usuario, listo, signOut, setVista,
        clienteId, clienteNombre, clientesDisponibles, setCliente,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole debe usarse dentro de RoleProvider");
  return ctx;
}
