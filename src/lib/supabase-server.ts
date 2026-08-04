import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente de Supabase para usar en Route Handlers / Server Components.
// A diferencia de supabase-admin.ts (service role, se salta RLS), este
// respeta la sesion real del usuario que hace la peticion (via cookies),
// asi que sirve para verificar "quien esta llamando" antes de usar
// supabase-admin para operaciones privilegiadas (ej. invitar usuarios).
export async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Llamado desde un Server Component (no puede escribir cookies).
            // No pasa nada: middleware.ts ya se encarga de refrescar la sesion.
          }
        },
      },
    }
  );
}
