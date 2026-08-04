import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const CLIENTE_ID = process.env.NEXT_PUBLIC_CLIENTE_ID!;

// Crea la PRIMERA cuenta de administrador, solo mientras usuarios_roles
// este vacia (activo=true count === 0). Vuelve a verificar esto en el
// servidor antes de crear nada, asi que no sirve para crear un segundo
// admin ni para escalar privilegios una vez que ya hay alguien configurado.
export async function POST(req: NextRequest) {
  const { email, password, nombre } = await req.json().catch(() => ({}));
  if (!email || !password || !nombre) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  if (String(password).length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    const { count, error: countError } = await supabaseAdmin
      .from("usuarios_roles")
      .select("id", { count: "exact", head: true })
      .eq("activo", true);
    if (countError) throw countError;
    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: "Ya existe un administrador configurado" }, { status: 409 });
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) throw createError;

    const { error: insertError } = await supabaseAdmin.from("usuarios_roles").insert({
      auth_user_id: created.user.id,
      cliente_id: CLIENTE_ID,
      rol: "super_admin",
      nombre,
      email,
      activo: true,
    });
    if (insertError) throw insertError;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("bootstrap admin:", err);
    return NextResponse.json({ error: "No se pudo crear la cuenta de administrador" }, { status: 500 });
  }
}
