"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ProductosTable } from "@/components/productos/productos-table";
import { CatalogoUnificadoTable } from "@/components/productos/catalogo-unificado-table";
import { FiltroPills } from "@/components/pedidos/filtro-pills";
import { fetchProductos } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { useRealtimeTable } from "@/lib/hooks/use-realtime-table";
import type { Producto } from "@/lib/types";

type VistaProductos = "plataforma" | "catalogo";

const VISTA_OPTIONS: { key: VistaProductos; label: string }[] = [
  { key: "plataforma", label: "Por plataforma" },
  { key: "catalogo", label: "Catálogo unificado" },
];

export default function ProductosPage() {
  const { clienteId } = useRole();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [vista, setVista] = useState<VistaProductos>("plataforma");

  const loadData = useCallback(async () => {
    if (!clienteId) return;
    try {
      setProductos(await fetchProductos(clienteId));
    } catch (err) {
      console.error(err);
    }
  }, [clienteId]);

  // Fetch de datos al montar/cuando cambia clienteId, mismo patron que app/page.tsx.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  //
  // Una sola suscripcion/fetch para las DOS vistas ("Por plataforma" y
  // "Catalogo unificado" mas abajo): ambas reciben el mismo arreglo
  // `productos` como prop y cada una arma su propia derivacion (filtro
  // plano vs. agrupado por sku_interno) con useMemo, sin duplicar el fetch
  // ni el channel de Realtime al cambiar de vista.
  // (extraido a src/lib/hooks/use-realtime-table.ts -- mismo canal, tabla,
  // filtro y debounce que antes, solo cambia la ubicacion del codigo)
  useRealtimeTable({
    table: "productos",
    clienteId,
    onChange: loadData,
    channelName: "productos-table-rt",
  });

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
          <FiltroPills options={VISTA_OPTIONS} value={vista} onChange={setVista} />
          {vista === "plataforma" ? (
            <ProductosTable productos={productos} />
          ) : (
            <CatalogoUnificadoTable productos={productos} />
          )}
        </div>
      )}
    </AppShell>
  );
}
