import PedidoDetailClient from "@/components/pedidos/pedido-detail-client";
import { getSupabaseServer } from "@/lib/supabase-server";
import { fetchPedidoServer } from "@/lib/api-server";
import type { Pedido } from "@/lib/types";

// Tarea (Speed Insights): "/pedidos/[id]" media 67/100 en Speed Insights,
// mejor que "/" pero igual "necesita mejorar" -- mismo problema de fondo,
// una sola consulta de menos: el detalle solo se pintaba despues de que el
// navegador resolviera sesion + este fetch, desde el dispositivo del
// visitante. Este archivo pasa de "use client" a un Server Component que
// adelanta ese mismo fetchPedido(id) (ver lib/api-server.ts, misma consulta
// que lib/api.ts) durante el render. Toda la logica interactiva (realtime,
// boton volver, descarga de etiqueta) sigue intacta en
// PedidoDetailClient (components/pedidos/pedido-detail-client.tsx), que
// ahora solo recibe el resultado como semilla en vez de arrancar en null.
//
// No hace falta resolver cliente_id aca: el cliente de servidor usa la
// sesion real del visitante (cookies, ver lib/supabase-server.ts), asi que
// RLS aplica exactamente igual que del lado del navegador -- si el usuario
// no tiene acceso a este pedido, la consulta no devuelve nada, mismo
// resultado que produce hoy el fetch del cliente.
//
// Cualquier error (RLS, id invalido, sesion no disponible en esta request)
// se traga en fetchPedidoServer/aca abajo: initialPedido pasa a null y
// PedidoDetailClient arranca exactamente como antes de este cambio
// (skeleton hasta que el fetch del cliente resuelva).
async function getInitialPedido(id: string): Promise<Pedido | null> {
  try {
    const supabase = await getSupabaseServer();
    return await fetchPedidoServer(supabase, id);
  } catch {
    return null;
  }
}

export default async function PedidoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initialPedido = await getInitialPedido(id);
  return <PedidoDetailClient initialPedido={initialPedido} />;
}
