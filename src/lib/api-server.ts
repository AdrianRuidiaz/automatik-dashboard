import "server-only";
import { PEDIDO_SELECT } from "./api";
import type { getSupabaseServer } from "./supabase-server";
import type { Pedido, DashboardResumen, TendenciaDiaria } from "./types";

// Se tipa el parametro con el retorno real de getSupabaseServer() (en vez de
// importar SupabaseClient<> de @supabase/supabase-js y tipar a mano) para
// evitar el mismo problema de inferencia documentado en supabase-admin.ts:
// sin un tipo Database<> generado, un generic distinto al que realmente usa
// el cliente construido hace que .select()/.eq() infieran `never` y rompan
// el build.
type SupabaseServerClient = Awaited<ReturnType<typeof getSupabaseServer>>;

// Tarea (Speed Insights): version de servidor de las consultas de lib/api.ts
// que hoy solo corren en el navegador (import { supabase } from "./supabase",
// el cliente browser). Se reciben el cliente de Supabase como parametro (en
// vez de importar uno propio) para poder pasarle el cliente de servidor
// autenticado con la sesion real del visitante (ver lib/supabase-server.ts) y
// que las policies de RLS se apliquen exactamente igual que del lado del
// cliente -- ningun dato nuevo queda expuesto que hoy no lo estuviera.
//
// Mismas queries, mismo orden, mismos limites que fetchPedidos /
// fetchDashboardKpisRango / fetchTendenciaDiaria / fetchPedido en lib/api.ts
// (PEDIDO_SELECT se reusa importado, nunca copiado a mano) -- el objetivo es
// que el resultado sea IDENTICO al que produciria el primer fetch del
// cliente, solo que resuelto en el servidor durante el render inicial.
//
// "server-only" hace que cualquier intento de importar este archivo desde un
// componente "use client" falle en build time, en vez de en produccion --
// nunca deberia terminar en el bundle del navegador.

const LIMITE_PEDIDOS_DEFAULT = 500;

export async function fetchPedidosServer(
  supabase: SupabaseServerClient,
  clienteId: string
): Promise<Pedido[]> {
  const { data, error } = await supabase
    .from("pedidos")
    .select(PEDIDO_SELECT)
    .eq("cliente_id", clienteId)
    .order("fecha_pedido", { ascending: false })
    .limit(LIMITE_PEDIDOS_DEFAULT);
  if (error) throw error;
  return (data as unknown as Pedido[]) ?? [];
}

export async function fetchDashboardKpisRangoServer(
  supabase: SupabaseServerClient,
  clienteId: string,
  desde: Date,
  hasta: Date
): Promise<DashboardResumen | null> {
  const { data, error } = await supabase.rpc("dashboard_kpis_rango", {
    p_cliente_id: clienteId,
    p_desde: desde.toISOString(),
    p_hasta: hasta.toISOString(),
  });
  if (error) throw error;
  const fila = Array.isArray(data) ? data[0] : data;
  return (fila as DashboardResumen) ?? null;
}

export async function fetchTendenciaDiariaServer(
  supabase: SupabaseServerClient,
  clienteId: string,
  dias = 7
): Promise<TendenciaDiaria[]> {
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  const { data, error } = await supabase
    .from("v_tendencia_diaria")
    .select("*")
    .eq("cliente_id", clienteId)
    .gte("fecha", desde.toISOString().slice(0, 10))
    .order("fecha", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPedidoServer(
  supabase: SupabaseServerClient,
  id: string
): Promise<Pedido | null> {
  const { data, error } = await supabase
    .from("pedidos")
    .select(PEDIDO_SELECT)
    .eq("id", id)
    .single();
  if (error) return null;
  return data as unknown as Pedido;
}
