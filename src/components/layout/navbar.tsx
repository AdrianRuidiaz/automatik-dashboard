"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/lib/role-context";
import type { RolUsuario } from "@/lib/types";

const NAV_ITEMS: Record<RolUsuario, { href: string; label: string }[]> = {
  admin: [
    { href: "/", label: "Dashboard" },
    { href: "/pedidos", label: "Pedidos" },
  ],
  vendedor: [],
  empacador: [],
};

const ROLES: { value: RolUsuario; label: string; dot: string }[] = [
  { value: "admin", label: "Admin", dot: "bg-indigo-500" },
  { value: "vendedor", label: "Vendedor", dot: "bg-violet-500" },
  { value: "empacador", label: "Empacador", dot: "bg-teal-500" },
];

export function Navbar() {
  const pathname = usePathname();
  const { rol, setRol } = useRole();
  const items = NAV_ITEMS[rol];
  const actual = ROLES.find((r) => r.value === rol)!;

  return (
    <nav className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:gap-5 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Zap className="h-4 w-4 text-primary" />
          </span>
          <span className="display text-lg sm:text-xl">
            automatik<em>.io</em>
          </span>
        </Link>

        {items.length > 0 && (
          <div className="flex gap-0.5 rounded-xl bg-secondary/70 p-1">
            {items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-all sm:text-sm",
                    active
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="relative">
            <span className={cn("pointer-events-none absolute left-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full", actual.dot)} />
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as RolUsuario)}
              aria-label="Cambiar rol"
              className="h-9 appearance-none rounded-lg border border-input bg-card pl-6 pr-7 text-xs font-medium text-foreground transition-colors hover:border-primary/40 focus:border-primary sm:text-sm"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>

          <span className="hidden text-sm text-muted-foreground md:inline">Adrian</span>

          <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-[11px] font-semibold text-white sm:flex">
            AR
          </span>
        </div>
      </div>
    </nav>
  );
}
