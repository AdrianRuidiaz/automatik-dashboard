"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/app-shell";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { KpiRangeFilter } from "@/components/dashboard/kpi-range-filter";
import { SearchBar } from "@/components/empacador/search-bar";
import { fetchPedidos, fetchDashboardKpisRango, fetchTendenciaDiaria } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { useRealtimeTable } from "@/lib/hooks/use-realtime-table";
import { RANGO_KPI_DEFAULT, calcularRangoFechas, type RangoKpi } from "@/lib/date-ranges";
import type { Pedido, DashboardResumen, TendenciaDiaria, RolUsuario } from "@/lib/types";
import { formatCLP, formatFechaCorta, cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowRight, FileText, RefreshCw, AlertTriangle, Clock, Package, Inbox, PackageCheck } from "lucide-react";
import { ESTADO_LABELS, ESTADO_COLORS } from "@/lib/types";
import { EstadoVacio } from "@/components/ui/estado-vacio";

// Code-splitting por rol: HomePage renderiza UNA sola de las tres ramas de
// abajo (admin / empacador / vendedor) segun useRole(), pero antes las
// importaba las tres de forma estatica -- cualquier usuario, sin importar
// su rol, descargaba en el bundle inicial recharts (TrendChart, solo
// admin), el flujo de camara/upload de evidencia (PackingCard/
// PackingHistory, solo empacador) y las tablas/formularios de ventas
// (TaxDocsTable/ManualOrderForm, solo vendedor). Con next/dynamic cada uno
// pasa a su propio chunk que solo se pide cuando el rol activo realmente
// necesita renderizarlo. ssr:false porque son piezas interactivas
// (graficos, camara, formularios) sin contenido critico para SEO/first
// paint -- coherente con que toda esta pagina ya es "use client".
const TrendChart = dynamic(
  () => import("@/components/dashboard/trend-chart").then((m) => m.TrendChart),
  { ssr: false, loading: () => <div className="skeleton h-[220px] w-full" /> }
);

const PackingCard = dynamic(
  () => import("@/components/empacador/packing-card").then((m) => m.PackingCard),
  { ssr: false, loading: () => <div className="skeleton h-40 w-full" /> }
);

const PackingHistory = dynamic(
  () => import("@/components/empacador/packing-history").then((m) => m.PackingHistory),
  { ssr: false, loading: () => <div className="skeleton h-40 w-full" /> }
);

const TaxDocsTable = dynamic(
  () => import("@/components/vendedor/tax-docs-table").then((m) => m.TaxDocsTable),
  { ssr: false, loading: () => <div className="skeleton h-64 w-full" /> }
);

const ManualOrderForm = dynamic(
  () => import("@/components/vendedor/manual-order-form").then((m) => m.ManualOrderForm),
  { ssr: false, loading: () => <div className="skeleton h-64 w-full" /> }
);

const pdfUrl = (url: string) => `/api/pdf?url=${encodeURIComponent(url)}`;

