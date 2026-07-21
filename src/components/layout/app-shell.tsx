"use client";

import { useState } from "react";
import { Navbar } from "./navbar";
import type { RolUsuario } from "@/lib/types";

interface AppShellProps {
  children: (rol: RolUsuario) => React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [rol, setRol] = useState<RolUsuario>("admin");

  return (
    <div className="min-h-screen">
      <Navbar rol={rol} onRolChange={setRol} nombreUsuario="Adrian" />
      <main className="mx-auto max-w-5xl px-6 py-6">{children(rol)}</main>
    </div>
  );
}
