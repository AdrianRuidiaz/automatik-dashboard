import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import type { EmailOtpType } from "@supabase/supabase-js";

// Endpoint al que apuntan los links de invitacion y recuperacion de
// contraseña (ver plantillas de correo en el dashboard de Supabase:
// Auth > Email Templates). A diferencia de /auth/callback (que canjea un
// ?code=... via PKCE y requiere un code_verifier guardado en el MISMO
// dispositivo que inicio el pedido), esta ruta valida el token_hash
// directamente contra el servidor de Supabase - funciona sin importar en
// que dispositivo se abra el link, que es el caso normal para estos
// flujos (un admin invita desde su compu, la persona invitada abre el
// correo en su celular).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") || "/";

  if (token_hash && type) {
    const supabase = await getSupabaseServer();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    const destino = new URL(`${origin}${next}`);
    destino.searchParams.set("error_description", error.message);
    return NextResponse.redirect(destino.toString());
  }

  const destino = new URL(`${origin}${next}`);
  destino.searchParams.set("error_description", "Link invalido: falta token_hash o type.");
  return NextResponse.redirect(destino.toString());
}