export default function HomePage() {
  const { clienteId } = useRole();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [resumen, setResumen] = useState<DashboardResumen | null>(null);
  const [resumenAnterior, setResumenAnterior] = useState<DashboardResumen | null>(null);
  // Tarea: filtro de rango de fechas de las tarjetas KPI. Default "1 mes"
  // (no "todo el historico") -- ver RANGO_KPI_DEFAULT en lib/date-ranges.
  const [rangoKpi, setRangoKpi] = useState<RangoKpi>(RANGO_KPI_DEFAULT);
  const [tendencia, setTendencia] = useState<TendenciaDiaria[]>([]);
  const [vendedorTab, setVendedorTab] = useState<"docs" | "manual">("docs");
  const [empacadorTab, setEmpacadorTab] = useState<"pendientes" | "historial">("pendientes");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const loadData = useCallback(async () => {
    if (!clienteId) return;
    setRefreshing(true);
    try {
      const { desde, hasta, prevDesde, prevHasta } = calcularRangoFechas(rangoKpi);
      const [p, r, rPrev, t] = await Promise.all([
        fetchPedidos(clienteId),
        fetchDashboardKpisRango(clienteId, desde, hasta),
        fetchDashboardKpisRango(clienteId, prevDesde, prevHasta),
        fetchTendenciaDiaria(clienteId, 7),
      ]);
      setPedidos(p); setResumen(r); setResumenAnterior(rPrev); setTendencia(t); setLastUpdate(new Date());
    } catch (err) { console.error("Error cargando datos:", err); }
    finally { setRefreshing(false); }
  }, [clienteId, rangoKpi]);

  useEffect(() => { loadData(); }, [loadData]);

  // NOTA: la suscripcion tiene que filtrar por cliente_id. Sin el filtro,
  // un cambio en pedidos de CUALQUIER cliente (incluye la sincronizacion
  // periodica de n8n) recarga todo para todos los usuarios conectados, sin
  // importar a que cliente pertenecen -- eso se sentia como carga lenta o
  // que la pagina "nunca termina", sobre todo en redes moviles.
  //
  // Ademas, aunque el cambio sea del cliente correcto, procesos por lotes
  // (ej. migracion de etiquetas) pueden actualizar muchos pedidos seguidos
  // en pocos segundos -- cada UPDATE dispara el callback y sin proteccion
  // se hacen N recargas completas en cadena. Se agrupan con un debounce:
  // solo se recarga una vez, 800ms despues del ultimo cambio detectado.
  // (extraido a src/lib/hooks/use-realtime-table.ts -- mismo canal, tabla,
  // filtro y debounce que antes, solo cambia la ubicacion del codigo)
  useRealtimeTable({
    table: "pedidos",
    clienteId,
    onChange: loadData,
    channelName: "pedidos-realtime",
  });

  // Tarea: la cola "Por empacar" y el "Historial" del empacador se separaban
  // por pedidos.estado -- eso se rompia en cuanto algo MAS que el empacador
  // tambien tocaba estado. Concretamente: los workflows de n8n resincronizan
  // el estado real desde ML/Falabella cada pocos minutos, y si la plataforma
  // ya reportaba "shipped" (aunque en Automatik nadie hubiera subido
  // evidencia ni presionado "Marcar como empacado"), el pedido desaparecia
  // solo de la cola. Ahora la unica fuente de verdad de "ya se empaco en
  // Automatik" es pedidos.empacado_en (lo llena solo POST
  // /api/pedidos/[id]/empacar) -- pedidos.estado puede seguir cambiando
  // libremente por sync externo sin sacar nada de la cola antes de tiempo.
  const pendientes = useMemo(
    () => pedidos.filter((p) => !p.empacado_en && !["cancelled", "returned", "not_paid"].includes(p.estado)),
    [pedidos]
  );

  const historial = useMemo(
    () => pedidos
      .filter((p) => !!p.empacado_en)
      .sort((a, b) => new Date(b.fecha_pedido ?? "").getTime() - new Date(a.fecha_pedido ?? "").getTime()),
    [pedidos]
  );

  const pendientesOrdenados = useMemo(() => {
    return [...pendientes].sort((a, b) => {
      const now = Date.now();
      const ha = a.fecha_limite_despacho ? (new Date(a.fecha_limite_despacho ?? "").getTime() - now) / 36e5 : Infinity;
      const hb = b.fecha_limite_despacho ? (new Date(b.fecha_limite_despacho ?? "").getTime() - now) / 36e5 : Infinity;
      if (ha !== Infinity && hb !== Infinity) return ha - hb;
      if (ha !== Infinity) return -1;
      if (hb !== Infinity) return 1;
      return 0;
    });
  }, [pendientes]);

  const pendientesFiltrados = useMemo(() => {
    if (!busqueda.trim()) return pendientesOrdenados;
    const q = busqueda.trim().toLowerCase();
    return pendientesOrdenados.filter(
      (p) =>
        p.id_plataforma.toLowerCase().includes(q) ||
        p.order_id.toLowerCase().includes(q) ||
        (p.cliente_nombre ?? "").toLowerCase().includes(q)
    );
  }, [pendientesOrdenados, busqueda]);

  const urgentes = useMemo(
    () => pendientesFiltrados.filter((p) => {
      if (!p.fecha_limite_despacho) return false;
      return (new Date(p.fecha_limite_despacho ?? "").getTime() - Date.now()) / 36e5 < 24;
    }),
    [pendientesFiltrados]
  );
  const normales = useMemo(
    () => pendientesFiltrados.filter((p) => {
      if (!p.fecha_limite_despacho) return true;
      return (new Date(p.fecha_limite_despacho ?? "").getTime() - Date.now()) / 36e5 >= 24;
    }),
    [pendientesFiltrados]
  );

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
                    className="btn-premium rounded-lg border border-input bg-card p-2 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                    <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="eyebrow">Periodo</p>
                  <KpiRangeFilter value={rangoKpi} onChange={setRangoKpi} />
                </div>
                <KpiCards data={resumen} previousData={resumenAnterior} />
              </div>

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

                <div className="animate-in-soft space-y-2 md:hidden">
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

                <div className="card-premium animate-in-soft hidden overflow-hidden md:block">
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
                          <td className="px-4 py-3 text-muted-foreground">{formatFechaCorta(p.fecha_pedido ?? "")}</td>
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
                  <EstadoVacio icon={Inbox} texto="Aun no hay pedidos" />
                )}
              </section>
            </div>
          )}

          {rol === "empacador" && (
            <div className="space-y-0">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">Bodega</p>
                  <h1 className="display mt-1 text-2xl sm:text-3xl">
                    {empacadorTab === "pendientes" ? <>Pedidos por <em>empacar</em></> : <em>Historial</em>}
                  </h1>
                </div>
                <span className="tabular rounded-full bg-secondary px-3 py-1 text-sm font-medium">
                  {empacadorTab === "pendientes" ? pendientes.length : historial.length}
                </span>
              </div>

              <div className="mt-3 flex gap-0.5 rounded-xl bg-secondary/70 p-1">
                <button
                  onClick={() => { setEmpacadorTab("pendientes"); setBusqueda(""); }}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all sm:flex-none sm:px-4 sm:text-sm",
                    empacadorTab === "pendientes" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Package className="h-3.5 w-3.5" /> Por empacar
                </button>
                <button
                  onClick={() => { setEmpacadorTab("historial"); setBusqueda(""); }}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all sm:flex-none sm:px-4 sm:text-sm",
                    empacadorTab === "historial" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Clock className="h-3.5 w-3.5" /> Historial
                </button>
              </div>

              {empacadorTab === "pendientes" && (
                <>
                  <SearchBar
                    value={busqueda}
                    onChange={setBusqueda}
                    total={pendientes.length}
                    filtered={pendientesFiltrados.length}
                  />

                  {pendientesFiltrados.length === 0 ? (
                    <EstadoVacio
                      icon={PackageCheck}
                      texto={busqueda ? "No se encontraron pedidos" : "No hay pedidos pendientes de empaque"}
                    />
                  ) : (
                    <div className="space-y-6">
                      {urgentes.length > 0 && (
                        <section>
                          <div className="mb-2 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-rose-500" />
                            <h2 className="text-sm font-semibold text-rose-700">
                              Vencen hoy ({urgentes.length})
                            </h2>
                          </div>
                          <div className="space-y-2 sm:space-y-3">
                            {urgentes.map((p) => (
                              <PackingCard key={p.id} pedido={p} onConfirm={loadData} />
                            ))}
                          </div>
                        </section>
                      )}

                      {normales.length > 0 && (
                        <section>
                          {urgentes.length > 0 && (
                            <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                              Restantes ({normales.length})
                            </h2>
                          )}
                          <div className="space-y-2 sm:space-y-3">
                            {normales.map((p) => (
                              <PackingCard key={p.id} pedido={p} onConfirm={loadData} />
                            ))}
                          </div>
                        </section>
                      )}
                    </div>
                  )}
                </>
              )}

              {empacadorTab === "historial" && (
                <div className="mt-3">
                  {/* Tarea: el empacador puede VER las evidencias que ya
                      subio (galeria + lightbox dentro de PackingHistory),
                      pero no puede reemplazarlas ni eliminarlas -- esa
                      capacidad esta reservada a admin/vendedor/super_admin
                      tanto en el RLS de public.archivos (policies "admin y
                      vendedor actualizan/eliminan archivos") como en la UI:
                      PackingHistory no incluye ningun control de editar o
                      borrar, solo el visor con lightbox. */}
                  <PackingHistory pedidos={historial} />
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
