import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Rutas que NO requieren sesion iniciada.
const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/auth/set-password",
  "/api/admin/bootstrap-status",
  "/api/admin/bootstrap",
  // PWA: manifest, service worker e iconos deben poder pedirse sin sesion.
  // Muchos navegadores fetchean manifest.json/sw.js sin enviar cookies aunque
  // el usuario SI este logueado, asi que esto no es solo para logged-out --
  // sin esta excepcion la app nunca se detecta como instalable.
  "/manifest.json",
  "/sw.js",
  "/icon",
  "/apple-icon",
  "/icon-192",
  "/icon-512",
  // Chequeo de version para forzar reload cuando hay una pestana/PWA
  // corriendo JS de un deploy anterior (ver next.config.ts y
  // pwa-register.tsx) -- tiene que poder pedirse siempre, este o no
  // vencida la sesion, para no confundir "no hay sesion" con "no hay
  // deploy nuevo".
  "/api/version",
];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: usar getUser() (no getSession()) porque valida el token
  // contra el servidor de Supabase en vez de confiar ciegamente en la cookie.
  const { data: { user } } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
