import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Cliente de Supabase SOLO para uso en el servidor (API routes).
// Usa la service role key para poder validar y escribir de forma confiable
// (ej. re-contar evidencias antes de marcar un pedido como empacado) sin
// depender de que las políticas RLS del anon key ya cubran ese caso.
//
// IMPORTANTE: nunca importar este archivo desde un componente "use client"
// ni exponer SUPABASE_SERVICE_ROLE_KEY con el prefijo NEXT_PUBLIC_. El
// import "server-only" de arriba convierte un import accidental desde el
// cliente en un error de build, en vez de depender solo de este comentario.
//
// NOTA: sin un tipo Database<> generado, createClient() sin generics hace
// que supabase-js/postgrest-js infieran el resultado de .select()/.update()
// como `never` (rompía el build de Vercel: "Argument ... is not assignable
// to parameter of type 'never'"). Se tipa explícitamente con `any` en los
// tres generics para que el resto del código pueda usar .from(tabla) libremente.
let cachedClient: SupabaseClient<any, any, any> | null = null;

export function getSupabaseAdmin(): SupabaseClient<any, any, any> {
  if (cachedClient) return cachedClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor"
    );
  }

  cachedClient = createClient<any, any, any>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}
