"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ProductosTable } from "@/components/productos/productos-table";
import { fetchProductos } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { supabase } from "@/lib/supabase";
import type { Producto } from "@/lib/types";

export default function ProductosPage() {
  const { clienteId } = useRole();
  const [productos, setProductos] = useState<Producto[]>([]);

  const loadData = useCallback(async () => {
    if (!clienteId) return;
    try {
      setProductos(await fetchProductos(clienteId));
    } catch (err) {
      console.error(err);
    }
  }, [clienteId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime: MISMO patron que pedidos-table-rt en app/pedidos/page.tsx.
  // Filtrar por cliente_id es obligatorio -- sin el filtro, un cambio en
  // productos de OTRO cliente recargaria esta tabla para todos los usuarios
  // conectados. Los workflows de n8n "ML - Sync Productos" / "FA - Sync
  // Productos" corren cada 15 min y pueden actualizar decenas de filas
  // seguidas (stock, estado): el debounce agrupa esos cambios y solo
  // recarga una vez, 800ms despues del ultimo evento detectado, en vez de
  // hacer N recargas completas en cadena.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!clienteId) return;
    const ch = supabase
      .channel("productos-table-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "productos", filter: `cliente_id=eq.${clienteId}` },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => loadData(), 800);
        }
      )
      .subscribe();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(ch);
    };
  }, [loadData, clienteId]);

  return (
    <AppShell>
      {() => (
        <div className="space-y-5">
          <div>
            <p className="eyebrow">Catálogo</p>
            <h1 className="display mt-1 text-2xl sm:text-3xl">
              Tus <em>productos</em>
            </h1>
          </div>
          <ProductosTable productos={productos} />
        </div>
      )}
    </AppShell>
  );
}
