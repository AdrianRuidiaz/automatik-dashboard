import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Publico (sin auth): solo devuelve un booleano, nunca datos de usuarios.
// Lo usa /login para decidir si mostrar el formulario normal o el de
// "crear la primera cuenta de administrador".
export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { count, error } = await supabaseAdmin
      .from("usuarios_roles")
      .select("id", { count: "exact", head: true })
      .eq("activo", true);
    if (error) throw error;
    return NextResponse.json({ needsBootstrap: (count ?? 0) === 0 });
  } catch (err) {
    console.error("bootstrap-status:", err);
    return NextResponse.json({ needsBootstrap: false });
  }
}
