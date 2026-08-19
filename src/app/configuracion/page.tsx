"use client";

import { useMemo, useState } from "react";
import { User, Bell, Palette, Shield, Building2, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";
import { EquipoManager } from "@/components/configuracion/equipo-manager";
import { SeccionCuenta } from "@/components/configuracion/seccion-cuenta";
import { SeccionSeguridad } from "@/components/configuracion/seccion-seguridad";
import { SeccionNotificaciones } from "@/components/configuracion/seccion-notificaciones";
import { SeccionApariencia } from "@/components/configuracion/seccion-apariencia";
import { SeccionEmpresa } from "@/components/configuracion/seccion-empresa";

type Seccion = "cuenta" | "seguridad" | "notificaciones" | "apariencia" | "empresa" | "equipo";

export default function ConfiguracionPage() {
  const { rolReal } = useRole();
  const [seccion, setSeccion] = useState<Seccion>("cuenta");

  // "Empresa" y "Equipo" solo tienen sentido para quien administra el
  // tenant -- un vendedor o empacador no deberia poder ver ni editar el
  // nombre/logo/RUT del negocio, ni invitar/quitar gente. La autorizacion
  // real vive en el RPC (actualizar_perfil_empresa) y en los endpoints
  // /api/admin/*, esto es solo para no mostrar pestañas que igual les
  // rebotarian.
  const puedeVerEmpresa = rolReal === "admin" || rolReal === "super_admin";

  const secciones = useMemo(() => {
    const base: { id: Seccion; label: string; icon: typeof User }[] = [
      { id: "cuenta", label: "Cuenta", icon: User },
      { id: "seguridad", label: "Seguridad", icon: Shield },
      { id: "notificaciones", label: "Notificaciones", icon: Bell },
      { id: "apariencia", label: "Apariencia", icon: Palette },
    ];
    if (puedeVerEmpresa) {
      base.push({ id: "empresa", label: "Empresa", icon: Building2 });
      base.push({ id: "equipo", label: "Equipo", icon: Users });
    }
    return base;
  }, [puedeVerEmpresa]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-medium">Configuración</h1>
          <p className="text-sm text-muted-foreground">Tu cuenta, notificaciones y apariencia del panel.</p>
        </div>

        <div className="flex flex-col gap-6 md:flex-row">
          <div className="flex gap-1 overflow-x-auto md:w-48 md:flex-none md:flex-col md:overflow-visible">
            {secciones.map((s) => {
              const Icon = s.icon;
              const activo = seccion === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSeccion(s.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    activo
                      ? "border-amber-400/20 bg-amber-400/10 text-amber-400"
                      : "border-transparent text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {s.label}
                </button>
              );
            })}
          </div>

          <div className="card-premium flex-1 p-5 sm:p-6">
            {seccion === "cuenta" && <SeccionCuenta />}
            {seccion === "seguridad" && <SeccionSeguridad />}
            {seccion === "notificaciones" && <SeccionNotificaciones />}
            {seccion === "apariencia" && <SeccionApariencia />}
            {seccion === "empresa" && puedeVerEmpresa && <SeccionEmpresa />}
            {seccion === "equipo" && puedeVerEmpresa && <EquipoManager />}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
