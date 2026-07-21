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
  vendedor: [
    { href: "/vendedor", label: "Documentos" },
    { href: "/vendedor?tab=manual", label: "Pedido manual" },
  ],
  empacador: [{ href: "/empacador", label: "Empaque" }],
};

const ROLE_BADGE: Record<RolUsuario, { label: string; className: string }> = {
  admin: { label: "Admin", className: "bg-blue-100 text-blue-800" },
  vendedor: { label: "Vendedor", className: "bg-purple-100 text-purple-800" },
  empacador: { label: "Empacador", className: "bg-teal-100 text-teal-800" },
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
    <nav className="flex items-center gap-6 border-b border-border px-6 py-3">
      <Link href="/" className="flex items-center gap-2 text-lg font-medium">
        <Zap className="h-5 w-5 text-primary" />
        automatik.io
      </Link>

      <div className="flex gap-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href))
                ? "bg-secondary font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <select
          value={rol}
          onChange={(e) => onRolChange(e.target.value as RolUsuario)}
          className="rounded-md border border-input bg-transparent px-2 py-1 text-xs text-muted-foreground"
        >
          <option value="admin">Admin</option>
          <option value="vendedor">Vendedor</option>
          <option value="empacador">Empacador</option>
        </select>

        <span className={cn("rounded-md px-2.5 py-1 text-xs", badge.className)}>
          {badge.label}
        </span>

        <span className="text-sm text-muted-foreground">{nombreUsuario}</span>

        <button className="text-muted-foreground hover:text-foreground">
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
