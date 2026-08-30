import HomePageClient, { type HomeInitialData } from "@/components/dashboard/home-client";
import { getPerfilServidor } from "@/lib/auth-server";
import { getSupabaseServer } from "@/lib/supabase-server";
import {
  fetchPedidosServer,
  fetchDashboardKpisRangoServer,
  fetchTendenciaDiariaServer,
} from "@/lib/api-server";
import { RANGO_KPI_DEFAULT, calcularRangoFechas } from "@/lib/date-ranges";

// Tarea (Speed Insights): "/" media 3.59s de FCP y 4.58s de LCP en produccion
// (ver auditoria de rendimiento) -- el contenido real (tarjetas KPI, tabla)
// nunca aparecia en el HTML: se pintaba recien despues de que el navegador
// resolviera sesion + rol + 4 consultas en paralelo, TODO desde el
// dispositivo del visitante. Este archivo pasa de "use client" a un Server
// Component que adelanta exactamente esas mismas 4 consultas (mismo shape,
// ver lib/api-server.ts) durante el render, para el rango KPI por defecto
// (RANGO_KPI_DEFAULT) -- la logica interactiva (cambiar de rango, refrescar,
// realtime, las 3 vistas por rol) sigue intacta y sin cambios de
// comportamiento en HomePageClient (components/dashboard/home-client.tsx),
// que ahora solo recibe ese primer resultado como semilla en vez de arrancar
// vacio.
//
// Resuelve el cliente_id de la MISMA forma que hoy usa role-context.tsx para
// un usuario normal: su propio cliente_id. Para super_admin en "modo
// soporte" viendo el cliente de otra empresa (eleccion que vive en
// localStorage, no existe en el servidor) esto sirve como primer paint
// optimista con SU PROPIO cliente -- loadData() en el cliente corrige de
// inmediato al cliente elegido en cuanto clienteId cambia, exactamente igual
// que corrige hoy cualquier otro dato semilla (cache de perfil, etc). Nunca
// queda un dato incorrecto pegado en pantalla mas de lo que tarda ese mismo
// primer efecto que ya existia.
//
// Cualquier error (RLS, red, RPC caida) se traga aca: initialData pasa a
// null y HomePageClient arranca exactamente como antes de este cambio
// (listas vacias a la espera del fetch del cliente) -- este adelanto nunca
// puede convertirse en un error 500 de la pagina.
async function getInitialData(): Promise<HomeInitialData | null> {
  try {
    const perfil = await getPerfilServidor();
    if (!perfil?.clientePropioId) return null;

    const supabase = await getSupabaseServer();
    const clienteId = perfil.clientePropioId;
    const { desde, hasta, prevDesde, prevHasta } = calcularRangoFechas(RANGO_KPI_DEFAULT);

    const [pedidos, resumen, resumenAnterior, tendencia] = await Promise.all([
      fetchPedidosServer(supabase, clienteId),
      fetchDashboardKpisRangoServer(supabase, clienteId, desde, hasta),
      fetchDashboardKpisRangoServer(supabase, clienteId, prevDesde, prevHasta),
      fetchTendenciaDiariaServer(supabase, clienteId, 7),
    ]);

    return { pedidos, resumen, resumenAnterior, tendencia };
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const initialData = await getInitialData();
  return <HomePageClient initialData={initialData} />;
}
