// URL del proxy /api/pdf: sirve la etiqueta a traves del backend en vez de
// linkear directo a Supabase Storage, para poder forzar Content-Disposition
// y evitar problemas de CORS/mixed-content en algunos navegadores moviles.
// Compartido entre OrdersTable (columna PDF, tarjeta mobile) y OrderDetail
// (boton "Ver PDF" -- ver PdfLink/PdfViewerProvider).
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
// Fix 2026-09-01 (tercera vuelta): la navegacion misma-pestana de arriba SI
// se quedaba dentro de la app (la URL en la barra confirmaba
// blob:https://automatik-dashboard.vercel.app/...), pero el visor de PDF
// integrado de Chrome Android (PDFium) mostraba el mismo "No se puede abrir
// el archivo PDF" -- esta vez el error viene del propio renderizador, no de
// un salto de contexto. En su momento se le atribuyo a una diferencia
// estructural entre los PDFs "de documento" de Mercado Libre (texto/
// vectores, tipico de Prince) vs. los PDFs "de imagen" de Falabella. Se
// forzo la descarga (atributo download) para no depender del render
// inline: el navegador siempre guarda el archivo (a Descargas) en vez de
// intentar abrirlo el mismo, y el usuario lo abre despues con cualquier app
// de PDF de su telefono (Google Drive, Adobe Acrobat, etc.), que suelen ser
// mucho mas tolerantes que el visor minimo integrado.
//
// Fix 2026-09-01 (cuarta a sexta vuelta -- causa raiz del propio PDF): se
// encontro un defecto real en la tabla xref de los PDFs de Mercado Libre
// (/Size mal declarado, generado por Prince) y se implemento una
// reparacion del lado del servidor en /api/pdf (ver route.ts y
// pdfRepair.ts) -- repara 106 de las 111 etiquetas reales de este cliente.
//
// Fix 2026-09-01 (septima vuelta -- REVERTIDA, ver octava): con el defecto
// de xref ya reparado del lado del servidor, se penso que forzar la
// descarga ya no hacia falta y se volvio a la navegacion misma-pestana sin
// el atributo download (como en la segunda vuelta), a pedido del usuario.
//
// Fix 2026-09-01 (octava vuelta -- la tercera vuelta tenia razon despues de
// todo): el usuario probo la septima vuelta abriendo muchas etiquetas al
// azar y TODAS le dieron error al renderizar inline -- no solo las 5 con
// corrupcion real de datos ya conocidas. Esto muestra que el diagnostico de
// la tercera vuelta iba en la direccion correcta: el visor de PDF integrado
// (PDFium, en la PWA instalada de Android) tiene un problema real
// renderizando los PDFs "de documento" de Mercado Libre que va MAS ALLA
// del defecto de xref -- reparar el xref no alcanza para que el visor
// inline los muestre. Reparar el xref sigue siendo valioso (deja el
// archivo bien formado para cualquier app externa que lo abra despues),
// pero no soluciona el render inline. Se vuelve a forzar la descarga
// (unica configuracion que se probo de forma consistente y confiable con
// las etiquetas reales de este cliente): el usuario ya no depende de que
// el visor integrado renderice el archivo, sino que lo abre con la app de
// PDF que prefiera en su telefono.
// Fix 2026-09-01 (novena vuelta -- se abandona el visor nativo del todo): el
// usuario pidio explicitamente poder ver la etiqueta con un clic, sin que se
// dispare una descarga (la octava vuelta soluciono "no abre" a costa de
// "siempre descarga", que tampoco es lo que se necesita). Volver a probar
// render inline vs. descarga forzada (como en la septima/octava vuelta) no
// tiene sentido sin mas: desde la ultima prueba fallida (octava vuelta) se
// encontraron y corrigieron TRES causas reales que pudieron haber estado
// contaminando aquella prueba --
//   1) la app servia JS de un deploy viejo en pestanas/PWA ya abiertas (sin
//      relacion con PDFs -- ver next.config.ts/pwa-register.tsx);
//   2) 6 etiquetas en Supabase estaban genuinamente corruptas (bytes
//      distintos a los de Airtable, que si abrian bien);
//   3) la causa de (2): un nodo de n8n pedia la etiqueta a Mercado Libre por
//      SEGUNDA vez en vez de reusar la ya descargada, y esa segunda llamada
//      no siempre devolvia los mismos bytes.
// Con esas tres causas de fondo corregidas, repetir la septima vuelta
// (delegarle el render al visor nativo del sistema/navegador) seguiria
// exponiendo a los mismos riesgos que ya la hicieron fallar una vez: que
// visor abre el PDF, si respeta las cookies de sesion, si lo trata como
// "descargar" o "ver", varia por SO/navegador/PWA y quedo fuera de nuestro
// control. En vez de apostar una tercera vez al visor nativo, el render pasa
// a hacerse DENTRO de la app, con pdf.js (pdfjs-dist) dibujando cada pagina
// en un <canvas> propio (ver pdf-viewer-modal.tsx) -- eso evita por completo
// que el sistema operativo o el navegador decidan como abrir el archivo: ya
// no es una "apertura de archivo", es JS corriendo en la misma pagina.
//
// Esta funcion se separa en dos partes reutilizables:
//  - fetchPdfBlob: el mismo fetch + validacion de content-type + mensajes de
//    error de las vueltas anteriores (sesion vencida vs. error generico),
//    pero devuelve el blob en vez de forzar una accion sobre el.
//  - descargarBlob: el mecanismo de descarga (creado en la primera vuelta),
//    que se conserva como boton explicito "Descargar" dentro del visor y
//    como salida de emergencia si el render con canvas llegara a fallar.
export interface PdfFetchResult {
  ok: true;
  blob: Blob;
  nombreArchivo: string;
}

