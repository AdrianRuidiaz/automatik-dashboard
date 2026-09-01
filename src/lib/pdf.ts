// URL del proxy /api/pdf: sirve la etiqueta a traves del backend en vez de
// linkear directo a Supabase Storage, para poder forzar Content-Disposition
// y evitar problemas de CORS/mixed-content en algunos navegadores moviles.
// Compartido entre OrdersTable (columna PDF, tarjeta mobile) y OrderDetail
// (boton "Ver PDF").
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
// Fix 2026-09-01 (tercera vuelta -- diagnostico INCORRECTO, ver septima
// vuelta): en su momento se penso que la navegacion misma-pestana de arriba
// SI se quedaba dentro de la app, pero el visor de PDF integrado de Chrome
// Android (PDFium) mostraba el mismo "No se puede abrir el archivo PDF", y
// se le atribuyo a una supuesta incompatibilidad de PDFium con PDFs "de
// documento" (texto/vectores, como los que genera Mercado Libre) versus
// PDFs "de imagen" (como los de Falabella, que siempre abrieron bien). Se
// forzo la descarga (atributo download) para evitar depender del render
// inline. Este diagnostico resulto ser INCORRECTO -- ver la vuelta cuarta a
// septima en el historial: la causa real nunca fue el tipo de PDF, sino
// que los PDFs de Mercado Libre (generados con "Prince") tienen un defecto
// real en su tabla xref, que /api/pdf ya repara del lado del servidor
// (ver src/app/api/pdf/route.ts y src/lib/pdfRepair.ts). Con esa causa raiz
// resuelta, forzar la descarga ya no hace falta.
//
// Fix 2026-09-01 (septima vuelta -- volver a abrir en vez de descargar):
// con el defecto de xref reparado del lado del servidor (repara 106 de 111
// etiquetas reales de este cliente), ya no hace falta forzar la descarga
// como workaround de un bug que en realidad nunca fue de PDFium. Se vuelve
// al comportamiento de "abrir" en vez de "descargar": se quita el atributo
// download del <a> y se navega la MISMA pestana al blob (igual que la
// segunda vuelta) -- a proposito NO se usa window.open(blob, "_blank") ni
// target="_blank": esa es la causa raiz ya confirmada y documentada arriba
// (segunda vuelta) de que la PWA instalada de Android delegue la apertura a
// un visor de PDF del sistema que no puede resolver blob: URLs. La
// navegacion misma-pestana es la unica forma de "abrir sin descargar" que
// ya se probo que funciona dentro del scope de la PWA instalada.
//
// Nota: para los pedidos cuya etiqueta tiene corrupcion real de datos (no
// solo el defecto de xref reparable -- ver comentario en pdfRepair.ts), NI
// este cambio ni ningun otro del lado del cliente puede arreglarlo: el
// archivo que llega desde Supabase Storage esta genuinamente incompleto.
// Esos pedidos necesitan que la etiqueta se vuelva a generar/sincronizar
// desde Mercado Libre.
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
  const enlace = document.createElement("a");
  enlace.href = blobUrl;
  enlace.rel = "noopener";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  return { ok: true };
}
