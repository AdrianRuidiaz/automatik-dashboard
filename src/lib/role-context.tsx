"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { RolUsuario } from "@/lib/types";

interface Usuario {
  id: string;
  /** id de la fila en public.usuarios_roles (distinto de auth_user_id).
   *  Se usa para dejar registro de quien hizo una accion (subir evidencia,
   *  cancelar un pedido) sin tener que resolverlo en cada punto de uso. */
  rolId: string;
  nombre: string;
  email: string;
}

interface ClienteOption {
  id: string;
  nombre: string;
}

const VISTA_KEY = "automatik:vista_super_admin";
const CLIENTE_KEY = "automatik:cliente_activo_super_admin";

// Cache del perfil (rol + cliente_id) en localStorage, para no repetir el
// round-trip a usuarios_roles en cada carga de pagina. Solo se usa como
// pintado optimista mientras se confirma en segundo plano -- cargarPerfil()
// sigue corriendo siempre y sobreescribe el estado si algo cambio (rol
// editado por un admin, usuario desactivado, etc.), asi que un dato
// cacheado desactualizado nunca queda "pegado" mas de lo que tarda esa
// consulta.
const PERFIL_CACHE_KEY = "automatik:perfil_cache";

interface PerfilCache {
  userId: string;
  rolReal: string;
  usuario: Usuario;
  clientePropioId: string | null;
}

function leerPerfilCache(userId: string): PerfilCache | null {
  try {
    const raw = window.localStorage.getItem(PERFIL_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as PerfilCache;
    return cache?.userId === userId ? cache : null;
  } catch {
    return null;
  }
}

function guardarPerfilCache(userId: string, datos: Omit<PerfilCache, "userId">) {
  try {
    window.localStorage.setItem(PERFIL_CACHE_KEY, JSON.stringify({ userId, ...datos }));
  } catch {}
}

function limpiarPerfilCache() {
  try {
    window.localStorage.removeItem(PERFIL_CACHE_KEY);
  } catch {}
}

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
  const pathname = usePathname();
  const [rolReal, setRolReal] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [clientePropioId, setClientePropioId] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [vista, setVistaState] = useState<RolUsuario>("admin");

  // Modo soporte (solo super_admin): a que cliente se esta viendo/ayudando.
  const [clienteActivoId, setClienteActivoId] = useState<string | null>(null);
  const [clientesDisponibles, setClientesDisponibles] = useState<ClienteOption[]>([]);

  // /login y /auth/* son publicas y no usan useRole() -- no tiene sentido
  // pedir rol/cliente ahi. Antes esas paginas competian por ancho de banda
  // con las consultas de auth/rol/clientes de fondo, lo que se sentia como
  // demora para cargar los links de crear/recuperar contraseña en movil.
  const esPublica = pathname === "/login" || pathname.startsWith("/auth");

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
    if (esPublica) {
      setListo(true);
      return;
    }

    let activo = true;
    let ultimoUserId: string | null = null;

    async function cargarPerfil(userId: string, email: string) {
      const { data } = await supabase
        .from("usuarios_roles")
        .select("id, rol, nombre, email, cliente_id")
        .eq("auth_user_id", userId)
        .eq("activo", true)
        .maybeSingle();

      if (!activo) return;

      if (!data) {
        setRolReal(null);
        setUsuario(null);
        setClientePropioId(null);
        limpiarPerfilCache();
        setListo(true);
        return;
      }

      const usuarioResuelto: Usuario = {
        id: userId,
        rolId: data.id as string,
        nombre: data.nombre || email,
        email: data.email || email,
      };
      const clienteResuelto = data.cliente_id as string;
      setRolReal(data.rol as string);
      setUsuario(usuarioResuelto);
      setClientePropioId(clienteResuelto);
      guardarPerfilCache(userId, {
        rolReal: data.rol as string,
        usuario: usuarioResuelto,
        clientePropioId: clienteResuelto,
      });

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

    // Un solo punto de entrada (onAuthStateChange, que se dispara de
    // inmediato con la sesion actual al suscribirse) en vez de sumar un
    // supabase.auth.getUser() aparte -- antes se disparaban dos fetches de
    // usuarios_roles (y clientes) en cada carga de pagina, duplicando
    // round-trips innecesarios, mas notorio en redes moviles.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!activo) return;
      if (session?.user) {
        if (session.user.id === ultimoUserId) return;
        ultimoUserId = session.user.id;
        // Perfil cacheado (ver guardarPerfilCache mas arriba): si es el
        // mismo usuario de la ultima visita, se pinta de inmediato sin
        // esperar el round-trip a usuarios_roles -- cargarPerfil() se sigue
        // ejecutando igual, en paralelo, y corrige el estado si algo
        // cambio desde la ultima vez.
        const cache = leerPerfilCache(session.user.id);
        if (cache) {
          setRolReal(cache.rolReal);
          setUsuario(cache.usuario);
          setClientePropioId(cache.clientePropioId);
          setListo(true);
        }
        cargarPerfil(session.user.id, session.user.email || "");
      } else {
        ultimoUserId = null;
        setRolReal(null);
        setUsuario(null);
        setClientePropioId(null);
        limpiarPerfilCache();
        setListo(true);
      }
    });

    return () => {
      activo = false;
      sub.subscription.unsubscribe();
    };
  }, [esPublica]);

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
    limpiarPerfilCache();
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
