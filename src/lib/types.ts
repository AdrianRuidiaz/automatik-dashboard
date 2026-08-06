export type Plataforma = "ML" | "Falabella";

export type EstadoPedido =
    | "not_paid"
  | "pending"
  | "paid"
  | "ready_to_ship"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";

// Tipos de archivo tal como los acepta la tabla public.archivos en Supabase.
// IMPORTANTE: estos valores deben coincidir exactamente con el CHECK constraint
// de la base de datos (no son una convencion libre del frontend).
export type TipoArchivo =
    | "etiqueta"
  | "boleta"
  | "factura"
  | "nota_credito"
  | "guia_despacho"
  | "evidencia_empaque"
  | "otro";

// Subconjunto de TipoArchivo que representa "documentos tributarios" para
// efectos de la vista de Vendedor. No existe una columna/subtipo separada
// en la base de datos: se filtra directamente por estos valores de `tipo`.
export const TIPOS_DOCUMENTO_TRIBUTARIO = [
    "boleta",
    "factura",
    "nota_credito",
  ] as const;

export type TipoDocumentoTributario = (typeof TIPOS_DOCUMENTO_TRIBUTARIO)[number];

export function esDocumentoTributario(tipo: TipoArchivo): tipo is TipoDocumentoTributario {
    return (TIPOS_DOCUMENTO_TRIBUTARIO as readonly string[]).includes(tipo);
}

export type RolUsuario = "admin" | "vendedor" | "empacador";

export interface PedidoItem {
    title: string;
    quantity: number;
    unit_price: number;
    sku: string | null;
}

// Referencia minima a public.usuarios_roles, tal como viene embebida por
// Supabase al pedir `usuarios_roles(nombre)` en un select().
export interface UsuarioRef {
    nombre: string;
}

export interface Pedido {
    id: string;
    cliente_id: string;
    plataforma: Plataforma;
    id_plataforma: string;
    order_id: string;
    estado: EstadoPedido;
    cliente_nombre: string | null;
    total_pagado: number;
    fecha_pedido: string | null;
    fecha_limite_despacho: string | null;
    etiqueta_url: string | null;
    registro_manual?: boolean;
    items: PedidoItem[];
    created_at: string;
    updated_at: string;
    // Tarea: trazabilidad de cancelacion. cancelado_por es el usuarios_roles.id
    // de quien cancelo; cancelado_por_usuario viene embebido (join) solo para
    // mostrar el nombre sin una consulta aparte. Ambos son null si el pedido
    // nunca fue cancelado (o si se cancelo antes de que existiera esta columna).
    cancelado_por?: string | null;
    cancelado_en?: string | null;
    cancelado_por_usuario?: UsuarioRef | null;
}

export interface Archivo {
    id: string;
    pedido_id: string;
    tipo: TipoArchivo;
    url: string;
    nombre_archivo: string | null;
    descripcion: string | null;
    subido_por: string | null;
    created_at: string;
    // Tarea: saber que empacador subio la evidencia. Embebido (join) igual
    // que cancelado_por_usuario en Pedido. Null para archivos subidos antes
    // de esta funcionalidad (subido_por quedo sin registrar).
    subido_por_usuario?: UsuarioRef | null;
}

export interface DashboardResumen {
    total_pedidos: number;
    pedidos_ml: number;
    pedidos_fa: number;
    ingresos_totales: number;
    por_despachar: number;
    por_despachar_ml: number;
    por_despachar_fa: number;
    cancelados: number;
    monto_cancelados: number;
    ticket_promedio: number;
    tasa_cancelacion: number;
}

export interface TendenciaDiaria {
    fecha: string;
    pedidos_ml: number;
    pedidos_fa: number;
    ingresos_ml: number;
    ingresos_fa: number;
}

export const ESTADO_LABELS: Record<EstadoPedido, string> = {
    not_paid: "Sin pagar",
    pending: "Pendiente",
    paid: "Pagado",
    ready_to_ship: "Listo",
    shipped: "Enviado",
    delivered: "Entregado",
    cancelled: "Cancelado",
    returned: "Devuelto",
};

export const ESTADO_COLORS: Record<EstadoPedido, string> = {
    not_paid: "bg-slate-500/15 text-slate-300 border border-slate-500/20",
    pending: "bg-amber-500/15 text-amber-300 border border-amber-500/20",
    paid: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20",
    ready_to_ship: "bg-teal-500/15 text-teal-300 border border-teal-500/20",
    shipped: "bg-blue-500/15 text-blue-300 border border-blue-500/20",
    delivered: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20",
    cancelled: "bg-red-500/15 text-red-300 border border-red-500/20",
    returned: "bg-red-500/15 text-red-300 border border-red-500/20",
};

// Estados que se consideran "activos" para efectos de no mezclarlos
// visualmente con los cancelados (tarea: manejo de pedidos cancelados).
export const ESTADOS_ACTIVOS: EstadoPedido[] = [
    "not_paid",
    "pending",
    "paid",
    "ready_to_ship",
    "shipped",
    "delivered",
    "returned",
  ];
