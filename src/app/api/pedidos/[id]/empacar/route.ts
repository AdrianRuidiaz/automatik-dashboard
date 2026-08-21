import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const MIN_FOTOS = 1;
const MAX_FOTOS = 3;

// Tarea: evidencia fotográfica obligatoria para "Marcar como empacado".
//
// El frontend (packing-card.tsx) ya valida 1-3 fotos antes de llegar aquí,
// pero esa validación por sí sola no es confiable: cualquiera con la anon
// key podría llamar a updateEstadoPedido directamente sin pasar por la UI.
// Por eso esta ruta vuelve a contar, en el servidor, cuántos archivos tipo
// "evidencia_empaque" tiene el pedido antes de permitir el cambio de estado.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pedidoId } = await params;

  if (!pedidoId) {
    return NextResponse.json({ error: "Falta el id del pedido" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    // NOTA: getSupabaseAdmin() no usa un tipo Database<> generado, así que
    // supabase-js/postgrest-js a veces infiere el resultado de .select()
    // como `never` (rompía el build de Vercel: "Property 'estado' does not
    // exist on type 'never'"). Casteamos explícitamente al shape real.
    const { data: pedidoData, error: errorPedido } = await supabaseAdmin
      .from("pedidos")
      .select("id, estado")
      .eq("id", pedidoId)
      .maybeSingle();

    if (errorPedido) throw errorPedido;
    const pedido = pedidoData as { id: string; estado: string } | null;
    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }
    if (pedido.estado === "cancelled") {
      return NextResponse.json(
        { error: "No se puede marcar como empacado un pedido cancelado" },
        { status: 409 }
      );
    }

    const { count, error: errorArchivos } = await supabaseAdmin
      .from("archivos")
      .select("id", { count: "exact", head: true })
      .eq("pedido_id", pedidoId)
      .eq("tipo", "evidencia_empaque");

    if (errorArchivos) throw errorArchivos;

    const totalFotos = count ?? 0;

    if (totalFotos < MIN_FOTOS) {
      return NextResponse.json(
        {
          error: `Debes adjuntar al menos ${MIN_FOTOS} foto de evidencia antes de marcar el pedido como empacado.`,
        },
        { status: 422 }
      );
    }
    if (totalFotos > MAX_FOTOS) {
      return NextResponse.json(
        { error: `Este pedido tiene más de ${MAX_FOTOS} fotos de evidencia. Revisa antes de continuar.` },
        { status: 422 }
      );
    }

    // Tarea: empacado_en (no estado) es lo que saca al pedido de la cola
    // "Por empacar" (ver src/app/page.tsx). Antes solo se movia `estado` a
    // "ready_to_ship" -- eso funcionaba mientras nada mas tocara estado,
    // pero un pedido que ya llegaba "shipped" desde una resincronizacion de
    // n8n (ML/Falabella ya lo reportan enviado) desaparecia de la cola sin
    // que el empacador hubiera confirmado nunca el empaque. Se sigue
    // actualizando estado igual (sirve para el resto de la app: dashboard,
    // /pedidos, etc.), pero la cola ya no depende de el.
    const { error: errorUpdate } = await supabaseAdmin
      .from("pedidos")
      .update({
        estado: "ready_to_ship",
        empacado_en: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", pedidoId);

    if (errorUpdate) throw errorUpdate;

    return NextResponse.json({ ok: true, fotos: totalFotos });
  } catch (err) {
    console.error(`empacar: error procesando pedido ${pedidoId}:`, err);
    return NextResponse.json(
      { error: "Error interno al marcar el pedido como empacado" },
      { status: 500 }
    );
  }
}
