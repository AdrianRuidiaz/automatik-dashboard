import { supabase } from "./supabase";
import type { Pedido, DashboardResumen, TendenciaDiaria, Archivo } from "./types";

const CLIENTE_ID = process.env.NEXT_PUBLIC_CLIENTE_ID!;

export async function fetchPedidos(): Promise<Pedido[]> {
  const { data, error } = await supabase
    .from("pedidos")
    .select("*")
    .eq("cliente_id", CLIENTE_ID)
    .order("fecha_pedido", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPedido(id: string): Promise<Pedido | null> {
  const { data, error } = await supabase
    .from("pedidos")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchPedidoByPlataforma(
  idPlataforma: string
): Promise<Pedido | null> {
  const { data, error } = await supabase
    .from("pedidos")
    .select("*")
    .eq("id_plataforma", idPlataforma)
    .eq("cliente_id", CLIENTE_ID)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchDashboardResumen(): Promise<DashboardResumen | null> {
  const { data, error } = await supabase
    .from("v_dashboard_resumen")
    .select("*")
    .eq("cliente_id", CLIENTE_ID)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchTendenciaDiaria(
  dias = 7
): Promise<TendenciaDiaria[]> {
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  const { data, error } = await supabase
    .from("v_tendencia_diaria")
    .select("*")
    .eq("cliente_id", CLIENTE_ID)
    .gte("fecha", desde.toISOString().slice(0, 10))
    .order("fecha", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchArchivos(pedidoId: string): Promise<Archivo[]> {
  const { data, error } = await supabase
    .from("archivos")
    .select("*")
    .eq("pedido_id", pedidoId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
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

export async function registrarArchivo(archivo: {
  pedido_id: string;
  tipo: Archivo["tipo"];
  subtipo?: string | null;
  storage_path: string;
  nombre_archivo: string;
}): Promise<void> {
  const { error } = await supabase.from("archivos").insert(archivo);
  if (error) throw error;
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
}): Promise<void> {
  const { error } = await supabase.rpc("upsert_pedido", params);
  if (error) throw error;
}

export function getEtiquetaUrl(storagePath: string): string {
  const { data } = supabase.storage.from("etiquetas").getPublicUrl(storagePath);
  return data.publicUrl;
}
