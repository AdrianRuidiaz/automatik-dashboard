"use client";

// Tarea (fix 2026-09-01, "no se puede abrir el PDF"): reemplaza el patron
// <a href={pdfUrl(url)} target="_blank"> / window.open(pdfUrl(url)) usado
// en 6 lugares (detalle de pedido -- hay DOS componentes de detalle
// distintos, home de vendedor/tarjeta de pedido, documentos tributarios,
// tabla de pedidos y su tarjeta mobile) por un boton que llama a
// abrirPdf() -- ver el comentario largo en src/lib/pdf.ts para el porque.
// Mantiene el mismo look & feel (recibe className/children igual que el
// <a> que reemplaza) y agrega un mensaje de error inline en vez de dejar
// que el sistema operativo muestre uno generico sin explicacion.
//
// stopPropagation: la tabla de pedidos (orders-table.tsx) usa este boton
// DENTRO de una fila que tiene su propio onClick (abre el detalle) -- el
// <a>/span original llamaba a e.stopPropagation() en el evento de click
// original antes de abrir el PDF. Como aca el click dispara un flujo async
// (fetch), stopPropagation tiene que llamarse de forma SINCRONICA dentro
// del handler, antes de cualquier await -- por eso el prop existe y se usa
// explicitamente en el onClick, no se puede lograr envolviendo el boton en
// otro elemento con su propio stopPropagation (el evento ya habria
// burbujeado para cuando el await se resuelve).
//
// as="span": la tarjeta mobile de la tabla de pedidos (orders-table.tsx)
// pone este componente DENTRO de un <button> (la fila completa es
// clickeable). HTML no permite anidar <button> dentro de <button> -- el
// original usaba <span role="button"> ahi mismo por lo mismo. Con
// as="span" se renderiza como span+role=button+tabIndex en vez de un
// <button> real, evitando el anidamiento invalido mientras se mantiene
// clickeable con mouse/teclado.

import { useState } from "react";
import { usePdfViewer } from "@/lib/pdf-viewer-context";

interface PdfLinkProps {
  url: string;
  // Fix 2026-09-01 (decima vuelta): nombre del comprador del pedido, para
  // que el archivo descargado se llame "etiqueta_<comprador>.pdf" en vez de
  // siempre "etiqueta.pdf" -- ver el comentario en src/lib/pdf.ts. Opcional
  // porque no todos los llamadores tienen el pedido completo a mano; sin el
  // (o null) el nombre de archivo cae al comportamiento de siempre.
  nombreCliente?: string | null;
  className?: string;
  children: React.ReactNode;
  stopPropagation?: boolean;
  as?: "button" | "span";
}

// Fix 2026-09-01 (novena vuelta): abrirPdf ya no viene de src/lib/pdf.ts
// directo, sino del contexto global PdfViewerProvider (ver
// src/lib/pdf-viewer-context.tsx) -- misma firma de siempre
// (Promise<{ok:true}|{ok:false,motivo}>), pero ahora en vez de descargar el
// archivo lo abre en el visor en pantalla completa dentro de la app.
export function PdfLink({ url, nombreCliente, className, children, stopPropagation, as = "button" }: PdfLinkProps) {
  const { abrirPdf } = usePdfViewer();
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const activar = async (e: { stopPropagation: () => void }) => {
    if (stopPropagation) e.stopPropagation();
    if (cargando) return;
    setError(null);
    setCargando(true);
    const resultado = await abrirPdf(url, nombreCliente);
    setCargando(false);
    if (!resultado.ok) setError(resultado.motivo);
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      {as === "span" ? (
        <span
          role="button"
          tabIndex={0}
          aria-disabled={cargando}
          onClick={activar}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activar(e); } }}
          className={className}
        >
          {children}
        </span>
      ) : (
        <button type="button" disabled={cargando} onClick={activar} className={className}>
          {children}
        </button>
      )}
      {error && <span className="max-w-[220px] text-xs text-rose-600">{error}</span>}
    </span>
  );
}
