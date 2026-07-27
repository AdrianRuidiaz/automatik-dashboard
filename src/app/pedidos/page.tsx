"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { OrdersTable } from "@/components/pedidos/orders-table";
import { fetchPedidos } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Pedido } from "@/lib/types";

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  const loadData = useCallback(async () => {
    try {
      const p = await fetchPedidos();
      setPedidos(p);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const ch = supabase
      .channel("pedidos-table-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadData]);

  return (
    <AppShell>
      {() => (
        <div className="space-y-5">
          <div>
            <p className="eyebrow">Gesti\u00f3n</p>
            <h1 className="display mt-1 text-2xl sm:text-3xl">
              Todos los <em>pedidos</em>
            </h1>
          </div>
          <OrdersTable pedidos={pedidos} />
        </div>
      )}
    </AppShell>
  );
}
