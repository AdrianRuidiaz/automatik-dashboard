import { supabase } from "./supabase";
import type {
    Pedido,
    DashboardResumen,
    TendenciaDiaria,
    Archivo,
    EstadoPedido,
    TipoArchivo,
    Producto,
} from "./types";

// NOTA: antes este archivo usaba un NEXT_PUBLIC_CLIENTE_ID fijo, hardcodeado
// a nivel de build. Eso hacia imposible que un mismo despliegue sirva a mas
// de un cliente (necesario para la "vista desarrollador"/soporte de
// super_admin y, a futuro, para vender esto como servicio multi-cliente).
// Ahora cada funcion recibe el cliente_id como parametro: quien lo resuelve
// es role-context (propio para roles normales, elegible para super_admin).

// cancelado_por_usuario: embebido via el FK pedidos_cancelado_por_fkey, para
// poder mostrar "Cancelado por X" sin una consulta aparte por pedido.
// Exportado (en vez de quedar privado del archivo) para que lib/api-server.ts
// pueda reusar exactamente el mismo shape de consulta desde el cliente de
// servidor -- una sola fuente de verdad, sin duplicar el string a mano y
// arriesgar que las dos versiones (browser/server) se desincronicen.
export const PEDIDO_SELECT = "*, cancelado_por_usuario:usuarios_roles!pedidos_cancelado_por_fkey(nombre)";

// Limite de seguridad, no paginacion real todavia. fetchPedidos la usan tanto
// la tabla de admin (historial completo) como la cola de "pendientes de
// empacar" del empacador -- esta ultima necesita ver TODO pedido no terminal
// sin importar su antiguedad, asi que un filtro por rango de fechas por
// defecto esconderia pedidos atrasados de la cola en vez de optimizar nada.
// 500 da margen amplio sobre el volumen actual (123 pedidos totales, ver
// auditoria de agosto 2026); si algun cliente se acerca a este numero, el
// siguiente paso es paginacion real (cursor por fecha_pedido), no subir el
// limite.
const LIMITE_PEDIDOS_DEFAULT = 500;

