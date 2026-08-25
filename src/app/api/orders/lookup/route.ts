import { NextRequest, NextResponse } from "next/server";

// This route proxies lookups to ML/FA APIs via n8n webhook
// so we don't expose API keys in the frontend

// 2026-08-25: antes usábamos process.env.N8N_WEBHOOK_LOOKUP_URL, pero esa
// variable estaba mal configurada en Vercel (el fetch fallaba en la capa de
// red antes de llegar a n8n, sin ningún log). Se hardcodea la URL verificada
// del webhook "Order Lookup API" para eliminar esa dependencia frágil.
const N8N_LOOKUP_URL =
  "https://main-production-8d17.up.railway.app/webhook/280e1cc7-7340-477a-ac63-46f7b9fd80d7/order-lookup";

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
