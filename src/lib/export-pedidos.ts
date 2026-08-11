import * as XLSX from "xlsx";
import { formatFechaCorta } from "@/lib/utils";
import { ESTADO_LABELS } from "@/lib/types";
import type { Pedido } from "@/lib/types";

// Etiqueta "3x Producto (SKU: ABC)" usada tanto en las exportaciones como
// en cualquier resumen de texto plano de los items de un pedido.
function itemLabel(i: { quantity: number; title: string; sku?: string | null }) {
  return `${i.quantity}x ${i.title}${i.sku ? ` (SKU: ${i.sku})` : ""}`;
}

// Exporta la lista de pedidos que se le pase (ya filtrada/buscada por la
// tabla) a un CSV descargable. Todo se genera en el navegador, no pega a
// ningun backend.
export function exportarPedidosCSV(pedidos: Pedido[]) {
  const headers = ["N° pedido", "Plataforma", "Fecha", "Cliente", "Total", "Estado", "Items", "Etiqueta"];

  const escape = (valor: unknown) => `"${String(valor ?? "").replace(/"/g, '""')}"`;

  const filas = pedidos.map((p) => [
    p.id_plataforma,
    p.plataforma,
    p.fecha_pedido ? formatFechaCorta(p.fecha_pedido) : "",
    p.cliente_nombre ?? "",
    p.total_pagado,
    ESTADO_LABELS[p.estado] ?? p.estado,
    (p.items ?? []).map(itemLabel).join(" | "),
    p.etiqueta_url ? "Si" : "No",
  ]);

  const csv = [headers, ...filas].map((fila) => fila.map(escape).join(",")).join("\r\n");
  // BOM para que Excel detecte UTF-8 y no rompa tildes/ñ.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pedidos_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Mismo dato que el CSV pero como .xlsx real (SheetJS), con anchos de
// columna, formato moneda en Total, autofiltro y encabezado congelado --
// para que se sienta como una planilla de verdad y no un volcado plano.
export function exportarPedidosXLSX(pedidos: Pedido[]) {
  const filas = pedidos.map((p) => ({
    "N° pedido": p.id_plataforma,
    "Plataforma": p.plataforma,
    "Fecha": p.fecha_pedido ? formatFechaCorta(p.fecha_pedido) : "",
    "Cliente": p.cliente_nombre ?? "",
    "Total": p.total_pagado,
    "Estado": ESTADO_LABELS[p.estado] ?? p.estado,
    "Items": (p.items ?? []).map(itemLabel).join(" | "),
    "Etiqueta": p.etiqueta_url ? "Si" : "No",
  }));

  const ws = XLSX.utils.json_to_sheet(filas);

  ws["!cols"] = [
    { wch: 14 }, // N° pedido
    { wch: 10 }, // Plataforma
    { wch: 12 }, // Fecha
    { wch: 24 }, // Cliente
    { wch: 12 }, // Total
    { wch: 12 }, // Estado
    { wch: 50 }, // Items
    { wch: 10 }, // Etiqueta
  ];

  // Formato moneda (CLP, sin decimales) solo en la columna Total (indice 4).
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let row = range.s.r + 1; row <= range.e.r; row++) {
    const cellRef = XLSX.utils.encode_cell({ r: row, c: 4 });
    if (ws[cellRef]) ws[cellRef].z = '"$"#,##0';
  }

  ws["!autofilter"] = { ref: ws["!ref"] || "A1" };
  ws["!views"] = [{ state: "frozen", ySplit: 1 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
  XLSX.writeFile(wb, `pedidos_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