export interface PdfFetchError {
  ok: false;
  motivo: string;
}

// Fix 2026-09-01 (decima vuelta -- nombre de archivo): el usuario pregunto
// si el archivo guardado puede llevar el numero de pedido o el nombre del
// comprador -- hoy SIEMPRE se guarda como "etiqueta.pdf" (el ultimo segmento
// de la URL de Storage, que es igual para todos los pedidos por el patron de
// paths ${cliente_id}/${pedido.id}/etiqueta.pdf), asi que descargar varias
// etiquetas seguidas las va numerando "etiqueta.pdf", "etiqueta (1).pdf",
// etc. sin ninguna forma de distinguirlas despues. A pedido del usuario, se
// arma el nombre a partir del nombre del comprador (pedido.cliente_nombre,
// que ya viaja en cada PdfLink) en vez del segmento de la URL.
//
// Fix 2026-09-01 (decimoprimera vuelta -- fallback al numero de pedido): el
// nombre de cliente no siempre esta disponible (pedido manual, dato
// faltante desde la plataforma de origen) -- antes, en ese caso, se caia
// directo al segmento generico de la URL ("etiqueta.pdf"), perdiendo de
// nuevo la forma de distinguir el archivo. A pedido del usuario, ahora ese
// caso cae primero al numero de pedido (pedido.id_plataforma -- el mismo
// identificador que ya se muestra en toda la UI, ver order-detail.tsx/
// pedido-detail-client.tsx) antes de llegar al segmento de la URL como
// ultimo recurso.
//
// sanitizarNombreArchivo: tanto cliente_nombre como id_plataforma son texto
// que puede traer tildes, espacios o simbolos -- no todo eso es valido/comodo
// en un nombre de archivo en todos los sistemas operativos. Se le quitan los
// acentos (normalize NFD + descartar los diacriticos) y se reemplaza
// cualquier caracter que no sea alfanumerico por "_", para terminar con algo
// legible y portable.
function sanitizarNombreArchivo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export async function fetchPdfBlob(
  url: string,
  nombreCliente?: string | null,
  numeroPedido?: string | null,
): Promise<PdfFetchResult | PdfFetchError> {
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
  const nombreClienteSanitizado = nombreCliente ? sanitizarNombreArchivo(nombreCliente) : "";
  const numeroPedidoSanitizado = numeroPedido ? sanitizarNombreArchivo(numeroPedido) : "";
  // Orden de preferencia: nombre del comprador > numero de pedido > segmento
  // generico de la URL de Storage (hoy, siempre "etiqueta.pdf"). Cualquiera
  // de los dos primeros puede faltar o quedar vacio tras sanitizar (ej. un
  // nombre que era solo simbolos) -- en ese caso se sigue probando el
  // siguiente de la lista en vez de cortar directo al ultimo recurso.
  const nombreArchivo = nombreClienteSanitizado
    ? `etiqueta_${nombreClienteSanitizado}.pdf`
    : numeroPedidoSanitizado
      ? `etiqueta_${numeroPedidoSanitizado}.pdf`
      : url.split("/").pop()?.split("?")[0] || "etiqueta.pdf";
  return { ok: true, blob, nombreArchivo };
}

export function descargarBlob(blob: Blob, nombreArchivo: string) {
  const blobUrl = URL.createObjectURL(blob);
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
}
