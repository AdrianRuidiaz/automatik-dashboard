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
            <div className="space-y-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">Panel de control</p>
                  <h1 className="display mt-1 text-2xl sm:text-3xl">
                    Resumen de <em>operaciones</em>
                  </h1>
                </div>
                <div className="flex items-center gap-2">
                  {lastUpdate && (
                    <span className="tabular hidden text-[11px] text-muted-foreground sm:inline">
                      Actualizado {lastUpdate.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  <button onClick={loadData} aria-label="Actualizar"
                    className="rounded-lg border border-input bg-card p-2 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                    <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
                  </button>
                </div>
              </div>

              <KpiCards data={resumen} />

              <section>
                <h2 className="display mb-3 text-lg sm:text-xl">Tendencia diaria</h2>
                <div className="card-premium p-4">
                  <TrendChart data={tendencia} />
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="display text-lg sm:text-xl">Ultimos pedidos</h2>
                  <Link href="/pedidos" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    Ver todos <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="space-y-2 md:hidden">
                  {ultimos.map((p) => (
                    <Link key={p.id} href="/pedidos" className="card-premium block p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="tabular text-sm font-semibold">{p.id_plataforma}</p>
                          <p className="truncate text-xs text-muted-foreground">{p.cliente_nombre || "Sin cliente"}</p>
                        </div>
                        <span className={cn("pill shrink-0", p.plataforma === "ML" ? "bg-ml-light text-ml-dark" : "bg-fa-light text-fa-dark")}>
                          {p.plataforma === "ML" ? "ML" : "FA"}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="tabular text-sm font-medium">{formatCLP(p.total_pagado)}</span>
                        <span className={cn("pill", ESTADO_COLORS[p.estado])}>{ESTADO_LABELS[p.estado]}</span>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="card-premium hidden overflow-hidden md:block">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/40 text-left">
                        <th className="eyebrow px-4 py-2.5 font-medium">N&deg; pedido</th>
                        <th className="eyebrow px-4 py-2.5 font-medium">Plataforma</th>
                        <th className="eyebrow px-4 py-2.5 font-medium">Fecha</th>
                        <th className="eyebrow px-4 py-2.5 font-medium">Cliente</th>
                        <th className="eyebrow px-4 py-2.5 font-medium">Total</th>
                        <th className="eyebrow px-4 py-2.5 font-medium">Estado</th>
                        <th className="eyebrow px-4 py-2.5 font-medium">Etiqueta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ultimos.map((p) => (
                        <tr key={p.id} className="row-hover border-b border-border last:border-0 hover:bg-secondary/40">
                          <td className="tabular px-4 py-3 font-medium">{p.id_plataforma}</td>
                          <td className="px-4 py-3">
                            <span className={cn("pill", p.plataforma === "ML" ? "bg-ml-light text-ml-dark" : "bg-fa-light text-fa-dark")}>
                              {p.plataforma === "ML" ? "ML" : "FA"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{formatFechaCorta(p.fecha_pedido)}</td>
                          <td className="max-w-[180px] truncate px-4 py-3">{p.cliente_nombre || "Sin cliente"}</td>
                          <td className="tabular whitespace-nowrap px-4 py-3 font-medium">{formatCLP(p.total_pagado)}</td>
                          <td className="px-4 py-3">
                            <span className={cn("pill", ESTADO_COLORS[p.estado])}>{ESTADO_LABELS[p.estado]}</span>
                          </td>
                          <td className="px-4 py-3">
                            {p.etiqueta_url ? (
                              <a href={pdfUrl(p.etiqueta_url)} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
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
                  <p className="py-12 text-center text-sm text-muted-foreground">Aun no hay pedidos</p>
                )}
              </section>
            </div>
          )}

          {rol === "empacador" && (
            <div className="space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">Bodega</p>
                  <h1 className="display mt-1 text-2xl sm:text-3xl">Pedidos por <em>empacar</em></h1>
                </div>
                <span className="tabular rounded-full bg-secondary px-3 py-1 text-sm font-medium">{pendientes.length}</span>
              </div>
              {pendientes.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No hay pedidos pendientes de empaque</p>
              ) : (
                <div className="space-y-3">
                  {pendientes.map((p) => <PackingCard key={p.id} pedido={p} onConfirm={loadData} />)}
                </div>
              )}
            </div>
          )}

          {rol === "vendedor" && (
            <div className="space-y-5">
              <div>
                <p className="eyebrow">Ventas</p>
                <h1 className="display mt-1 text-2xl sm:text-3xl">Gestion de <em>documentos</em></h1>
              </div>
              <div className="flex gap-0.5 rounded-xl bg-secondary/70 p-1">
                <button onClick={() => setVendedorTab("docs")}
                  className={cn("flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all sm:flex-none sm:px-4 sm:text-sm",
                    vendedorTab === "docs" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  Documentos tributarios
                </button>
                <button onClick={() => setVendedorTab("manual")}
                  className={cn("flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all sm:flex-none sm:px-4 sm:text-sm",
                    vendedorTab === "manual" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
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
