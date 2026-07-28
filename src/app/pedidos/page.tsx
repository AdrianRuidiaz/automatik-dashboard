"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { OrdersTable } from "@/components/pedidos/orders-table";
import { PackingCard } from "@/components/empacador/packing-card";
import { TaxDocsTable } from "@/components/vendedor/tax-docs-table";
import { fetchPedidos } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Pedido, RolUsuario } from "@/lib/types";

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  const loadData = useCallback(async () => {
    try { setPedidos(await fetchPedidos()); } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const ch = supabase
      .channel("pedidos-table-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadData]);

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
                    Pedidos por <em>empacar</em>
                  </h1>
                </div>
                <span className="tabular rounded-full bg-secondary px-3 py-1 text-sm font-medium">
                  {pendientes.length}
                </span>
              </div>

              {pendientes.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No hay pedidos pendientes de empaque
                </p>
              ) : (
                <div className="space-y-3">
                  {pendientes.map((p) => (
                    <PackingCard key={p.id} pedido={p} onConfirm={loadData} />
                  ))}
                </div>
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
