"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, LogOut } from "lucide-react";
import { useRole } from "@/lib/role-context";
import type { RolUsuario } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV_ITEMS: Record<RolUsuario, { label: string; href: string }[]> = {
  admin: [
    { label: "Dashboard", href: "/" },
    { label: "Pedidos", href: "/pedidos" },
    { label: "Equipo", href: "/admin/usuarios" },
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

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

export function Navbar() {
  const pathname = usePathname();
  const { rol, usuario, signOut } = useRole();

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

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {NAV_ITEMS[rol].map((item) => {
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

        {/* Right side */}
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70">
            <span className={cn("h-1.5 w-1.5 rounded-full", ROL_COLORS[rol])} />
            {ROL_LABELS[rol]}
          </span>

          <div className="hidden items-center gap-2 sm:flex">
            <span className="max-w-[120px] truncate text-xs text-white/40">{usuario?.nombre}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[11px] font-semibold text-white shadow-lg shadow-violet-500/20">
              {usuario ? iniciales(usuario.nombre) : "?"}
            </div>
          </div>

          <button
            onClick={() => signOut()}
            title="Cerrar sesión"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.04] text-white/50 transition-colors hover:border-red-400/30 hover:text-red-400"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="gold-line" />
    </nav>
  );
}
