import { NextResponse } from "next/server";

// Ruta minima, sin auth estricta (ver PUBLIC_PATHS en proxy.ts), que
// devuelve el commit SHA del deploy actualmente corriendo en el servidor.
// La usa pwa-register.tsx para detectar que la pestana/app instalada esta
// corriendo JS de un deploy anterior y forzar un reload -- ver el
// comentario en next.config.ts para el porque (registration.update() del
// service worker no alcanza para esto).
//
// force-dynamic + no-store: esta respuesta tiene que reflejar SIEMPRE el
// deploy que esta sirviendo la request en este momento, nunca una copia
// cacheada (ni por Next ni por el navegador ni por ningun proxy/CDN
// intermedio) de un deploy anterior -- eso invalidaria por completo el
// chequeo que depende de ella.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { sha: process.env.VERCEL_GIT_COMMIT_SHA || null },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
