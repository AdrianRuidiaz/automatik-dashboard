import { NextRequest, NextResponse } from "next/server";

// Proxy para servir PDFs desde Supabase Storage sin error de CORS/Content-Disposition
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  
  if (!url || !url.includes("supabase.co")) {
    return NextResponse.json({ error: "URL invalida" }, { status: 400 });
  }

  try {
    const resp = await fetch(url);
    
    if (!resp.ok) {
      return NextResponse.json({ error: "No se pudo obtener el PDF" }, { status: resp.status });
    }

    const buffer = await resp.arrayBuffer();
    
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "Error al procesar el PDF" }, { status: 500 });
  }
}
