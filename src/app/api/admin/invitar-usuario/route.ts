import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseServer } from "@/lib/supabase-server";

const ROLES_VALIDOS = ["admin", "vendedor", "empacador"];

export async function POST(req: NextRequest) {
  const { email, nombre, rol, cliente_id: clienteIdSolicitado } = await req.json().catch(() => ({}));
  if (!email || !nombre || !ROLES_VALIDOS.includes(rol)) {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }

  // Verificar que quien llama tiene sesion real y es admin/super_admin.
  // No confiamos en el rol que venga del cliente: se re-verifica en la
  // base de datos con la sesion autenticada (cookies), no con la anon key.
  const supabaseUser = await getSupabaseServer();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: caller, error: callerError } = await supabaseAdmin
    .from("usuarios_roles")
    .select("rol, activo, cliente_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (callerError) {
    console.error(callerError);
    return NextResponse.json({ error: "Error verificando permisos" }, { status: 500 });
  }
  if (!caller || !caller.activo || !["admin", "super_admin"].includes(caller.rol as string)) {
    return NextResponse.json({ error: "No tienes permisos para invitar usuarios" }, { status: 403 });
  }

  // Un admin normal solo puede invitar dentro de su propio cliente: se
  // ignora cualquier cliente_id que venga del body. Un super_admin en modo
  // soporte (vista desarrollador) puede invitar al cliente que este viendo,
  // pero se valida que ese cliente exista antes de usarlo.
  let clienteId = caller.cliente_id as string;
  if (caller.rol === "super_admin" && clienteIdSolicitado) {
    const { data: clienteValido } = await supabaseAdmin
      .from("clientes")
      .select("id")
      .eq("id", clienteIdSolicitado)
      .maybeSingle();
    if (!clienteValido) {
      return NextResponse.json({ error: "Cliente invalido" }, { status: 400 });
    }
    clienteId = clienteIdSolicitado;
  }

  try {
    const redirectTo = `${req.nextUrl.origin}/auth/set-password`;
    const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo });

    let authUserId: string | null = invited?.user?.id ?? null;

    if (inviteError) {
      // Puede que el usuario ya exista (ej. ya inicio sesion con Google antes
      // de ser invitado). En ese caso solo lo ligamos por email.
      const yaExiste = inviteError.message?.toLowerCase().includes("already registered");
      if (!yaExiste) throw inviteError;
      const { data: lista } = await supabaseAdmin.auth.admin.listUsers();
      const existente = lista?.users.find((u) => u.email?.toLowerCase() === String(email).toLowerCase());
      authUserId = existente?.id ?? null;
    }

    const { data: filaExistente } = await supabaseAdmin
      .from("usuarios_roles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (filaExistente) {
      const { error: updateError } = await supabaseAdmin
        .from("usuarios_roles")
        .update({ auth_user_id: authUserId, cliente_id: clienteId, rol, nombre, activo: true })
        .eq("id", filaExistente.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabaseAdmin
        .from("usuarios_roles")
        .insert({ auth_user_id: authUserId, cliente_id: clienteId, rol, nombre, email, activo: true });
      if (insertError) throw insertError;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("invitar-usuario:", err);
    return NextResponse.json({ error: "No se pudo invitar al usuario" }, { status: 500 });
  }
}
