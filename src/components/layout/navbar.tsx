"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RolUsuario } from "@/lib/types";

const NAV_ITEMS: Record<RolUsuario, { href: string; label: string }[]> = {
  admin: [
    { href: "/", label: "Dashboard" },
    { href: "/pedidos", label: "Pedidos" },
  ],
  vendedor: [],
  empacador: [],
};

const ROLE_BADGE: Record<RolUsuario, { label: string; className: string }> = {
  admin: { label: "Admin", className: "bg-blue-100 text-blue-700" },
  vendedor: { label: "Vendedor", className: "bg-purple-100 text-purple-700" },
  empacador: { label: "Empacador", className: "bg-teal-100 text-teal-700" },
};

interface NavbarProps {
  rol: RolUsuario;
  onRolChange: (rol: RolUsuario) => void;
  nombreUsuario: string;
}

export function Navbar({ rol, onRolChange, nombreUsuario }: NavbarProps) {
  const pathname = usePathname();
  const items = NAV_ITEMS[rol];
  const badge = ROLE_BADGE[rol];

  return (
    <nav className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-1.5 text-base font-semibold sm:text-lg">
          <Zap className="h-5 w-5 text-primary" />
          <span className="hidden xs:inline sm:inline">automatik.io</span>
          <span className="inline xs:hidden sm:hidden">automatik</span>
        </Link>

        {items.length > 0 && (
          <div className="flex gap-0.5 rounded-lg bg-secondary/60 p-0.5">
            {items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
                    active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
          <select
            value={rol}
            onChange={(e) => onRolChange(e.target.value as RolUsuario)}
            aria-label="Cambiar rol"
            className="h-8 rounded-md border border-input bg-background px-1.5 text-xs text-muted-foreground sm:px-2"
          >
            <option value="admin">Admin</option>
            <option value="vendedor">Vendedor</option>
            <option value="empacador">Empacador</option>
          </select>

          <span className={cn("hidden rounded-full px-2.5 py-1 text-xs font-medium sm:inline-block", badge.className)}>
            {badge.label}
          </span>

          <span className="hidden text-sm text-muted-foreground md:inline">{nombreUsuario}</span>

          <button aria-label="Ajustes" className="hidden text-muted-foreground hover:text-foreground sm:block">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
