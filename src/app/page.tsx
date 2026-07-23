"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { PackingCard } from "@/components/empacador/packing-card";
import { TaxDocsTable } from "@/components/vendedor/tax-docs-table";
import { ManualOrderForm } from "@/components/vendedor/manual-order-form";
import { supabase } from "@/lib/supabase";
import { fetchPedidos, fetchDashboardResumen, fetchTendenciaDiaria } from "@/lib/api";
import type { Pedido, DashboardResumen, TendenciaDiaria, RolUsuario } from "@/lib/types";
import { formatCLP, formatFechaCorta, cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowRight, FileText, RefreshCw } from "lucide-react";
import { ESTADO_LABELS, ESTADO_COLORS } from "@/lib/types";

const pdfUrl = (url: string) => `/api/pdf?url=${encodeURIComponent(url)}`;

export default function HomePage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [resumen, setResumen] = useState<DashboardResumen | null>(null);
  const [tendencia, setTendencia] = useState<TendenciaDiaria[]>([]);
  const [vendedorTab, setVendedorTab] = useState<"docs" | "manual">("docs");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [p, r, t] = await Promise.all([fetchPedidos(), fetchDashboardResumen(), fetchTendenciaDiaria(7)]);
      setPedidos(p); setResumen(r); setTendencia(t); setLastUpdate(new Date());
    } catch (err) { console.error("Error cargando datos:", err); }
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const ch = supabase.channel("pedidos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadData]);

  const pendientes = pedidos.filter((p) => ["pending", "paid", "ready_to_ship"].includes(p.estado));
  const ultimos = pedidos.slice(0, 5);

  return (
    <AppShell>
      {(rol: RolUsuario) => (
        <>
          {rol === "admin" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold sm:text-lg">Resumen del periodo</h2>
                <div className="flex items-center gap-2">
                  {lastUpdate && (
                    <span className="hidden text-[11px] text-muted-foreground sm:inline">
                      {lastUpdate.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  <button onClick={loadData} aria-label="Actualizar"
                    className="rounded-md border border-input p-1.5 text-muted-foreground hover:bg-secondary">
                    <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
                  </button>
                </div>
              </div>

              <KpiCards data={resumen} />

              <div>
                <h2 className="mb-3 text-base font-semibold">Tendencia diaria</h2>
                <TrendChart data={tendencia} />
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-semibold">Ultimos pedidos</h2>
                  <Link href="/pedidos" className="flex items-center gap-1 text-xs font-medium text-primary">
                    Ver todos <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                {/* MOVIL: tarjetas */}
                <div className="space-y-2 md:hidden">
                  {ultimos.map((p) => (
                    <Link key={p.id} href="/pedidos" className="block rounded-xl border border-border bg-card p-3">
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
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", ESTADO_COLORS[p.estado])}>
                          {ESTADO_LABELS[p.estado]}
                        </span>
                      </div>
                    </Link>
                  ))}
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
                        <th className="border-b border-border px-2 py-2 font-normal">Estado</th>
                        <th className="border-b border-border px-2 py-2 font-normal">Etiqueta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ultimos.map((p) => (
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
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", ESTADO_COLORS[p.estado])}>
                              {ESTADO_LABELS[p.estado]}
                            </span>
                          </td>
                          <td className="px-2 py-2.5">
                            {p.etiqueta_url ? (
                              <a href={pdfUrl(p.etiqueta_url)} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded border border-input px-2 py-1 text-xs text-muted-foreground hover:bg-secondary">
                                <FileText className="h-3.5 w-3.5 text-rose-500" /> PDF
                              </a>
                            ) : <span className="text-xs text-muted-foreground">Sin etiqueta</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {ultimos.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">Aun no hay pedidos</p>
                )}
              </div>
            </div>
          )}

          {rol === "empacador" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Pedidos por empacar</h2>
                <span className="text-xs text-muted-foreground">{pendientes.length}</span>
              </div>
              {pendientes.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No hay pedidos pendientes de empaque</p>
              ) : pendientes.map((p) => <PackingCard key={p.id} pedido={p} onConfirm={loadData} />)}
            </div>
          )}

          {rol === "vendedor" && (
            <div>
              <div className="mb-5 flex gap-0.5 rounded-lg bg-secondary/60 p-0.5">
                <button onClick={() => setVendedorTab("docs")}
                  className={cn("flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:flex-none sm:text-sm",
                    vendedorTab === "docs" ? "bg-background shadow-sm" : "text-muted-foreground")}>
                  Documentos
                </button>
                <button onClick={() => setVendedorTab("manual")}
                  className={cn("flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:flex-none sm:text-sm",
                    vendedorTab === "manual" ? "bg-background shadow-sm" : "text-muted-foreground")}>
                  Pedido manual
                </button>
              </div>
              {vendedorTab === "docs" ? <TaxDocsTable pedidos={pedidos} /> : <ManualOrderForm />}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
