"use client";

import { Navbar } from "./navbar";
import { useRole } from "@/lib/role-context";
import type { RolUsuario } from "@/lib/types";

interface Props {
  children: ((rol: RolUsuario) => React.ReactNode) | React.ReactNode;
}

export function AppShell({ children }: Props) {
  const { rol, listo } = useRole();

  return (
    <div className="relative min-h-screen">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 left-1/4 h-[500px] w-[600px] rounded-full bg-amber-500/[0.03] blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[500px] rounded-full bg-violet-500/[0.02] blur-[100px]" />
      </div>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8">
        {!listo ? null : typeof children === "function" ? children(rol) : children}
      </main>
    </div>
  );
}
