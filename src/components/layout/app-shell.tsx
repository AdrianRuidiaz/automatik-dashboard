"use client";

import { Navbar } from "./navbar";
import { useRole } from "@/lib/role-context";
import type { RolUsuario } from "@/lib/types";

interface AppShellProps {
  children: (rol: RolUsuario) => React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { rol, listo } = useRole();

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {listo ? (
          <div key={rol} className="animate-in-soft">
            {children(rol)}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="h-7 w-48 animate-pulse rounded-lg bg-secondary" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-secondary" />
              ))}
            </div>
            <div className="h-56 animate-pulse rounded-xl bg-secondary" />
          </div>
        )}
      </main>
    </div>
  );
}
