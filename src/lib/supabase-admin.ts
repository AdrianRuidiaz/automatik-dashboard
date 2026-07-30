import { createClient } from "@supabase/supabase-js";

// Cliente de Supabase SOLO para uso en el servidor (API routes).
// Usa la service role key para poder validar y escribir de forma confiable
// (ej. re-contar evidencias antes de marcar un pedido como empacado) sin
// depender de que las políticas RLS del anon key ya cubran ese caso.
//
// IMPORTANTE: nunca importar este archivo desde un componente "use client"
// ni exponer SUPABASE_SERVICE_ROLE_KEY con el prefijo NEXT_PUBLIC_.
let cachedClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (cachedClient) return cachedClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor"
    );
  }

  cachedClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}
