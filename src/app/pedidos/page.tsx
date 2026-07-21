"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { OrdersTable } from "@/components/pedidos/orders-table";
import { fetchPedidos } from "@/lib/api";
import type { Pedido } from "@/lib/types";

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  useEffect(() => {
    fetchPedidos().then(setPedidos).catch(console.error);
  }, []);

  return (
    <AppShell>
      {() => <OrdersTable pedidos={pedidos} />}
    </AppShell>
  );
}
