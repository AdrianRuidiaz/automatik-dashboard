import { NextRequest, NextResponse } from "next/server";

// This route proxies lookups to ML/FA APIs via n8n webhook
// so we don't expose API keys in the frontend

// 2026-08-25: antes usábamos process.env.N8N_WEBHOOK_LOOKUP_URL, pero esa
// variable estaba mal configurada en Vercel (el fetch fallaba en la capa de
// red antes de llegar a n8n, sin ningún log). Se hardcodea la URL verificada
// del webhook "Order Lookup API" para eliminar esa dependencia frágil.
//
// 2026-08-25 (fix #2): la URL anterior incluía el webhookId
// (280e1cc7-7340-477a-ac63-46f7b9fd80d7) como segmento del path, pero n8n
// solo usa el webhookId en la URL cuando el nodo Webhook NO tiene un path
// personalizado. Este nodo sí tiene path="order-lookup", así que la URL
// real registrada por n8n es /webhook/order-lookup (sin el UUID).
// Confirmado contra el triggerInfo del workflow vía la API de n8n. Por eso
// n8n siempre respondía "webhook not registered": nunca era un problema de
// réplicas/infra, sino que llamábamos una ruta que nunca existió.
const N8N_LOOKUP_URL =
  "https://main-production-8d17.up.railway.app/webhook/order-lookup";

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
    const res = await fetch(N8N_LOOKUP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_number: orderNumber, platform }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data) {
      return NextResponse.json(
        {
          error:
            (data && data.error) ||
            `No se encontró el pedido ${orderNumber} en ${platform}`,
        },
        { status: res.ok ? 502 : res.status }
      );
    }

    // n8n responde 200 aunque no haya encontrado el pedido (el error viaja
    // en el body). Si no lo detectamos acá, el frontend cree que fue exitoso.
    if (data.error) {
      return NextResponse.json({ error: data.error }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("[/api/orders/lookup] fetch a n8n falló:", e);
    return NextResponse.json(
      { error: "Error consultando la API de la plataforma" },
      { status: 500 }
    );
  }
}
