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
export async function abrirPdf(url: string): Promise<{ ok: true } | { ok: false; motivo: string }> {
  let resp: Response;
  try {
    resp = await fetch(pdfUrl(url));
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
  const ventana = window.open(blobUrl, "_blank");
  if (!ventana) {
    URL.revokeObjectURL(blobUrl);
    return { ok: false, motivo: "Tu navegador bloqueó la ventana. Habilita ventanas emergentes para este sitio." };
  }
  // No hay evento fiable de "el visor ya termino de cargar el blob", asi
  // que se revoca con un margen generoso en vez de hacerlo de inmediato
  // (revocar muy pronto deja al visor mostrando un PDF en blanco/roto).
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  return { ok: true };
}
