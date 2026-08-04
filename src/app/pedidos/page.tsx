"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { OrdersTable } from "@/components/pedidos/orders-table";
import { PackingCard } from "@/components/empacador/packing-card";
import { PackingHistory } from "@/components/empacador/packing-history";
import { TaxDocsTable } from "@/components/vendedor/tax-docs-table";
import { fetchPedidos } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { Pedido, RolUsuario } from "@/lib/types";

export default function PedidosPage() {
  const { clienteId } = useRole();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [tabEmpacador, setTabEmpacador] = useState<"pendientes" | "historial">("pendientes");

  const loadData = useCallback(async () => {
    if (!clienteId) return;
    try { setPedidos(await fetchPedidos(clienteId)); } catch (err) { console.error(err); }
  }, [clienteId]);

  useEffect(() => { loadData(); }, [loadData]);

  // NOTA: filtrar por cliente_id es obligatorio aca -- sin el filtro,
  // cualquier cambio en pedidos de OTRO cliente recargaba esta tabla para
  // todos los usuarios conectados (se sentia como carga lenta/constante,
  // sobre todo en movil).
  //
  // Ademas, aunque el cambio sea del cliente correcto, procesos por lotes
  // (ej. migracion de etiquetas) pueden actualizar muchos pedidos seguidos
  // en pocos segundos -- cada UPDATE dispara el callback y sin proteccion
  // se hacen N recargas completas en cadena. Se agrupan con un debounce:
  // solo se recarga una vez, 800ms despues del ultimo cambio detectado.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!clienteId) return;
    const ch = supabase
      .channel("pedidos-table-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `cliente_id=eq.${clienteId}` }, () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => loadData(), 800);
      })
      .subscribe();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(ch);
    };
  }, [loadData, clienteId]);

  const pendientes = pedidos.filter((p) =>
    ["pending", "paid", "ready_to_ship"].includes(p.estado)
  );

  return (
    <AppShell>
      {(rol: RolUsuario) => (
        <>
          {rol === "admin" && (
            <div className="space-y-5">
              <div>
                <p className="eyebrow">Gestión</p>
                <h1 className="display mt-1 text-2xl sm:text-3xl">
                  Todos los <em>pedidos</em>
                </h1>
              </div>
              <OrdersTable pedidos={pedidos} />
            </div>
          )}

          {rol === "empacador" && (
            <div className="space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">Bodega</p>
                  <h1 className="display mt-1 text-2xl sm:text-3xl">
                    {tabEmpacador === "pendientes"
                      ? <>Pedidos por <em>empacar</em></>
                      : <>Historial de <em>empaque</em></>
                    }
                  </h1>
                </div>
                {tabEmpacador === "pendientes" && (
                  <span className="tabular rounded-full bg-secondary px-3 py-1 text-sm font-medium">
                    {pendientes.length}
                  </span>
                )}
              </div>

              <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
                <button
                  onClick={() => setTabEmpacador("pendientes")}
                  className={cn(
                    "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all",
                    tabEmpacador === "pendientes"
                      ? "bg-primary/10 text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Pendientes
                  {pendientes.length > 0 && (
                    <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {pendientes.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setTabEmpacador("historial")}
                  className={cn(
                    "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all",
                    tabEmpacador === "historial"
                      ? "bg-primary/10 text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Historial
                </button>
              </div>

              {tabEmpacador === "pendientes" ? (
                pendientes.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    No hay pedidos pendientes de empaque
                  </p>
                ) : (
                  <div className="space-y-3">
                    {pendientes.map((p) => (
                      <PackingCard key={p.id} pedido={p} onConfirm={loadData} />
                    ))}
                  </div>
                )
              ) : (
                <PackingHistory pedidos={pedidos} />
              )}
            </div>
          )}

          {rol === "vendedor" && (
            <div className="space-y-5">
              <div>
                <p className="eyebrow">Ventas</p>
                <h1 className="display mt-1 text-2xl sm:text-3xl">
                  Gestión de <em>documentos</em>
                </h1>
              </div>
              <TaxDocsTable pedidos={pedidos} />
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
