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
  pending: "bg-amber-100 text-amber-800",
  paid: "bg-green-100 text-green-800",
  ready_to_ship: "bg-teal-100 text-teal-800",
  shipped: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  returned: "bg-red-100 text-red-800",
};
