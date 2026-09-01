import { NextRequest, NextResponse } from "next/server";
import { compress as repararPdf } from "qpdf-compress";

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
// Fix 2026-09-01 (quinta vuelta -- pdf-lib no alcanza): el usuario reporto
// que, tras la cuarta vuelta, algunas etiquetas de ML SEGUIAN saliendo
// dañadas. Los logs del servidor mostraron que pdf-lib tiraba un error real
// al intentar repararlas ("Invalid object ref", "Expected instance of e...")
// y el codigo caia al fallback de servir el original (todavia roto). Se
// bajaron y analizaron las 111 etiquetas ML de este cliente una por una con
// qpdf: TODAS (111/111) tienen algun defecto en la tabla xref -- no es un
// caso aislado, es sistemico a como Mercado Libre/Prince genera estos PDFs
// para esta cuenta. De esas 111: 106 tienen el defecto leve (Size mal
// contado, cosmetico) y pdf-lib deberia poder con la mayoria, pero en la
// practica su parser es fragil e impredecible -- a veces tira error, a veces
// no, dependiendo de detalles finos del archivo (confirmado reproduciendo
// distintos niveles de corrupcion a proposito). Las otras 5 tienen corrupcion
// real de datos (el stream de la tabla xref esta truncado/dañado a nivel de
// bytes, "inflate: incorrect header check") -- posiblemente por una subida
// interrumpida a Storage -- que NINGUNA libreria puede reparar porque
// faltan bytes de verdad, no es un problema de interpretacion.
//
// Fix: se reemplaza pdf-lib por qpdf-compress (motor real de qpdf via
// addon nativo N-API, Apache-2.0 -- sin problemas de licencia AGPL como
// tienen otras alternativas mas robustas como mupdf). Se probo contra las
// 111 etiquetas reales de este cliente: repara las 106 con defecto leve
// (0 advertencias de qpdf --check despues, pixeles identicos verificados
// renderizando antes/despues) y falla de forma limpia (sin tirar la
// respuesta entera) en las 5 con corrupcion real de datos -- para esas 5
// no queda otra que volver a generar la etiqueta desde Mercado Libre.
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

    const buffer = Buffer.from(await resp.arrayBuffer());

    let cuerpo: Buffer = buffer;
    try {
      cuerpo = await repararPdf(buffer);
    } catch (repairErr) {
      console.error("No se pudo reparar el PDF con qpdf-compress, se sirve el original:", repairErr);
    }

    return new NextResponse(Buffer.from(cuerpo), {
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
