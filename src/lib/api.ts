import { supabase } from "./supabase";
import type {
    Pedido,
    DashboardResumen,
    TendenciaDiaria,
    Archivo,
    EstadoPedido,
    TipoArchivo,
} from "./types";

// NOTA: antes este archivo usaba un NEXT_PUBLIC_CLIENTE_ID fijo, hardcodeado
// a nivel de build. Eso hacia imposible que un mismo despliegue sirva a mas
// de un cliente (necesario para la "vista desarrollador"/soporte de
// super_admin y, a futuro, para vender esto como servicio multi-cliente).
// Ahora cada funcion recibe el cliente_id como parametro: quien lo resuelve
// es role-context (propio para roles normales, elegible para super_admin).

// cancelado_por_usuario: embebido via el FK pedidos_cancelado_por_fkey, para
// poder mostrar "Cancelado por X" sin una consulta aparte por pedido.
const PEDIDO_SELECT = "*, cancelado_por_usuario:usuarios_roles!pedidos_cancelado_por_fkey(nombre)";

export async function fetchPedidos(clienteId: string): Promise<Pedido[]> {
    const { data, error } = await supabase
      .from("pedidos")
      .select(PEDIDO_SELECT)
      .eq("cliente_id", clienteId)
      .order("fecha_pedido", { ascending: false });
    if (error) throw error;
    return (data as unknown as Pedido[]) ?? [];
}

export async function fetchPedido(id: string): Promise<Pedido | null> {
    const { data, error } = await supabase
      .from("pedidos")
      .select(PEDIDO_SELECT)
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as unknown as Pedido;
}

export async function fetchPedidoByPlataforma(
    idPlataforma: string,
    clienteId: string
  ): Promise<Pedido | null> {
    const { data, error } = await supabase
      .from("pedidos")
      .select("*")
      .eq("id_plataforma", idPlataforma)
      .eq("cliente_id", clienteId)
      .maybeSingle();
    if (error) throw error;
    return data;
}

// Tarea: validacion de pedidos duplicados (creacion manual).
// Wrapper explicito sobre fetchPedidoByPlataforma para dejar la intencion
// clara en el punto de uso (manual-order-form.tsx) y para poder ampliar la
// regla de duplicado a futuro (ej. considerar tambien la plataforma) sin
// tocar el resto del codigo que ya depende de fetchPedidoByPlataforma.
export async function existePedidoDuplicado(idPlataforma: string, clienteId: string): Promise<Pedido | null> {
    if (!idPlataforma.trim()) return null;
    return fetchPedidoByPlataforma(idPlataforma.trim(), clienteId);
}

export async function fetchDashboardResumen(clienteId: string): Promise<DashboardResumen | null> {
    const { data, error } = await supabase
      .from("v_dashboard_resumen")
      .select("*")
      .eq("cliente_id", clienteId)
      .maybeSingle();
    if (error) throw error;
    return data;
}

