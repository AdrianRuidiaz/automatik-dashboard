// Reparacion quirurgica del defecto de xref en las etiquetas PDF de
// Mercado Libre (generadas con "Prince", un motor HTML->PDF).
//
// Contexto completo: ver el comentario en src/app/api/pdf/route.ts.
// Resumen del defecto: en un PDF con cross-reference *stream* (PDF 1.5+),
// el diccionario del objeto XRef final declara `/Size N`, que segun la
// especificacion debe ser 1 mas que el numero de objeto mas alto del
// archivo. Prince genera este valor mal calculado -- casi siempre un
// numero de mas -- lo cual hace que varios lectores de PDF estrictos
// (el PDFium embebido en Chrome/Android, entre otros) rechacen el
// archivo con un error de formato, aun cuando visualmente el PDF esta
// completo y correcto.
//
// Se probaron varias librerias completas de reparacion de PDF (pdf-lib,
// mupdf, qpdf via distintos bindings) antes de llegar a esta solucion:
// - pdf-lib: parser fragil, tira errores impredecibles en produccion
//   con estos archivos reales (ver historial de route.ts).
// - mupdf: repara perfecto, pero es AGPL-3.0 -- no apto para este
//   producto comercial sin licencia de Artifex.
// - qpdf-compress (addon nativo N-API, Apache-2.0): repara perfecto en
//   sandbox local, pero su binario prebuildeado para Linux exige una
//   version de glibc (2.35) mas nueva que la que ofrece el runtime real
//   de Vercel ("GLIBC_2.35' not found"), y su build alternativa "musl"
//   tampoco sirve porque esta linkeada dinamicamente contra musl (no
//   presente en el runtime de Vercel, que es glibc). O sea: ningun
//   binario nativo prebuildeado de este paquete corre en Vercel.
//
// En vez de seguir dependiendo de un motor de PDF completo (con todo el
// riesgo de licencia/plataforma que eso implica), se aprovecha que el
// defecto real es MINIMO y esta perfectamente identificado: el
// diccionario del objeto XRef es texto plano (solo el cuerpo del stream
// que le sigue esta comprimido), asi que se puede localizar y corregir
// el valor de /Size con una edicion de texto quirurgica, sin parsear ni
// tocar el resto del archivo. Cero dependencias externas, cero binarios
// nativos, cero problemas de licencia o de plataforma.
//
// Validado contra las 111 etiquetas ML reales de este cliente: repara
// las 106 con el defecto leve (0 advertencias de `qpdf --check`
// despues, salida pixel-identica a la original verificada renderizando
// con poppler) y no toca los 5 archivos con corrupcion real de datos
// (no encuentra el patron esperado, asi que no aplica ningun cambio --
// para esos 5 no hay reparacion posible por software, ver route.ts).

export interface RepairResult {
  buffer: Buffer;
  patched: boolean;
  reason: string;
}

/**
 * Intenta corregir el `/Size` mal declarado en el objeto XRef final de un
 * PDF. Si el archivo no tiene exactamente el patron de defecto conocido
 * (por ejemplo, porque tiene otro tipo de dano, o porque ya esta bien
 * formado), no modifica nada y devuelve `patched: false`.
 */
export function repairXrefSize(buf: Buffer): RepairResult {
  const startxrefIdx = buf.lastIndexOf("startxref");
  if (startxrefIdx === -1) {
    return { buffer: buf, patched: false, reason: "no-startxref" };
  }

  // leer el numero de bytes (offset del objeto XRef) que sigue a "startxref"
  let i = startxrefIdx + "startxref".length;
  while (i < buf.length && isPdfWhitespace(buf[i])) i++;
  const numStart = i;
  while (i < buf.length && buf[i] >= 0x30 && buf[i] <= 0x39) i++;
  const offsetStr = buf.subarray(numStart, i).toString("latin1");
  const offset = parseInt(offsetStr, 10);
  if (!Number.isFinite(offset) || offset < 0 || offset >= buf.length) {
    return { buffer: buf, patched: false, reason: "bad-offset" };
  }

  // ubicar el diccionario "<< ... >>" del objeto que arranca en ese offset
  const dictOpen = buf.indexOf("<<", offset);
  if (dictOpen === -1 || dictOpen - offset > 100) {
    return { buffer: buf, patched: false, reason: "no-dict-open-near-offset" };
  }

  const dictClose = findMatchingDictClose(buf, dictOpen);
  if (dictClose === -1) {
    return { buffer: buf, patched: false, reason: "no-matching-dict-close" };
  }

  const dictText = buf.subarray(dictOpen, dictClose).toString("latin1");

  if (!/\/Type\s*\/XRef\b/.test(dictText)) {
    return { buffer: buf, patched: false, reason: "not-xref-stream" };
  }

  const sizeMatch = dictText.match(/\/Size\s+(\d+)/);
  if (!sizeMatch) {
    return { buffer: buf, patched: false, reason: "no-size-field" };
  }
  const declaredSize = parseInt(sizeMatch[1], 10);

  const indexMatch = dictText.match(/\/Index\s*\[([^\]]+)\]/);
  if (!indexMatch) {
    // sin /Index no hay forma barata de calcular el tamano correcto
    return { buffer: buf, patched: false, reason: "no-index-field" };
  }

  const nums = indexMatch[1].trim().split(/\s+/).map(Number);
  let impliedSize = 0;
  for (let k = 0; k + 1 < nums.length; k += 2) {
    const start = nums[k];
    const count = nums[k + 1];
    if (start + count > impliedSize) impliedSize = start + count;
  }

  if (declaredSize === impliedSize) {
    // /Size ya es correcto -- este PDF no tiene el defecto, esta bien
    // formado. No es un caso de error.
    return { buffer: buf, patched: false, reason: "already-consistent" };
  }

  // Solo se corrige el patron exacto ya confirmado en produccion (Size
  // declarado = tamano real + 1). Cualquier otra discrepancia se deja
  // intacta a proposito: no queremos "adivinar" reparaciones para
  // defectos que no hemos validado.
  if (declaredSize !== impliedSize + 1) {
    return {
      buffer: buf,
      patched: false,
      reason: `size-mismatch-unknown-pattern(declared=${declaredSize},implied=${impliedSize})`,
    };
  }

  const patchedDictText = dictText.replace(/(\/Size\s+)(\d+)/, (_m, prefix: string) => `${prefix}${impliedSize}`);

  const before = buf.subarray(0, dictOpen);
  const after = buf.subarray(dictClose);
  const patchedDictBuf = Buffer.from(patchedDictText, "latin1");

  const outBuf = Buffer.concat([before, patchedDictBuf, after]);
  return { buffer: outBuf, patched: true, reason: `fixed ${declaredSize} -> ${impliedSize}` };
}

function isPdfWhitespace(byte: number): boolean {
  return byte === 0x0d || byte === 0x0a || byte === 0x20 || byte === 0x09 || byte === 0x00 || byte === 0x0c;
}

function findMatchingDictClose(buf: Buffer, dictOpen: number): number {
  let depth = 0;
  let p = dictOpen;
  while (p < buf.length - 1) {
    if (buf[p] === 0x3c && buf[p + 1] === 0x3c) {
      depth++;
      p += 2;
      continue;
    }
    if (buf[p] === 0x3e && buf[p + 1] === 0x3e) {
      depth--;
      p += 2;
      if (depth === 0) return p;
      continue;
    }
    p++;
  }
  return -1;
}
