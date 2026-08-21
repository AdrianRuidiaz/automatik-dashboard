"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ChevronDown, ChevronRight, Camera, Package, CheckCircle, Clock, Search, UserCheck } from "lucide-react";
import { cn, formatCLP, formatFechaCorta } from "@/lib/utils";
import { fetchArchivos } from "@/lib/api";
import type { Pedido, Archivo } from "@/lib/types";

interface PackingHistoryProps {
  pedidos: Pedido[];
}

function EvidenciaExpandible({ pedido }: { pedido: Pedido }) {
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    fetchArchivos(pedido.id)
      .then(setArchivos)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [pedido.id]);

  // tipo real en la base de datos es "evidencia_empaque" (ver public.archivos)
  const evidencias = archivos.filter((a) => a.tipo === "evidencia_empaque");

  // Todas las fotos de un mismo pedido normalmente las sube la misma persona
  // en la misma sesion de empaque, asi que basta con mostrar un nombre por
  // pedido (el primero que tenga subido_por_usuario resuelto) en vez de
  // repetirlo foto por foto. Queda vacio para evidencia subida antes de que
  // existiera esta trazabilidad (subido_por sin registrar).
  const empacadoPor = evidencias.find((e) => e.subido_por_usuario?.nombre)?.subido_por_usuario?.nombre;

  return (
    <div className="border-t border-border bg-secondary/30 px-3 py-4 sm:px-4 animate-in slide-in-from-top-1 duration-200">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Items */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            <Package className="h-3 w-3" /> Items del pedido
          </p>
          {(pedido.items ?? []).length > 0 ? (
            <div className="space-y-1.5">
              {pedido.items.map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-2 text-sm">
                  <span className="flex-1">
                    <span className="mr-1.5 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      x{item.quantity}
                    </span>
                    {item.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatCLP(item.unit_price)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-1.5 text-sm font-medium">
                <span>Total</span>
                <span>{formatCLP(pedido.total_pagado)}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sin items registrados</p>
          )}
        </div>

        {/* Evidencias */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            <Camera className="h-3 w-3" /> Evidencias de empaque
          </p>
          {loading ? (
            <p className="text-xs text-muted-foreground">Cargando...</p>
          ) : evidencias.length > 0 ? (
            <>
              {empacadoPor && (
                <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <UserCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  Empacado por <span className="font-medium text-foreground">{empacadoPor}</span>
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {evidencias.map((ev) => {
                  // ev.url ya es la URL publica completa (la guarda asi
                  // registrarArchivo) -- no volver a pasarla por
                  // getPublicUrl(), que la trataria como un path relativo
                  // y armaria una URL rota (completa anidada en otra).
                  const url = ev.url;
                  return (
                    <button
                      key={ev.id}
                      onClick={() => setLightbox(url)}
                      className="group relative h-24 w-24 overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/40 hover:shadow-md active:scale-95"
                    >
                      <Image
                        src={url}
                        alt={ev.nombre_archivo ?? "Evidencia"}
                        fill
                        sizes="96px"
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Sin evidencias subidas</p>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Evidencia ampliada"
            className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export function PackingHistory({ pedidos }: PackingHistoryProps) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState("");

  const toggle = (id: string) => {
    setAbiertos((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  // Tarea: empacado_en (no estado) es la fuente de verdad de "ya se empaco
  // en Automatik" -- mismo criterio que src/app/page.tsx. Antes filtraba por
  // estado in (shipped, delivered), lo que sacaba pedidos de este historial
  // (o los metia) segun lo que reportara la resincronizacion de ML/Falabella,
  // sin relacion con si el empacador realmente confirmo el empaque.
  const completados = pedidos
    .filter((p) => !!p.empacado_en)
    .sort((a, b) => {
      const da = a.empacado_en || a.updated_at || a.fecha_pedido || "";
      const db = b.empacado_en || b.updated_at || b.fecha_pedido || "";
      return db.localeCompare(da);
    });

  const visibles = completados.filter((p) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return (
      p.id_plataforma.toLowerCase().includes(q) ||
      (p.cliente_nombre || "").toLowerCase().includes(q) ||
      (p.items ?? []).some((it) => it.title.toLowerCase().includes(q))
    );
  });

  if (completados.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Aun no hay pedidos empacados en el historial
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 max-w-xs flex-1 items-center gap-2 rounded-lg border border-input bg-card px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en historial..."
            className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <span className="text-xs text-muted-foreground">{visibles.length} empacados</span>
      </div>

      <div className="space-y-2">
        {visibles.map((p) => {
          const abierto = abiertos.has(p.id);
          return (
            <div
              key={p.id}
              className={cn(
                "overflow-hidden rounded-xl border border-border bg-card transition-all",
                abierto && "ring-1 ring-primary/15"
              )}
            >
              <button
                onClick={() => toggle(p.id)}
                className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-secondary/40 sm:px-4"
              >
                <span className="shrink-0 text-muted-foreground">
                  {abierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold tabular">{p.id_plataforma}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        p.plataforma === "ML" ? "bg-ml-light text-ml-dark" : "bg-fa-light text-fa-dark"
                      )}
                    >
                      {p.plataforma === "ML" ? "ML" : "FA"}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {p.cliente_nombre || "Sin cliente"} &middot; {formatFechaCorta(p.fecha_pedido)}
                  </span>
                </span>

                <span className="hidden shrink-0 text-sm font-medium tabular sm:block">
                  {formatCLP(p.total_pagado)}
                </span>

                <span className="shrink-0">
                  {p.estado === "delivered" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                      <CheckCircle className="h-3 w-3" />
                      <span className="hidden sm:inline">Entregado</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                      <Clock className="h-3 w-3" />
                      <span className="hidden sm:inline">Enviado</span>
                    </span>
                  )}
                </span>
              </button>

              {abierto && <EvidenciaExpandible pedido={p} />}
            </div>
          );
        })}
      </div>

      {visibles.length === 0 && busqueda && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Sin resultados para &ldquo;{busqueda}&rdquo;
        </p>
      )}
    </div>
  );
}