export async function fetchTendenciaDiaria(
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

// subido_por_usuario: embebido via el FK archivos_subido_por_fkey, para
// mostrar que empacador subio cada evidencia sin una consulta aparte.
export async function fetchArchivos(pedidoId: string): Promise<Archivo[]> {
    const { data, error } = await supabase
      .from("archivos")
      .select("*, subido_por_usuario:usuarios_roles!archivos_subido_por_fkey(nombre)")
      .eq("pedido_id", pedidoId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data as unknown as Archivo[]) ?? [];
}

export async function uploadArchivo(
    bucket: string,
    path: string,
    file: File
  ): Promise<string> {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
          upsert: true,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
}

// NOTA: los nombres de columnas/valores de `tipo` deben coincidir exactamente
// con el esquema real de la tabla public.archivos en Supabase (columna `url`,
// sin columna `subtipo`; `tipo` es un CHECK constraint con valores fijos).
// Antes esta funcion mandaba `storage_path` y valores como "evidencia" /
// "documento_tributario" que no existen en la base y hacian fallar el insert.
//
// subido_por: usuarios_roles.id (RoleContext.usuario.rolId) de quien subio
// el archivo. Opcional para no romper otros llamadores (ej. etiquetas que
// suben workflows de n8n via service role, sin un usuario detras).
export async function registrarArchivo(archivo: {
    pedido_id: string;
    tipo: TipoArchivo;
    url: string;
    nombre_archivo?: string | null;
    descripcion?: string | null;
    subido_por?: string | null;
}): Promise<void> {
    const { error } = await supabase.from("archivos").insert({
          pedido_id: archivo.pedido_id,
          tipo: archivo.tipo,
          url: archivo.url,
          nombre_archivo: archivo.nombre_archivo ?? null,
          descripcion: archivo.descripcion ?? null,
          subido_por: archivo.subido_por ?? null,
    });
    if (error) throw error;
}

export async function updateEstadoPedido(
    pedidoId: string,
    estado: EstadoPedido
  ): Promise<void> {
    const { error } = await supabase
      .from("pedidos")
      .update({ estado, updated_at: new Date().toISOString() })
      .eq("id", pedidoId);
    if (error) throw error;
}

// Tarea: cancelar un pedido NUNCA lo elimina, solo actualiza su estado.
// Se deja como funcion explicita (en vez de usar updateEstadoPedido directo
// desde los componentes) para que quede un unico punto de entrada auditable.
//
// canceladoPor es el usuarios_roles.id (RoleContext.usuario.rolId) de quien
// hace clic en "Cancelar pedido": queda guardado junto a la fecha para poder
// mostrar "Cancelado por X el ..." en el detalle del pedido.
export async function cancelarPedido(pedidoId: string, canceladoPor?: string | null): Promise<void> {
    const ahora = new Date().toISOString();
    const { error } = await supabase
      .from("pedidos")
      .update({
        estado: "cancelled",
        updated_at: ahora,
        cancelado_por: canceladoPor ?? null,
        cancelado_en: ahora,
      })
      .eq("id", pedidoId);
    if (error) throw error;
}

export interface UpsertPedidoResultado {
    pedido_id: string;
    is_new: boolean;
    action: "created" | "updated";
}

export async function upsertPedido(params: {
    p_cliente_id: string;
    p_plataforma: string;
    p_id_plataforma: string;
    p_order_id: string;
    p_estado: string;
    p_cliente_nombre: string | null;
    p_total_pagado: number;
    p_fecha_pedido: string | null;
    p_fecha_limite_despacho: string | null;
    p_etiqueta_url: string | null;
    p_items: Array<{
      title: string;
      quantity: number;
      unit_price: number;
      sku: string | null;
    }>;
}): Promise<UpsertPedidoResultado> {
    const { data, error } = await supabase.rpc("upsert_pedido", params);
    if (error) throw error;
    return data as UpsertPedidoResultado;
}

export function getEtiquetaUrl(storagePath: string): string {
    const { data } = supabase.storage.from("etiquetas").getPublicUrl(storagePath);
    return data.publicUrl;
}

// ---------------------------------------------------------------------------
// Tarea: validacion de PDF/Dropbox antes de guardar (creacion manual).
// Sigue el mismo patron que /api/orders/lookup: el frontend nunca habla
// directo con Dropbox, todo pasa por un webhook de n8n que ya tiene las
// credenciales configuradas.
// ---------------------------------------------------------------------------
export interface VerificarPdfResultado {
    existe: boolean;
    url?: string;
    mensaje?: string;
}

export async function verificarPdfDisponible(
    orderNumber: string,
    plataforma: string
  ): Promise<VerificarPdfResultado> {
    const res = await fetch(
          `/api/orders/verify-pdf?order=${encodeURIComponent(orderNumber)}&platform=${encodeURIComponent(plataforma)}`
        );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
          return {
                  existe: false,
                  mensaje: body.error || "No se pudo verificar el PDF en Dropbox",
          };
    }
    return { existe: true, url: body.url, mensaje: body.mensaje };
}

// ---------------------------------------------------------------------------
// Tarea: evidencia fotografica obligatoria para "Marcar como empacado".
// La validacion de cantidad de fotos se hace tambien en el servidor: este
// endpoint vuelve a contar los archivos tipo "evidencia_empaque" ya subidos
// antes de permitir el cambio de estado, para no depender solo del frontend.
// ---------------------------------------------------------------------------
export interface MarcarEmpacadoResultado {
    ok: boolean;
    error?: string;
}

export async function marcarPedidoEmpacado(pedidoId: string): Promise<MarcarEmpacadoResultado> {
    const res = await fetch(`/api/pedidos/${pedidoId}/empacar`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
          return { ok: false, error: body.error || "No se pudo marcar el pedido como empacado" };
    }
    return { ok: true };
}
