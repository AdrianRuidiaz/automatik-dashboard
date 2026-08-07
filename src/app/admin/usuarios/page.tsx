"use client";

import { AppShell } from "@/components/layout/app-shell";
import { EquipoManager } from "@/components/configuracion/equipo-manager";

// La gestion de equipo ahora vive en Configuracion > Equipo (se saco del
// navbar para agrupar todo lo administrativo en un solo lugar). Esta ruta
// se deja viva por compatibilidad con links guardados, reusando el mismo
// componente en vez de duplicar la logica.
export default function UsuariosPage() {
  return (
    <AppShell>
      <EquipoManager />
    </AppShell>
  );
}
