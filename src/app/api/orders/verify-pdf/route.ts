import { NextRequest, NextResponse } from "next/server";

// Verifica que exista el PDF (guía de despacho / etiqueta) ANTES de
// confirmar el registro de un pedido manual en Supabase + Airtable.
//
// Sigue el mismo patrón que /api/orders/lookup: el frontend nunca habla
// directo con Mercado Libre/Falabella ni maneja sus credenciales. Todo pasa
// por el webhook de n8n "Verificar y Obtener Etiqueta PDF (Pedido Manual)",
// que descarga la guía directo desde la API de ML o Falabella y la sube a
// Supabase Storage (bucket "etiquetas"). Este workflow NO usa Dropbox —
// Dropbox en este proyecto es solo un relay temporal (90s) del flujo
// automático ML/FA → Airtable, no un almacén persistente.
//
// 2026-08-25: se deja de depender de process.env.N8N_WEBHOOK_VERIFY_PDF_URL
// (mismo problema que tuvo N8N_WEBHOOK_LOOKUP_URL: fuente de fallos
// silenciosos, sin forma fácil de auditar su valor real en Vercel) y se
// hardcodea la URL verificada directamente contra el triggerInfo del
// workflow en n8n.
const N8N_VERIFY_PDF_URL =
  "https://main-production-8d17.up.railway.app/webhook/verify-pdf-manual";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderNumber = searchParams.get("order");
  const platform = searchParams.get("platform");

  if (!orderNumber || !platform) {
    return NextResponse.json(
      { error: "Faltan parámetros: order y platform" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(N8N_VERIFY_PDF_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Timeout defensivo: si n8n/ML/FA no responde, no queremos dejar
      // el formulario de creación de pedido colgado indefinidamente.
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ order_number: orderNumber, platform }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data) {
      console.error(
        `verify-pdf: n8n respondió ${res.status} para pedido ${orderNumber} (${platform})`
      );
      return NextResponse.json(
        {
          // Se reenvía el mensaje real de n8n (ya viene traducido y
          // específico: "aún no disponible en ML", "pedido ya despachado",
          // "no encontrado en Falabella", etc.) en vez de un texto fijo.
          error:
            (data && data.error) ||
            `No se pudo obtener la guía de despacho para el pedido ${orderNumber}. Verifica que ya esté generada e intenta nuevamente.`,
        },
        { status: res.ok ? 502 : res.status }
      );
    }

    return NextResponse.json({ url: data.url ?? null, mensaje: data.mensaje });
  } catch (err) {
    console.error("verify-pdf: error consultando webhook de n8n:", err);
    return NextResponse.json(
      { error: "Error verificando la guía de despacho. Intenta nuevamente." },
      { status: 500 }
    );
  }
}
