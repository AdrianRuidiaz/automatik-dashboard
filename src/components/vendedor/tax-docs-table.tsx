"use client";

import { useState, useRef, useEffect } from "react";
import { FileCheck, AlertCircle, Upload, Eye, Loader2 } from "lucide-react";
import { cn, formatCLP, formatFechaCorta } from "@/lib/utils";
import { uploadArchivo, registrarArchivo, fetchArchivos } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Pedido, Archivo, TipoDocumento } from "@/lib/types";

interface TaxDocsTableProps { pedidos: Pedido[]; }

const DOC_LABELS: Record<TipoDocumento, { label: string; className: string }> = {
  boleta: { label: "Boleta", className: "bg-blue-50 text-blue-700" },
  factura: { label: "Factura", className: "bg-emerald-50 text-emerald-700" },
  nota_credito: { label: "Nota de credito", className: "bg-amber-50 text-amber-700" },
};

export function TaxDocsTable({ pedidos }: TaxDocsTableProps) {
  const [filter, setFilter] = useState<"all" | "sin" | TipoDocumento>("all");
  const [docs, setDocs] = useState<Record<string, Archivo | undefined>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [activo, setActivo] = useState<string | null>(null);
  const [tipoSel, setTipoSel] = useState<TipoDocumento>("boleta");
  const fileRef = useRef<HTMLInputElement>(null);
  const pendienteRef = useRef<Pedido | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const entries = await Promise.all(
        pedidos.slice(0, 60).map(async (p) => {
          try {
            const arch = await fetchArchivos(p.id);
            return [p.id, arch.find((a) => a.tipo === "documento_tributario")] as const;
          } catch { return [p.id, undefined] as const; }
        })
      );
      if (!cancel) setDocs(Object.fromEntries(entries));
    })();
    return () => { cancel = true; };
  }, [pedidos]);

  const publicUrl = (path: string) => supabase.storage.from("documentos").getPublicUrl(path).data.publicUrl;

  const handleFile = async (file: File) => {
    const pedido = pendienteRef.current;
    if (!pedido) return;
    setUploading(pedido.id);
    try {
      const path = `${pedido.id_plataforma}/${tipoSel}_${file.name}`;
      await uploadArchivo("documentos", path, file);
      await registrarArchivo({
        pedido_id: pedido.id,
        tipo: "documento_tributario",
        subtipo: tipoSel,
        storage_path: path,
        nombre_archivo: file.name,
      });
      const arch = await fetchArchivos(pedido.id);
      setDocs((prev) => ({ ...prev, [pedido.id]: arch.find((a) => a.tipo === "documento_tributario") }));
      setActivo(null);
    } catch (e) { console.error(e); }
    finally { setUploading(null); pendienteRef.current = null; if (fileRef.current) fileRef.current.value = ""; }
  };

  const visibles = pedidos.filter((p) => {
    const d = docs[p.id];
    if (filter === "all") return true;
    if (filter === "sin") return !d;
    return d?.subtipo === filter;
  });

  const filtros: { key: typeof filter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "sin", label: "Sin documento" },
    { key: "boleta", label: "Boleta" },
    { key: "factura", label: "Factura" },
    { key: "nota_credito", label: "N. credito" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {filtros.map((f) => (
          <button key={String(f.key)} onClick={() => setFilter(f.key)}
            className={cn("rounded-md border px-2.5 py-1.5 text-xs transition-colors",
              filter === f.key ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground")}>
            {f.label}
          </button>
        ))}
      </div>

      <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

      {/* MOVIL: tarjetas */}
      <div className="space-y-2 md:hidden">
        {visibles.map((p) => {
          const doc = docs[p.id];
          return (
            <div key={p.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{p.id_plataforma}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.cliente_nombre || "Sin cliente"}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  p.plataforma === "ML" ? "bg-ml-light text-ml-dark" : "bg-fa-light text-fa-dark")}>
                  {p.plataforma === "ML" ? "ML" : "FA"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{formatCLP(p.total_pagado)}</span>
                {doc?.subtipo ? (
                  <a href={publicUrl(doc.storage_path)} target="_blank" rel="noopener noreferrer"
                    className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium", DOC_LABELS[doc.subtipo as TipoDocumento]?.className)}>
                    <FileCheck className="h-3 w-3" /> {DOC_LABELS[doc.subtipo as TipoDocumento]?.label}
                  </a>
                ) : activo === p.id ? (
                  <div className="flex items-center gap-1.5">
                    <select value={tipoSel} onChange={(e) => setTipoSel(e.target.value as TipoDocumento)}
                      className="rounded border border-input bg-background px-1.5 py-1 text-xs">
                      <option value="boleta">Boleta</option>
                      <option value="factura">Factura</option>
                      <option value="nota_credito">N. credito</option>
                    </select>
                    <button onClick={() => { pendienteRef.current = p; fileRef.current?.click(); }}
                      disabled={uploading === p.id}
                      className="inline-flex items-center gap-1 rounded border border-primary px-2 py-1 text-xs text-primary">
                      {uploading === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setActivo(p.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-primary px-2.5 py-1.5 text-xs text-primary">
                    <Upload className="h-3 w-3" /> Subir
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ESCRITORIO: tabla */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="border-b border-border px-2 py-2 font-normal">N&deg; pedido</th>
              <th className="border-b border-border px-2 py-2 font-normal">Plat.</th>
              <th className="border-b border-border px-2 py-2 font-normal">Fecha</th>
              <th className="border-b border-border px-2 py-2 font-normal">Cliente</th>
              <th className="border-b border-border px-2 py-2 font-normal">Total</th>
              <th className="border-b border-border px-2 py-2 font-normal">Documento</th>
              <th className="border-b border-border px-2 py-2 font-normal">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((p) => {
              const doc = docs[p.id];
              return (
                <tr key={p.id} className="border-b border-border hover:bg-secondary/40">
                  <td className="px-2 py-2.5 font-medium">{p.id_plataforma}</td>
                  <td className="px-2 py-2.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium",
                      p.plataforma === "ML" ? "bg-ml-light text-ml-dark" : "bg-fa-light text-fa-dark")}>
                      {p.plataforma === "ML" ? "ML" : "FA"}
                    </span>
                  </td>
                  <td className="px-2 py-2.5">{formatFechaCorta(p.fecha_pedido)}</td>
                  <td className="max-w-[180px] truncate px-2 py-2.5">{p.cliente_nombre || "Sin cliente"}</td>
                  <td className="px-2 py-2.5 whitespace-nowrap">{formatCLP(p.total_pagado)}</td>
                  <td className="px-2 py-2.5">
                    {doc?.subtipo ? (
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", DOC_LABELS[doc.subtipo as TipoDocumento]?.className)}>
                        <FileCheck className="h-3 w-3" /> {DOC_LABELS[doc.subtipo as TipoDocumento]?.label}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <AlertCircle className="h-3 w-3" /> Sin documento
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2.5">
                    {doc ? (
                      <a href={publicUrl(doc.storage_path)} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded border border-input px-2 py-1 text-xs text-muted-foreground hover:bg-secondary">
                        <Eye className="h-3 w-3" /> Ver
                      </a>
                    ) : activo === p.id ? (
                      <div className="flex items-center gap-1.5">
                        <select value={tipoSel} onChange={(e) => setTipoSel(e.target.value as TipoDocumento)}
                          className="rounded border border-input bg-background px-1.5 py-1 text-xs">
                          <option value="boleta">Boleta</option>
                          <option value="factura">Factura</option>
                          <option value="nota_credito">N. credito</option>
                        </select>
                        <button onClick={() => { pendienteRef.current = p; fileRef.current?.click(); }}
                          disabled={uploading === p.id}
                          className="inline-flex items-center gap-1 rounded border border-primary px-2 py-1 text-xs text-primary">
                          {uploading === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Upload className="h-3 w-3" /> Archivo</>}
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setActivo(p.id)}
                        className="inline-flex items-center gap-1 rounded border border-primary px-2 py-1 text-xs text-primary">
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

      {visibles.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No hay pedidos con ese filtro</p>
      )}
    </div>
  );
}
