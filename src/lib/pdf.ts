// URL del proxy /api/pdf: sirve la etiqueta a traves del backend en vez de
// linkear directo a Supabase Storage, para poder forzar Content-Disposition
// y evitar problemas de CORS/mixed-content en algunos navegadores moviles.
// Compartido entre OrdersTable (columna PDF, tarjeta mobile) y OrderDetail
// (boton "Descargar PDF").
export const pdfUrl = (url: string) => `/api/pdf?url=${encodeURIComponent(url)}`;

// Tarea (fix 2026-09-01, "no se puede abrir el PDF"): /api/pdf esta detras
// del proxy de autenticacion (src/proxy.ts) -- no esta en su lista de rutas
// publicas, a proposito, porque las etiquetas no deberian poder bajarse sin
// sesion. Un <a href=... target="_blank"> normal le delega la peticion a lo
// que sea que el sistema operativo/navegador decida (en Android, un link
// que responde con Content-Type application/pdf desde una PWA instalada
// suele delegarse a un visor de PDF del sistema en vez de abrirse dentro
// del navegador) -- ese visor externo hace su PROPIA peticion de red, sin
// las cookies de sesion de la pestana donde el usuario esta logueado. El
// resultado: la peticion sin cookie cae en el redirect 307 a /login, el
// visor recibe HTML en vez de un PDF, y muestra un generico "No se puede
// abrir el archivo PDF" sin ninguna pista de la causa real (confirmado via
// pruebas directas contra /api/pdf: sin cookie de sesion, responde 307 a
// /login?next=/api/pdf en vez de un error legible).
//
// Fix: hacer el fetch() explicitamente DESDE la pagina (mismas cookies que
// el resto de la app, sin depender de que un visor externo se autentique
// por su cuenta), verificar el content-type de la respuesta ANTES de
// mostrarla, y si no es un PDF real avisar con un mensaje claro -- sesion
// vencida vs. error del servidor -- en vez de dejar que el SO muestre un
// error generico sin explicacion.
//
// Fix 2026-09-01 (segunda vuelta): un usuario reporto que, tras este cambio,
// las etiquetas de pedidos Mercado Libre le seguian mostrando EXACTAMENTE
// el mismo error nativo de Android que antes -- puntualmente en la PWA
// instalada ("Agregar a pantalla de inicio") -- mientras que Falabella
// abria bien. Se verifico que los archivos en Storage estan perfectos (200,
// Content-Type y tamano correctos) para ambas plataformas, asi que el
// problema no es el PDF ni el backend. Dos cambios para cerrar el hueco que
// queda:
//
// 1) cache: "no-store" en el fetch: si el usuario ya habia intentado abrir
//    esa MISMA etiqueta antes de este fix (cuando /api/pdf siempre
//    devolvia el redirect 307 a /login), el navegador puede haber cacheado
//    esa respuesta vieja bajo la misma URL exacta y seguir sirviendola sin
//    ir a la red -- reabrir la app no lo soluciona porque no es un
//    problema de JS desactualizado, es cache HTTP.
//
// 2) Navegacion en la MISMA pestana en vez de window.open(blobUrl,
//    "_blank"): un blob: URL solo es resoluble dentro del proceso/contexto
//    de navegacion exacto que lo creo. Abrirlo en una ventana/pestana NUEVA
//    funciona en Chrome de escritorio, pero en una PWA instalada de
//    Android ("WebAPK") esa apertura puede tratarse como una navegacion
//    fuera del scope de la app y delegarse a un visor de PDF nativo del
//    sistema -- que no puede resolver blob: URLs en absoluto y muestra el
//    mismo "No se puede abrir el archivo PDF" del bug original, sin pasar
//    por nuestro fetch ni por los mensajes de error de abajo. Crear un
//    <a href={blobUrl}> y hacerle click() SIN target="_blank" navega la
//    pestana actual: el blob nunca sale del proceso que lo creo, asi que
//    no hay contexto nuevo que pueda perderlo.
//
// Fix 2026-09-01 (tercera vuelta): la navegacion misma-pestana de arriba
// SI se quedaba dentro de la app (la URL en la barra confirmaba
// blob:https://automatik-dashboard.vercel.app/...), pero el visor de PDF
// integrado de Chrome Android (PDFium) mostraba el mismo "No se puede
// abrir el archivo PDF" -- esta vez el error viene del propio renderizador,
// no de un salto de contexto. Se confirmo con una lectura de los primeros
// bytes reales de varias etiquetas: las de Mercado Libre son PDFs 1.6
// generados como documento estructurado (Catalog + arbol de Pages, tipico
// de un PDF armado con texto/vectores), mientras que las de Falabella son
// PDFs 1.7 armados como una sola imagen incrustada -- ambos son PDFs
// perfectamente validos, pero el PDFium que trae Android en la PWA
// instalada es conocido por fallar con ciertos PDFs "de documento" de
// transportistas (fuentes incrustadas, formularios, filtros de imagen
// poco comunes) mientras que un PDF-imagen simple no le genera problema.
// Esto no se puede arreglar desde el codigo de Automatik -- es un bug del
// renderizador del sistema, no del archivo. La forma confiable de
// evitarlo es no depender de que el navegador RENDERICE el PDF: se le
// pone el atributo download al <a>, asi el navegador siempre lo guarda
// como archivo (a Descargas) en vez de intentar abrirlo el mismo, y el
// usuario lo abre despues con cualquier app de PDF de su telefono (Google
// Drive, Adobe Acrobat, etc.), que suelen ser mucho mas tolerantes que el
// visor minimo integrado.
export async function abrirPdf(url: string): Promise<{ ok: true } | { ok: false; motivo: string }> {
  let resp: Response;
  try {
    resp = await fetch(pdfUrl(url), { cache: "no-store" });
  } catch {
    return { ok: false, motivo: "No se pudo cargar la etiqueta. Revisa tu conexión e inténtalo de nuevo." };
  }

  const contentType = resp.headers.get("content-type") || "";
  if (!resp.ok || !contentType.includes("application/pdf")) {
    if (resp.redirected && resp.url.includes("/login")) {
      return { ok: false, motivo: "Tu sesión venció. Vuelve a iniciar sesión e inténtalo de nuevo." };
    }
    return { ok: false, motivo: "No se pudo cargar la etiqueta. Inténtalo de nuevo." };
  }

  const blob = await resp.blob();
  const blobUrl = URL.createObjectURL(blob);
  // Nombre de archivo para la descarga: se toma el ultimo segmento de la
  // URL original en Storage (siempre "etiqueta.pdf" hoy) en vez de dejar
  // que el navegador use el nombre interno del blob (un UUID ilegible).
  const nombreArchivo = url.split("/").pop()?.split("?")[0] || "etiqueta.pdf";
  const enlace = document.createElement("a");
  enlace.href = blobUrl;
  enlace.download = nombreArchivo;
  enlace.rel = "noopener";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // No hay evento fiable de "la descarga ya termino", asi que se revoca
  // con un margen generoso en vez de hacerlo de inmediato (revocar muy
  // pronto puede cortar la descarga a mitad de camino).
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  return { ok: true };
}
