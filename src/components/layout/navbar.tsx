"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, LogOut, ChevronDown, Building2, Menu, X, Download, Settings } from "lucide-react";
import { useRole } from "@/lib/role-context";
import type { RolUsuario } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useInstallPrompt } from "@/lib/pwa-install";
import { useState, useRef, useEffect } from "react";

const NAV_ITEMS: Record<RolUsuario, { label: string; href: string }[]> = {
  admin: [
    { label: "Dashboard", href: "/" },
    { label: "Pedidos", href: "/pedidos" },
  ],
  vendedor: [
    { label: "Ventas", href: "/" },
    { label: "Pedidos", href: "/pedidos" },
  ],
  empacador: [],
};

const ROL_LABELS: Record<RolUsuario, string> = { admin: "Admin", vendedor: "Vendedor", empacador: "Empacador" };
const ROL_COLORS: Record<RolUsuario, string> = {
  admin: "bg-amber-400",
  vendedor: "bg-emerald-400",
  empacador: "bg-sky-400",
};
const VISTAS: RolUsuario[] = ["admin", "vendedor", "empacador"];

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

// Selector de cliente para el modo "vista desarrollador": le permite al
// super_admin elegir a que cliente esta dando soporte. No cambia el rol que
// esta viendo (eso lo maneja el selector de vista existente), solo que
// cliente_id se usa para todas las consultas de datos.
function ClienteSwitcher() {
  const { clienteNombre, clientesDisponibles, clienteId, setCliente } = useRole();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (clientesDisponibles.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        title="Vista desarrollador: elige a que cliente le estas dando soporte"
        className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70 transition-all hover:border-amber-400/20 hover:bg-white/[0.06] hover:text-white/90"
      >
        <Building2 className="h-3.5 w-3.5" />
        <span className="max-w-[120px] truncate">{clienteNombre || "Elegir cliente"}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 min-w-[200px] overflow-hidden rounded-xl border border-white/[0.08] bg-[hsl(230,14%,11%)] p-1 shadow-2xl shadow-black/40 animate-in-soft">
          {clientesDisponibles.map((c) => (
            <button
              key={c.id}
              onClick={() => { setCliente(c.id); setOpen(false); }}
              className={cn(
                "flex w-full items-center gap-2 truncate rounded-lg px-3 py-2 text-left text-sm transition-colors",
                clienteId === c.id ? "bg-amber-400/10 text-amber-400" : "text-white/60 hover:bg-white/[0.04] hover:text-white/90"
              )}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Boton "Instalar app". Solo aparece cuando el navegador ya disparo
// beforeinstallprompt (osea: ya decidio por su cuenta que la app cumple los
// criterios de instalable) y no esta instalada todavia. Antes de esto la
// unica forma de instalar era el icono nativo de la barra de direcciones o
// el menu del navegador, que mucha gente ni nota que existe.
function InstalarAppBoton({ variant }: { variant: "desktop" | "mobile" }) {
  const { puedeInstalar, instalar } = useInstallPrompt();

  if (!puedeInstalar) return null;

  if (variant === "mobile") {
    return (
      <button
        onClick={instalar}
        className="btn-premium flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-amber-400 transition-colors hover:bg-amber-400/10"
      >
        <Download className="h-4 w-4" />
        Instalar Automatik
      </button>
    );
  }

  return (
    <button
      onClick={instalar}
      title="Instalar Automatik como app"
      className="btn-premium flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-400/15"
    >
      <Download className="h-3.5 w-3.5" />
      Instalar
    </button>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const { rol, usuario, esSuperAdmin, setVista, signOut, clienteNombre, clientesDisponibles, clienteId, setCliente } = useRole();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Cierra el panel mobile al navegar, para no dejarlo abierto tapando la
  // pagina de destino.
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (!rol) {
    return (
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[hsl(230,15%,7%)]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:h-16 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20">
              <Zap className="h-4 w-4 text-[hsl(230,15%,7%)]" strokeWidth={2.5} />
            </div>
            <span className="font-serif text-lg tracking-tight text-white/90">
              automatik<span className="text-amber-400">.io</span>
            </span>
          </Link>
        </div>
        <div className="gold-line" />
      </nav>
    );
  }

  const navItems = NAV_ITEMS[rol];

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[hsl(230,15%,7%)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20">
            <Zap className="h-4 w-4 text-[hsl(230,15%,7%)]" strokeWidth={2.5} />
          </div>
          <span className="font-serif text-lg tracking-tight text-white/90">
            automatik<span className="text-amber-400">.io</span>
          </span>
        </Link>

        {/* Nav links: desktop */}
        <div className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "text-amber-400"
                    : "text-white/50 hover:text-white/80"
                )}
              >
                {item.label}
                {active && (
                  <span className="absolute bottom-0 left-1/2 h-[2px] w-4 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Right side: desktop */}
        <div className="hidden items-center gap-3 md:flex">
          <InstalarAppBoton variant="desktop" />

          {esSuperAdmin && <ClienteSwitcher />}

          {esSuperAdmin ? (
            <div ref={ref} className="relative">
              <button
                onClick={() => setOpen(!open)}
                title="Como super_admin puedes ver cualquier vista para seguir probando el producto"
                className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70 transition-all hover:border-amber-400/20 hover:bg-white/[0.06] hover:text-white/90"
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", ROL_COLORS[rol])} />
                {ROL_LABELS[rol]}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
              </button>
              {open && (
                <div className="absolute right-0 top-full z-50 mt-2 min-w-[140px] overflow-hidden rounded-xl border border-white/[0.08] bg-[hsl(230,14%,11%)] p-1 shadow-2xl shadow-black/40 animate-in-soft">
                  {VISTAS.map((r) => (
                    <button
                      key={r}
                      onClick={() => { setVista(r); setOpen(false); }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        rol === r ? "bg-amber-400/10 text-amber-400" : "text-white/60 hover:bg-white/[0.04] hover:text-white/90"
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", ROL_COLORS[r])} />
                      {ROL_LABELS[r]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70">
              <span className={cn("h-1.5 w-1.5 rounded-full", ROL_COLORS[rol])} />
              {ROL_LABELS[rol]}
            </span>
          )}

          <div className="flex items-center gap-2">
            <span className="max-w-[120px] truncate text-xs text-white/40">{usuario?.nombre}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[11px] font-semibold text-white shadow-lg shadow-violet-500/20">
              {usuario ? iniciales(usuario.nombre) : "?"}
            </div>
          </div>

          <Link
            href="/configuracion"
            title="Configuración"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
              pathname === "/configuracion"
                ? "border-amber-400/30 bg-amber-400/10 text-amber-400"
                : "border-white/[0.06] bg-white/[0.04] text-white/50 hover:border-amber-400/20 hover:text-white/90"
            )}
          >
            <Settings className="h-3.5 w-3.5" />
          </Link>

          <button
            onClick={() => signOut()}
            title="Cerrar sesión"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.04] text-white/50 transition-colors hover:border-red-400/30 hover:text-red-400"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Hamburguesa: mobile */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={mobileOpen}
          className="btn-premium flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.04] text-white/70 transition-colors hover:border-amber-400/20 hover:text-white/90 md:hidden"
        >
          {mobileOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
        </button>
      </div>
      <div className="gold-line" />

      {/* Panel mobile: agrupa navegacion, cliente (super_admin), vista de
          rol y sesion en un solo desplegable, en vez de comprimir todo en
          la barra como pasaba antes en pantallas angostas. */}
      {mobileOpen && (
        <div className="animate-in-soft border-b border-white/[0.06] bg-[hsl(230,15%,7%)]/98 backdrop-blur-xl md:hidden">
          <div className="mx-auto max-w-7xl space-y-1 px-4 py-3">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active ? "bg-amber-400/10 text-amber-400" : "text-white/70 hover:bg-white/[0.04] hover:text-white/90"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}

            <div className="my-2 h-px bg-white/[0.06]" />
            <InstalarAppBoton variant="mobile" />
            <Link
              href="/configuracion"
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname === "/configuracion" ? "bg-amber-400/10 text-amber-400" : "text-white/70 hover:bg-white/[0.04] hover:text-white/90"
              )}
            >
              <Settings className="h-4 w-4" />
              Configuración
            </Link>

            {esSuperAdmin && clientesDisponibles.length > 0 && (
              <>
                <div className="my-2 h-px bg-white/[0.06]" />
                <p className="px-3 text-[10px] font-medium uppercase tracking-wider text-white/40">Cliente</p>
                <div className="mt-1 flex flex-col gap-0.5">
                  {clientesDisponibles.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCliente(c.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        clienteId === c.id ? "bg-amber-400/10 text-amber-400" : "text-white/70 hover:bg-white/[0.04] hover:text-white/90"
                      )}
                    >
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{c.nombre}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="my-2 h-px bg-white/[0.06]" />

            {esSuperAdmin ? (
              <>
                <p className="px-3 text-[10px] font-medium uppercase tracking-wider text-white/40">Vista</p>
                <div className="mt-1 flex flex-col gap-0.5">
                  {VISTAS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setVista(r)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        rol === r ? "bg-amber-400/10 text-amber-400" : "text-white/70 hover:bg-white/[0.04] hover:text-white/90"
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", ROL_COLORS[r])} />
                      {ROL_LABELS[r]}
                    </button>
                  ))}
                </div>
                <div className="my-2 h-px bg-white/[0.06]" />
              </>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-white/70">
                <span className={cn("h-1.5 w-1.5 rounded-full", ROL_COLORS[rol])} />
                {ROL_LABELS[rol]}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[11px] font-semibold text-white shadow-lg shadow-violet-500/20">
                  {usuario ? iniciales(usuario.nombre) : "?"}
                </div>
                <span className="truncate text-sm text-white/70">{usuario?.nombre}</span>
              </div>
              <button
                onClick={() => signOut()}
                className="btn-premium flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:border-red-400/30 hover:text-red-400"
              >
                <LogOut className="h-3.5 w-3.5" /> Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
