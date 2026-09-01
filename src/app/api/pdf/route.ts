import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";

// Proxy para servir PDFs desde Supabase Storage sin error de CORS/Content-Disposition
//
// Fix 2026-09-01 (cuarta vuelta -- causa raiz real de "no se puede abrir el
// PDF" en Mercado Libre): las tres vueltas anteriores (fetch autenticado,
// no-store + navegacion misma-pestana, forzar descarga) asumian que el
// archivo en si estaba perfecto y que el problema era de contexto/cache/
// renderizado. Un usuario reporto que, incluso DESCARGANDO el archivo (asi
// que ya no dependia de ningun visor inline), al abrirlo seguia mostrando un
// error de formato -- senal de que el archivo mismo tenia un problema real,
// no solo el visor.
//
// Se descargaron los bytes exactos de una etiqueta ML desde Supabase Storage
// (bypaseando este proxy) y se validaron con qpdf --check: el archivo tiene
// una tabla xref invalida (el /Size declarado no coincide con el numero real
// de objetos -- un defecto tipico de generadores PDF basados en HTML->PDF,
// en este caso "Prince"). Es un defecto real del PDF, no cache ni contexto
// de navegacion. Confirmado con qpdf que RE-SERIALIZAR el archivo (parsearlo
// completo y volver a escribirlo) reconstruye una tabla xref valida sin
// alterar el contenido visual (se verifico renderizando ambas versiones a
// imagen: pixeles identicos). Las etiquetas de Falabella no tienen este
// defecto, por eso siempre abrieron bien.
//
// Fix: usar pdf-lib (JS puro, corre bien en una funcion serverless) para
// cargar y volver a guardar el PDF antes de servirlo, reparando la tabla
// xref. Si pdf-lib no logra parsear el archivo (PDF realmente corrupto, no
// solo con este defecto puntual), se sirve el original tal cual en vez de
// fallar la respuesta completa -- mejor un PDF que quizas tenga el mismo
// problema de antes que un error 500 duro.
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

    let cuerpo = Buffer.from(buffer);
    try {
      const documento = await PDFDocument.load(buffer, { ignoreEncryption: true });
      cuerpo = Buffer.from(await documento.save());
    } catch (repairErr) {
      console.error("No se pudo reparar el PDF con pdf-lib, se sirve el original:", repairErr);
    }

    return new NextResponse(cuerpo, {
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
