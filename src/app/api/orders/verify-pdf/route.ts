import { NextRequest, NextResponse } from "next/server";

// Tarea: validar que exista el PDF (guía de despacho / etiqueta) en Dropbox
// ANTES de confirmar el registro de un pedido manual en Supabase + Airtable.
//
// Sigue el mismo patrón que /api/orders/lookup: el frontend nunca habla
// directo con Dropbox ni maneja sus credenciales. Todo pasa por un webhook
// de n8n (mismo proyecto donde ya viven los workflows "FA - Red de
// Seguridad", "ML Principal", etc.) que sí tiene la conexión OAuth de
// Dropbox configurada.
//
// Requiere crear en n8n un webhook que reciba { order_number, platform } y
// responda 200 con { url } si encuentra el PDF, o un status distinto de 2xx
// si no existe o no se pudo descargar. Ese webhook aún no existe — hay que
// construirlo en n8n para que esta ruta funcione de punta a punta.
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

  const n8nUrl = process.env.N8N_WEBHOOK_VERIFY_PDF_URL;
  if (!n8nUrl) {
    console.error("N8N_WEBHOOK_VERIFY_PDF_URL no configurado");
    return NextResponse.json(
      { error: "Verificación de PDF no configurada" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Timeout defensivo: si Dropbox/n8n no responde, no queremos dejar
      // el formulario de creación de pedido colgado indefinidamente.
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ order_number: orderNumber, platform }),
    });

    if (!res.ok) {
      console.error(
        `verify-pdf: n8n respondió ${res.status} para pedido ${orderNumber} (${platform})`
      );
      return NextResponse.json(
        {
          error: `No se encontró el PDF en Dropbox para el pedido ${orderNumber}. Verifica que la guía de despacho ya esté generada e intenta nuevamente.`,
        },
        { status: 404 }
      );
    }

    const data = await res.json();
    return NextResponse.json({ url: data.url ?? null, mensaje: data.mensaje });
  } catch (err) {
    console.error("verify-pdf: error consultando webhook de Dropbox/n8n:", err);
    return NextResponse.json(
      { error: "Error verificando el PDF en Dropbox. Intenta nuevamente." },
      { status: 500 }
    );
  }
}
