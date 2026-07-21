"use client";

import { useState, useRef } from "react";
import {
  FileCheck,
  FileMinus,
  AlertCircle,
  Upload,
  Eye,
} from "lucide-react";
import { cn, formatCLP, formatFechaCorta } from "@/lib/utils";
import { uploadArchivo, registrarArchivo, fetchArchivos } from "@/lib/api";
import type { Pedido, Archivo, TipoDocumento } from "@/lib/types";

interface TaxDocsTableProps {
  pedidos: Pedido[];
}

const DOC_LABELS: Record<TipoDocumento, { label: string; className: string }> = {
  boleta: { label: "Boleta", className: "bg-blue-100 text-blue-800" },
  factura: { label: "Factura", className: "bg-teal-100 text-teal-800" },
  nota_credito: { label: "Nota de crédito", className: "bg-amber-100 text-amber-800" },
};

export function TaxDocsTable({ pedidos }: TaxDocsTableProps) {
  const [filter, setFilter] = useState<"all" | "sin" | TipoDocumento>("all");
  const [docs, setDocs] = useState<Record<string, Archivo[]>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<TipoDocumento>("boleta");
  const fileRef = useRef<HTMLInputElement>(null);

  const getDoc = (pedidoId: string): Archivo | undefined =>
    (docs[pedidoId] ?? []).find((a) => a.tipo === "documento_tributario");

  const handleUpload = async (pedido: Pedido, file: File) => {
    setUploading(pedido.id);
    try {
      const path = `${pedido.id_plataforma}/${selectedType}_${file.name}`;
      await uploadArchivo("documentos", path, file);
      await registrarArchivo({
        pedido_id: pedido.id,
        tipo: "documento_tributario",
        subtipo: selectedType,
        storage_path: path,
        nombre_archivo: file.name,
      });
      const archivos = await fetchArchivos(pedido.id);
      setDocs((prev) => ({ ...prev, [pedido.id]: archivos }));
      setShowUpload(null);
    } catch (err) {
      console.error("Error subiendo documento:", err);
    } finally {
      setUploading(null);
    }
  };

  const filters: { key: typeof filter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "sin", label: "Sin documento" },
    { key: "boleta", label: "Boleta" },
    { key: "factura", label: "Factura" },
    { key: "nota_credito", label: "Nota de crédito" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs transition-colors",
              filter === f.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-input text-muted-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="border-b border-border px-2 py-2 font-normal">N° pedido</th>
            <th className="border-b border-border px-2 py-2 font-normal">Plat.</th>
            <th className="border-b border-border px-2 py-2 font-normal">Fecha</th>
            <th className="border-b border-border px-2 py-2 font-normal">Cliente</th>
            <th className="border-b border-border px-2 py-2 font-normal">Total</th>
            <th className="border-b border-border px-2 py-2 font-normal">Documento</th>
            <th className="border-b border-border px-2 py-2 font-normal">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map((p) => {
            const doc = getDoc(p.id);
            return (
              <tr key={p.id} className="border-b border-border">
                <td className="px-2 py-2 font-medium">{p.id_plataforma}</td>
                <td className="px-2 py-2">
                  <span className={cn("rounded px-2 py-0.5 text-[11px]",
                    p.plataforma === "ML" ? "bg-ml-light text-ml-dark" : "bg-fa-light text-fa-dark"
                  )}>
                    {p.plataforma === "ML" ? "ML" : "FA"}
                  </span>
                </td>
                <td className="px-2 py-2">{formatFechaCorta(p.fecha_pedido)}</td>
                <td className="px-2 py-2">{p.cliente_nombre ?? "—"}</td>
                <td className="px-2 py-2">{formatCLP(p.total_pagado)}</td>
                <td className="px-2 py-2">
                  {doc && doc.subtipo ? (
                    <span className={cn("inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px]",
                      DOC_LABELS[doc.subtipo as TipoDocumento]?.className
                    )}>
                      <FileCheck className="h-3 w-3" />
                      {DOC_LABELS[doc.subtipo as TipoDocumento]?.label}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <AlertCircle className="h-3 w-3" /> Sin documento
                    </span>
                  )}
                </td>
                <td className="px-2 py-2">
                  {doc ? (
                    <button className="inline-flex items-center gap-1 rounded border border-input px-2 py-0.5 text-xs text-muted-foreground hover:bg-secondary">
                      <Eye className="h-3 w-3" /> Ver
                    </button>
                  ) : showUpload === p.id ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value as TipoDocumento)}
                        className="rounded border border-input bg-transparent px-1 py-0.5 text-xs"
                      >
                        <option value="boleta">Boleta</option>
                        <option value="factura">Factura</option>
                        <option value="nota_credito">N. crédito</option>
                      </select>
                      <button
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading === p.id}
                        className="inline-flex items-center gap-1 rounded border border-primary px-2 py-0.5 text-xs text-primary"
                      >
                        <Upload className="h-3 w-3" />
                        {uploading === p.id ? "..." : "Archivo"}
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUpload(p, f);
                        }}
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowUpload(p.id)}
                      className="inline-flex items-center gap-1 rounded border border-primary px-2 py-0.5 text-xs text-primary"
                    >
                      <Upload className="h-3 w-3" /> Subir
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
