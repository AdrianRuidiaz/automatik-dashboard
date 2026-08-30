import { cache } from "react";
import { getSupabaseServer } from "./supabase-server";

// Tarea (Speed Insights): FCP/LCP reales de 3.59s/4.58s en "/" y "/pedidos/[id]"
// (ver auditoria de rendimiento) venian de que TODA la app es "use client":
// el servidor nunca manda HTML con contenido real, solo un shell vacio + el
// bundle de JS -- recien en el navegador se resuelve la sesion de Supabase,
// se consulta el rol/cliente_id en usuarios_roles, y solo despues se piden
// los datos reales. Esta funcion resuelve ese mismo perfil (rol + cliente_id)
// pero en el servidor, durante el render de RootLayout, para poder sembrar
// RoleProvider con un valor inicial y saltarse ese primer viaje de red desde
// el dispositivo del usuario.
//
// Mismo query que cargarPerfil() en role-context.tsx (misma tabla, mismas
// columnas, mismo filtro) a proposito -- este helper es un ADELANTO
// optimista de ese mismo resultado, nunca un reemplazo: role-context.tsx
// sigue ejecutando su propio fetch en el cliente despues de hidratar (igual
// que ya hacia con el cache de localStorage) y corrige el estado si algo
// cambio (rol editado, usuario desactivado, etc). Por eso NO se resuelve
// aca la lista de clientes ni el "cliente activo" del modo soporte de
// super_admin (clienteActivoId) -- esos dependen de localStorage, que no
// existe en el servidor, y ya hoy quedan en null hasta que el efecto del
// cliente corre, cache de localStorage o no.
//
// La cookie de sesion que lee getSupabaseServer() (via supabase.auth.getUser()
// mas abajo) se mantiene fresca por src/proxy.ts (el "middleware" de Next 16,
// corre en cada request) -- ya llama a supabase.auth.getUser() y reescribe la
// cookie si el token se renovo, ademas de redirigir a /login si no hay
// sesion. Este helper no depende de esa renovacion para ser seguro (si el
// token estuviera vencido, auth.getUser() aca abajo simplemente no encuentra
// usuario y se cae al mismo null de siempre), pero se beneficia de que para
// cualquier ruta protegida (todas menos PUBLIC_PATHS en proxy.ts) ya hay una
// sesion valida resuelta antes de llegar aca.
//
// cache() de React dedup-ea esta consulta dentro de un mismo request: si
// RootLayout Y una page.tsx (ej. "/", "/pedidos/[id]") llaman a esta funcion
// en el mismo render, solo se ejecuta una vez contra Supabase.
//
// Nunca lanza: cualquier error (sesion invalida, red, RLS, etc.) se trata
// como "no se pudo adelantar el perfil" -- el resultado es null y
// RoleProvider cae exactamente en su comportamiento actual (sin
// initialProfile), nunca en un error 500 de la pagina.
export interface PerfilServidor {
  rolReal: string;
  usuario: {
    id: string;
    rolId: string;
    nombre: string;
    email: string;
  };
  clientePropioId: string | null;
}

export const getPerfilServidor = cache(async (): Promise<PerfilServidor | null> => {
  try {
    const supabase = await getSupabaseServer();

    // getUser() (no getSession()) a proposito: revalida el JWT contra el
    // servidor de Supabase Auth en vez de solo decodificar la cookie local
    // -- mas lento que getSession() pero es la forma recomendada de
    // verificar identidad del lado del servidor.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("usuarios_roles")
      .select("id, rol, nombre, email, cliente_id")
      .eq("auth_user_id", user.id)
      .eq("activo", true)
      .maybeSingle();

    if (error || !data) return null;

    return {
      rolReal: data.rol as string,
      usuario: {
        id: user.id,
        rolId: data.id as string,
        nombre: (data.nombre as string) || user.email || "",
        email: (data.email as string) || user.email || "",
      },
      clientePropioId: (data.cliente_id as string) ?? null,
    };
  } catch {
    return null;
  }
});
