import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServer } from "@/lib/supabase-server";

const ROLES_VALIDOS = ["admin", "vendedor", "empacador"];

async function verificarCaller() {
  const supabaseUser = await getSupabaseServer();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) } as const;

  const supabaseAdmin = getSupabaseAdmin();
  const { data: caller, error: callerError } = await supabaseAdmin
    .from("usuarios_roles")
    .select("id, rol, activo, cliente_id, auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (callerError) {
    console.error(callerError);
    return { error: NextResponse.json({ error: "Error verificando permisos" }, { status: 500 }) } as const;
  }
  if (!caller || !caller.activo || !["admin", "super_admin"].includes(caller.rol as string)) {
    return { error: NextResponse.json({ error: "No tienes permisos para gestionar el equipo" }, { status: 403 }) } as const;
  }
  return { supabaseAdmin, caller } as const;
}

async function resolverObjetivo(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  caller: { rol: string; cliente_id: string; auth_user_id: string },
  usuarioId: string
) {
  const { data: objetivo, error } = await supabaseAdmin
    .from("usuarios_roles")
    .select("id, rol, cliente_id, auth_user_id")
    .eq("id", usuarioId)
    .maybeSingle();
  if (error || !objetivo) return { error: NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 }) } as const;

  // Un admin normal solo puede gestionar gente de su propio cliente. Un
  // super_admin en modo soporte puede gestionar el equipo de cualquier
  // cliente (mismo criterio que invitar-usuario).
  if (caller.rol !== "super_admin" && objetivo.cliente_id !== caller.cliente_id) {
    return { error: NextResponse.json({ error: "No tienes permisos sobre este usuario" }, { status: 403 }) } as const;
  }
  // Nadie gestiona su propia fila desde aca (evita auto-bloqueo accidental)
  // ni la de otro super_admin (fuera del alcance de esta pantalla).
  if (objetivo.auth_user_id === caller.auth_user_id) {
    return { error: NextResponse.json({ error: "No puedes editar tu propio acceso" }, { status: 400 }) } as const;
  }
  if (objetivo.rol === "super_admin") {
    return { error: NextResponse.json({ error: "No se puede modificar a un super_admin desde aqui" }, { status: 400 }) } as const;
  }
  return { objetivo } as const;
}

export async function PATCH(req: NextRequest) {
  const { usuario_id, rol } = await req.json().catch(() => ({}));
  if (!usuario_id || !ROLES_VALIDOS.includes(rol)) {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }

  const check = await verificarCaller();
  if ("error" in check) return check.error;
  const { supabaseAdmin, caller } = check;

  const objetivoCheck = await resolverObjetivo(supabaseAdmin, caller as any, usuario_id);
  if ("error" in objetivoCheck) return objetivoCheck.error;

  const { error: updateError } = await supabaseAdmin
    .from("usuarios_roles")
    .update({ rol })
    .eq("id", usuario_id);
  if (updateError) {
    console.error("actualizar rol:", updateError);
    return NextResponse.json({ error: "No se pudo actualizar el rol" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { usuario_id } = await req.json().catch(() => ({}));
  if (!usuario_id) {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }

  const check = await verificarCaller();
  if ("error" in check) return check.error;
  const { supabaseAdmin, caller } = check;

  const objetivoCheck = await resolverObjetivo(supabaseAdmin, caller as any, usuario_id);
  if ("error" in objetivoCheck) return objetivoCheck.error;

  // Baja logica (activo = false) en vez de borrar la fila: revoca el
  // acceso al instante (todas las policies de RLS filtran por activo=true)
  // sin perder el historial ni romper referencias de otras tablas.
  const { error: deleteError } = await supabaseAdmin
    .from("usuarios_roles")
    .update({ activo: false })
    .eq("id", usuario_id);
  if (deleteError) {
    console.error("eliminar usuario:", deleteError);
    return NextResponse.json({ error: "No se pudo eliminar al usuario" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
