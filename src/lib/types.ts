export type Plataforma = "ML" | "Falabella";

export type EstadoPedido =
  | "pending"
  | "paid"
  | "ready_to_ship"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";

export type TipoDocumento = "boleta" | "factura" | "nota_credito";

export type RolUsuario = "admin" | "vendedor" | "empacador";

export interface PedidoItem {
  title: string;
  quantity: number;
  unit_price: number;
  sku: string | null;
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
  items: PedidoItem[];
  created_at: string;
  updated_at: string;
}

export interface Archivo {
  id: string;
  pedido_id: string;
  tipo: "etiqueta" | "evidencia" | "documento_tributario";
  subtipo: TipoDocumento | null;
  storage_path: string;
  nombre_archivo: string;
  created_at: string;
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
  pending: "Pendiente",
  paid: "Pagado",
  ready_to_ship: "Listo",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
  returned: "Devuelto",
};

export const ESTADO_COLORS: Record<EstadoPedido, string> = {
  pending: "bg-amber-500/15 text-amber-300 border border-amber-500/20",
  paid: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20",
  ready_to_ship: "bg-teal-500/15 text-teal-300 border border-teal-500/20",
  shipped: "bg-blue-500/15 text-blue-300 border border-blue-500/20",
  delivered: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20",
  cancelled: "bg-red-500/15 text-red-300 border border-red-500/20",
  returned: "bg-red-500/15 text-red-300 border border-red-500/20",
};
