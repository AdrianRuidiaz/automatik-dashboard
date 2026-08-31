"use client";

// Tarea: "PDF de despacho" -- boton reusado por los 3 roles (admin,
// vendedor, empacador) en app/pedidos/page.tsx. No depende de AppShell ni de
// ningun estado compartido entre ramas de rol: solo necesita la lista de
// pedidos ya cargada por la pagina (misma prop que ya reciben
// OrdersTable/PackingCard/TaxDocsTable), asi que se pudo insertar en las 3
// ramas sin reestructurar el layout de la pagina.

import { useState } from "react";
import { FileDown } from "lucide-react";
import { descargarManifiestoDespacho, pedidosParaDespacharHoy } from "@/lib/manifiesto-despacho";
import type { Pedido } from "@/lib/types";

interface Props {
  pedidos: Pedido[];
  className?: string;
}

export function DescargarManifiestoButton({ pedidos, className }: Props) {
  const [bloqueado, setBloqueado] = useState(false);
  const cantidad = pedidosParaDespacharHoy(pedidos).length;

  return (
    <div className={className}>
      <button
        onClick={() => {
          const abierto = descargarManifiestoDespacho(pedidos);
          // Si el navegador bloqueo la ventana emergente (comun la primera
          // vez que se usa este boton en un sitio), se avisa explicitamente
          // en vez de fallar en silencio -- no hay libreria de toasts en el
          // proyecto, asi que un mensaje inline temporal es consistente con
          // el resto de la app.
          setBloqueado(!abierto);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
      >
        <FileDown className="h-4 w-4" />
        Descargar PDF
        {cantidad > 0 && (
          <span className="tabular ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1 text-[11px] font-bold text-primary">
            {cantidad}
          </span>
        )}
      </button>
      {bloqueado && (
        <p className="mt-1.5 text-xs text-rose-600">
          Tu navegador bloqueó la ventana. Habilita ventanas emergentes para este sitio e inténtalo de nuevo.
        </p>
      )}
    </div>
  );
}
