import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Antes: createClient() de @supabase/supabase-js (sesion solo en localStorage,
// invisible para middleware/server components). Ahora: createBrowserClient()
// de @supabase/ssr, que ademas guarda la sesion en cookies para que
// middleware.ts pueda leerla y proteger rutas server-side.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
