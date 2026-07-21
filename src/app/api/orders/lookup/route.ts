import { NextRequest, NextResponse } from "next/server";

// This route proxies lookups to ML/FA APIs via n8n webhook
// so we don't expose API keys in the frontend
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
    // Call n8n webhook that handles API lookup
    const n8nUrl = process.env.N8N_WEBHOOK_LOOKUP_URL;
    if (!n8nUrl) {
      return NextResponse.json(
        { error: "N8N_WEBHOOK_LOOKUP_URL no configurado" },
        { status: 500 }
      );
    }

    const res = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_number: orderNumber, platform }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `No se encontró el pedido ${orderNumber} en ${platform}` },
        { status: 404 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Error consultando la API de la plataforma" },
      { status: 500 }
    );
  }
}
