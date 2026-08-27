"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/app-shell";
import { fetchPedidos } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { useRealtimeTable } from "@/lib/hooks/use-realtime-table";
import { cn } from "@/lib/utils";
import type { Pedido, RolUsuario } from "@/lib/types";

// Code-splitting por rol, igual criterio que src/app/page.tsx: esta pagina
// renderiza UNA sola de las tres ramas (admin / empacador / vendedor) segun
// useRole(), pero antes importaba las cuatro piezas pesadas de forma
// estatica -- todo usuario descargaba OrdersTable (react-table + el propio
// export a CSV/XLSX, solo admin), PackingCard/PackingHistory (camara/upload
// de evidencia, solo empacador) y TaxDocsTable (solo vendedor) sin importar
// su rol real. Con next/dynamic cada uno pasa a su propio chunk que solo se
// pide cuando el rol activo lo necesita. ssr:false porque son piezas
// interactivas sin contenido critico para SEO/first paint, coherente con
// que toda la pagina ya es "use client".
const OrdersTable = dynamic(
  () => import("@/components/pedidos/orders-table").then((m) => m.OrdersTable),
  { ssr: false, loading: () => <div className="skeleton h-96 w-full" /> }
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

export default function PedidosPage() {
  const { clienteId } = useRole();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [tabEmpacador, setTabEmpacador] = useState<"pendientes" | "historial">("pendientes");

  // Filtro inicial de la tabla (admin) cuando se llega desde un link como el
  // de las tarjetas KPI "Por despachar" (?filtro=por_despachar) o
  // "Cancelados" (?filtro=cancelled) del dashboard. "cancelled" reutiliza el
  // mismo estadoFilter="cancelled" que ya aplica el boton interno "Ver
  // cancelados" de orders-table.tsx.
  // Se lee via window.location en un efecto (no en el render) para no
  // romper la hidratacion -- mismo patron que getNext() en app/login.
  const [filtroInicial, setFiltroInicial] = useState<"all" | "por_despachar" | "cancelled">("all");

  // Tarea #75 (deep links multi-pedido): cuando un push agrupa VARIOS
  // pedidos (ej. "3 pedidos urgentes: vencen hoy" o varias anomalias del
  // chequeo de salud), el link ya no puede apuntar a un solo /pedidos/{id}.
  // ?ids=uuid1,uuid2,uuid3 (separados por coma) filtra esta tabla para
  // mostrar SOLO esos pedidos puntuales, ignorando cualquier otro filtro
  // activo (estado/plataforma/fecha) -- mismo patron de lectura de query
  // param via window.location que filtroInicial arriba. Un solo id en la
  // lista funciona igual (muestra ese unico pedido).
  const [idsFiltro, setIdsFiltro] = useState<string[] | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filtro = params.get("filtro");
    // Se lee via window.location en un efecto (no en el render) para no
    // romper la hidratacion, mismo patron documentado arriba.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (filtro === "por_despachar") setFiltroInicial("por_despachar");
    else if (filtro === "cancelled") setFiltroInicial("cancelled");

    const ids = params.get("ids");
    if (ids) {
      const lista = ids.split(",").map((id) => id.trim()).filter(Boolean);
      // idem arriba
      if (lista.length > 0) setIdsFiltro(lista);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!clienteId) return;
    try { setPedidos(await fetchPedidos(clienteId)); } catch (err) { console.error(err); }
  }, [clienteId]);

  // Fetch de datos al montar/cuando cambia clienteId, mismo patron que app/page.tsx.
  // eslint-disable-next-line react-hooks/set-state-in-effect
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
  // (extraido a src/lib/hooks/use-realtime-table.ts -- mismo canal, tabla,
  // filtro y debounce que antes, solo cambia la ubicacion del codigo)
  useRealtimeTable({
    table: "pedidos",
    clienteId,
    onChange: loadData,
    channelName: "pedidos-table-rt",
  });

  // Tarea: esta vista duplica la cola de empacador que ya existe en
  // app/page.tsx ("/") -- mismo criterio debe aplicar en las dos. Antes
  // filtraba por estado in (pending, paid, ready_to_ship), lo que la volvia
  // a romper con una resincronizacion externa (ver comentario largo en
  // app/page.tsx): pedidos.empacado_en (llenado solo por POST
  // /api/pedidos/[id]/empacar) es la unica fuente de verdad de si ya se
  // empaco en Automatik.
  const pendientes = pedidos.filter(
    (p) => !p.empacado_en && !["cancelled", "returned", "not_paid"].includes(p.estado)
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
              <OrdersTable pedidos={pedidos} initialEstadoFilter={filtroInicial} filtroIds={idsFiltro} />
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
