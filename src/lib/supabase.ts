import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Antes: createClient() de @supabase/supabase-js (sesion solo en localStorage,
// invisible para middleware/server components). Ahora: createBrowserClient()
// de @supabase/ssr, que ademas guarda la sesion en cookies para que
// middleware.ts pueda leerla y proteger rutas server-side.
//
// El generic <any, any, any> evita el mismo bug de inferencia "never" en
// .select()/.eq()/.update() que rompio el build de Vercel cuando el cliente
// admin no tenia un tipo Database explicito (ver supabase-admin.ts).
export const supabase = createBrowserClient<any, any, any>(supabaseUrl, supabaseAnonKey);