export async function fetchPedidos(clienteId: string): Promise<Pedido[]> {
    const { data, error } = await supabase
      .from("pedidos")
      .select(PEDIDO_SELECT)
      .eq("cliente_id", clienteId)
      .order("fecha_pedido", { ascending: false })
      .limit(LIMITE_PEDIDOS_DEFAULT);
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

// Tarea: filtro de rango de fechas en las tarjetas KPI del dashboard (1
// semana / 1 mes / 3 meses / 6 meses / 12 meses). v_dashboard_resumen agrega
// TODO el historico del cliente sin parametro de fecha, asi que no sirve
// aca -- se usa en su lugar el RPC dashboard_kpis_rango (misma agregacion,
// acotada a [desde, hasta) sobre fecha_pedido). Se llama dos veces desde
// page.tsx (periodo actual y periodo anterior equivalente) para calcular el
// delta % que muestra cada tarjeta.
export async function fetchDashboardKpisRango(
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

// Tarea: evitar patron N+1. TaxDocsTable (vendedor) necesitaba los
// documentos tributarios de hasta 60 pedidos a la vez para poder mostrar
// "Sin documento" / badges por fila; antes eso disparaba 60 llamadas a
// fetchArchivos en paralelo (Promise.all + slice(0,60).map). Esta funcion
// trae los archivos de TODOS los pedidos pedidos en una sola query via
// .in("pedido_id", ids) -- el llamador agrupa el resultado por pedido_id.
export async function fetchArchivosPorPedidos(pedidoIds: string[]): Promise<Archivo[]> {
    if (pedidoIds.length === 0) return [];
    const { data, error } = await supabase
      .from("archivos")
      .select("*, subido_por_usuario:usuarios_roles!archivos_subido_por_fkey(nombre)")
      .in("pedido_id", pedidoIds)
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

// archivos.url siempre guarda la URL PUBLICA COMPLETA que devuelve
// uploadArchivo (ej. "https://xxx.supabase.co/storage/v1/object/public/
// evidencias/<pack>/evidencia_1_123.jpg"), nunca el path relativo dentro del
// bucket. Para operar sobre el objeto real en Storage (borrar, o borrar el
// viejo despues de reemplazar) hace falta el path -- esta funcion lo extrae
// de la url guardada, sin depender de convenciones de carpetas que no son
// consistentes entre buckets (ej. "evidencias" usa id_plataforma como primer
// segmento, "etiquetas"/"documentos" usan cliente_id).
function pathDesdeUrlPublica(bucket: string, urlPublica: string): string {
    const marcador = `/object/public/${bucket}/`;
    const idx = urlPublica.indexOf(marcador);
    return idx === -1 ? urlPublica : urlPublica.slice(idx + marcador.length);
}

// Tarea: admin y vendedor pueden eliminar una evidencia de empaque que subio
// el empacador (ej. foto borrosa, repetida o equivocada). Requiere la policy
// DELETE agregada en la migracion permitir_admin_vendedor_editar_evidencias
// -- antes NO existia ninguna policy de DELETE en archivos ni en el storage
// de evidencias, asi que nadie (ni siquiera admin) podia borrar.
export async function eliminarArchivo(archivo: Archivo, bucket: string): Promise<void> {
    const path = pathDesdeUrlPublica(bucket, archivo.url);
    const { error: errorStorage } = await supabase.storage.from(bucket).remove([path]);
    if (errorStorage) throw errorStorage;
    const { error } = await supabase.from("archivos").delete().eq("id", archivo.id);
    if (error) throw error;
}

// Tarea: admin y vendedor pueden reemplazar una evidencia por otra foto sin
// tener que borrar y volver a subir por separado. Sube el archivo nuevo con
// un path nuevo (mismo patron de nombre que ya usa el empacador al subir),
// actualiza la MISMA fila en archivos (conserva id/subido_por/created_at
// originales -- solo cambian url y nombre_archivo) y recien al final borra
// el objeto viejo del storage. El borrado del objeto viejo es best-effort:
// si falla, no revierte el reemplazo (la fila ya quedo apuntando al archivo
// nuevo, que es lo que le importa al usuario), simplemente queda un objeto
// huerfano en storage.
export async function reemplazarArchivo(
    archivo: Archivo,
    bucket: string,
    file: File,
    carpeta: string
  ): Promise<string> {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const nuevaPath = `${carpeta}/${archivo.tipo}_${Date.now()}.${ext}`;
    const nuevaUrl = await uploadArchivo(bucket, nuevaPath, file);

    const { error } = await supabase
      .from("archivos")
      .update({ url: nuevaUrl, nombre_archivo: file.name })
      .eq("id", archivo.id);
    if (error) throw error;

    const pathVieja = pathDesdeUrlPublica(bucket, archivo.url);
    try {
          await supabase.storage.from(bucket).remove([pathVieja]);
    } catch (e) {
          console.error("No se pudo borrar el archivo viejo (huerfano en storage):", e);
    }

    return nuevaUrl;
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

export interface CrearPedidoManualResultado {
    pedido_id: string;
}

// Tarea: registro manual de pedidos (formulario "Ingresar pedido manual").
//
// 2026-08-25: antes esta funcion (como upsertPedido) llamaba al RPC
// upsert_pedido. Ese RPC arranca con
// `PERFORM public._check_internal_secret_bool()`, una funcion que exige un
// header x-internal-secret con un valor que SOLO conocen los workflows de
// n8n (llamadas servidor-a-servidor). El navegador del vendedor nunca puede
// tener ese secreto -- ni deberia, exponerlo en el cliente seria un hueco de
// seguridad -- asi que toda llamada desde este formulario fallaba con "No
// autorizado", capturado como el generico "No se pudo registrar el pedido.
// Intenta nuevamente.": el registro manual nunca pudo guardar un pedido
// end-to-end.
//
// Se reemplaza por un INSERT directo, protegido por la policy RLS "vendedor
// inserta pedidos" ya existente sobre public.pedidos (mismo mecanismo que ya
// usan updateEstadoPedido/cancelarPedido para otras escrituras del vendedor
// sobre esta tabla) -- la forma correcta de autorizar una escritura desde el
// navegador de un usuario autenticado. Un INSERT simple alcanza (a
// diferencia del RPC, pensado para el merge por ON CONFLICT de los webhooks
// automaticos ML/FA que pueden recibir el mismo pedido varias veces) porque
// el registro manual ya valida duplicados ANTES de llegar aca, en el paso
// "Identificar" (existePedidoDuplicado).
export async function crearPedidoManual(params: {
    cliente_id: string;
    plataforma: string;
    id_plataforma: string;
    order_id: string;
    estado: string;
    cliente_nombre: string | null;
    total_pagado: number;
    fecha_pedido: string | null;
    fecha_limite_despacho: string | null;
    etiqueta_url: string | null;
    items: Array<{
      title: string;
      quantity: number;
      unit_price: number;
      sku: string | null;
    }>;
}): Promise<CrearPedidoManualResultado> {
    const itemsConOrderId = params.items.map((item) => ({ ...item, order_id: params.order_id }));
    const montosPorOrden = params.total_pagado > 0 ? { [params.order_id]: params.total_pagado } : {};

    const { data, error } = await supabase
      .from("pedidos")
      .insert({
        cliente_id: params.cliente_id,
        plataforma: params.plataforma,
        id_plataforma: params.id_plataforma,
        order_id: params.order_id,
        estado: params.estado,
        cliente_nombre: params.cliente_nombre,
        total_pagado: params.total_pagado,
        fecha_pedido: params.fecha_pedido ?? new Date().toISOString(),
        fecha_limite_despacho: params.fecha_limite_despacho,
        etiqueta_url: params.etiqueta_url,
        items: itemsConOrderId,
        montos_por_orden: montosPorOrden,
        registro_manual: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { pedido_id: data.id };
}

export function getEtiquetaUrl(storagePath: string): string {
    const { data } = supabase.storage.from("etiquetas").getPublicUrl(storagePath);
    return data.publicUrl;
}

// ---------------------------------------------------------------------------
// Tarea: validacion de que exista la guia de despacho antes de guardar
// (creacion manual). Sigue el mismo patron que /api/orders/lookup: el
// frontend nunca habla directo con Mercado Libre/Falabella, todo pasa por un
// webhook de n8n que ya tiene las credenciales configuradas. Este workflow
// no usa Dropbox (descarga desde la API de ML/FA y sube a Supabase Storage).
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
                  mensaje: body.error || "No se pudo verificar la guía de despacho",
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

// ---------------------------------------------------------------------------
// Configuracion > Empresa. public.clientes solo tiene UPDATE via RLS para
// super_admin (ver policy "super_admin gestiona clientes"), asi que un admin
// de tenant no puede editar el perfil de su propia empresa directo con
// .update(). actualizar_perfil_empresa es un RPC SECURITY DEFINER que valida
// a mano (super_admin siempre, admin solo sobre su propio cliente_id) y solo
// deja tocar nombre/logo_url/config -- nunca plan ni activo.
// ---------------------------------------------------------------------------
export interface PerfilEmpresa {
    id: string;
    nombre: string;
    logo_url: string | null;
    rut: string;
    direccion: string;
    telefono: string;
}

export async function fetchPerfilEmpresa(clienteId: string): Promise<PerfilEmpresa | null> {
    const { data, error } = await supabase
      .from("clientes")
      .select("id, nombre, logo_url, config")
      .eq("id", clienteId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const config = (data.config as Record<string, string>) || {};
    return {
          id: data.id,
          nombre: data.nombre,
          logo_url: data.logo_url,
          rut: config.rut || "",
          direccion: config.direccion || "",
          telefono: config.telefono || "",
    };
}

export async function actualizarPerfilEmpresa(params: {
    p_cliente_id: string;
    p_nombre: string;
    p_logo_url?: string | null;
    p_rut?: string | null;
    p_direccion?: string | null;
    p_telefono?: string | null;
}): Promise<void> {
    const { error } = await supabase.rpc("actualizar_perfil_empresa", params);
    if (error) throw error;
}

// ---------------------------------------------------------------------------
// Productos: catalogo ML/Falabella sincronizado cada 15 min por los
// workflows de n8n "ML - Sync Productos" / "FA - Sync Productos" (ver
// public.productos). Mismo patron que fetchPedidos: recibe clienteId como
// parametro (nunca hardcodeado), resuelto en role-context (propio para
// roles normales, elegible en modo soporte para super_admin).
// ---------------------------------------------------------------------------
const LIMITE_PRODUCTOS_DEFAULT = 500;

export async function fetchProductos(clienteId: string): Promise<Producto[]> {
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("nombre", { ascending: true })
      .limit(LIMITE_PRODUCTOS_DEFAULT);
    if (error) throw error;
    return (data as unknown as Producto[]) ?? [];
}
