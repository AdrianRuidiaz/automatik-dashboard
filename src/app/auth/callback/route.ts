import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

// Google (login) y Supabase Auth (invitacion / recuperacion de contraseña)
// redirigen aqui. En el caso exitoso llega ?code=... y hay que
// intercambiarlo por una sesion real (cookies) antes de mandar al usuario
// de vuelta a la app. En el caso de un link ya usado o vencido, Supabase
// redirige aqui con ?error=...&error_code=...&error_description=... en vez
// de "code" - eso hay que reenviarlo tal cual para que la pantalla de
// destino pueda mostrar el motivo real en vez de quedar "verificando" sin
// explicacion.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/";

  // Caso 1: Supabase ya nos manda el error directamente (link vencido,
  // ya usado, o invalido) sin llegar a entregarnos un code.
  const errorDescription = searchParams.get("error_description");
  if (!code && errorDescription) {
    const destino = new URL(`${origin}${next}`);
    destino.searchParams.set("error_description", errorDescription);
    return NextResponse.redirect(destino.toString());
  }

  if (code) {
    const supabase = await getSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    // Caso 2: teniamos un code pero ya fue canjeado antes (por ejemplo si
    // el link se abrio dos veces - un preview del cliente de correo que
    // sigue el link, o el usuario lo toco mas de una vez). Sin este chequeo
    // el usuario terminaba en la pantalla de destino sin sesion y sin
    // ningun mensaje, viendo el spinner hasta que saltara el timeout
    // generico.
    if (error) {
      const destino = new URL(`${origin}${next}`);
      destino.searchParams.set("error_description", error.message);
      return NextResponse.redirect(destino.toString());
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
