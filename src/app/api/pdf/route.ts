import { NextRequest, NextResponse } from "next/server";
import { repairXrefSize } from "@/lib/pdfRepair";

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
// contado, cosmetico) y las otras 5 tienen corrupcion real de datos (el
// stream de la tabla xref esta truncado/dañado a nivel de bytes,
// "inflate: incorrect header check") -- posiblemente por una subida
// interrumpida a Storage -- que NINGUNA libreria puede reparar porque
// faltan bytes de verdad, no es un problema de interpretacion.
//
// Fix 2026-09-01 (sexta vuelta -- nada de libreria nativa): se probo
// reemplazar pdf-lib por qpdf-compress (addon nativo N-API sobre qpdf real,
// Apache-2.0). Reparaba las 106 etiquetas con defecto leve a la perfeccion
// en el sandbox local... pero su binario prebuildeado para Linux exige
// GLIBC_2.35, una version mas nueva que la que ofrece el runtime real de
// Vercel -- el build fallaba con "GLIBC_2.35' not found". La variante
// alternativa "musl" del mismo paquete tampoco sirve: esta linkeada
// dinamicamente contra musl, que no esta presente en el runtime de Vercel
// (que es glibc). Osea, NINGUN binario nativo prebuildeado de ese paquete
// corre en el runtime real de Vercel (mas alla de que localmente sí
// funcionaba perfecto).
//
// En vez de seguir dependiendo de una libreria/binario externo completo
// (con todo el riesgo de licencia y de compatibilidad de plataforma que
// eso trae), se aprovecha que el defecto identificado es MINIMO y esta
// perfectamente entendido: el diccionario del objeto XRef final es texto
// plano (solo el stream comprimido que sigue no lo es), asi que alcanza
// con localizar y corregir el numero de /Size con una edicion de texto
// quirurgica -- sin parsear el resto del archivo y sin ninguna dependencia
// externa. Implementado en src/lib/pdfRepair.ts. Validado contra las 111
// etiquetas reales: repara las 106 con el defecto leve (0 advertencias de
// qpdf --check despues, salida pixel-identica a la original) y no toca
// (a proposito) los 5 archivos con corrupcion real de datos -- para esos 5
// no hay reparacion posible por software, hay que volver a generar la
// etiqueta desde Mercado Libre.
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
      const { buffer: reparado, patched, reason } = repairXrefSize(buffer);
      if (patched) {
        cuerpo = reparado;
      } else {
        console.error("PDF sin reparacion aplicable (se sirve el original):", reason);
      }
    } catch (repairErr) {
      console.error("Error inesperado reparando el PDF, se sirve el original:", repairErr);
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
