"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Download, Loader2, Printer, X } from "lucide-react";
import { descargarBlob } from "@/lib/pdf";

interface PdfViewerModalProps {
  blob: Blob;
  nombreArchivo: string;
  onClose: () => void;
}

// Visor de PDF en la propia app (pdf.js/pdfjs-dist renderizando cada pagina
// en un <canvas>): ver el comentario "novena vuelta" en src/lib/pdf.ts para
// el porque de este enfoque en vez de delegarle la apertura al navegador/SO.
export function PdfViewerModal({ blob, nombreArchivo, onClose }: PdfViewerModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");

  useEffect(() => {
    let cancelado = false;
    let pdfDoc: PDFDocumentProxy | null = null;

    async function render() {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const arrayBuffer = await blob.arrayBuffer();
        if (cancelado) return;
        pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelado) return;

        const contenedor = containerRef.current;
        if (!contenedor) return;
        contenedor.innerHTML = "";

        const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

        for (let numPagina = 1; numPagina <= pdfDoc.numPages; numPagina++) {
          if (cancelado) return;
          const pagina = await pdfDoc.getPage(numPagina);
          const viewportBase = pagina.getViewport({ scale: 1 });
          const anchoDisponible = Math.min(contenedor.clientWidth || 800, 900);
          const escala = anchoDisponible / viewportBase.width;
          const viewport = pagina.getViewport({ scale: escala * dpr });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${viewport.width / dpr}px`;
          canvas.style.height = `${viewport.height / dpr}px`;
          // Fix (imprimir desde la app): "pdf-print-page" es el gancho que
          // usa la hoja de estilos de impresion (ver globals.css) para
          // escalar cada pagina al ancho de la hoja y separarlas con un
          // salto de pagina -- ver el boton "Imprimir" mas abajo.
          canvas.className = "rounded-lg shadow-lg bg-white pdf-print-page";
          contenedor.appendChild(canvas);

          // pdfjs-dist v6: RenderParameters requiere "canvas" (no alcanza
          // con canvasContext, que quedo solo como opcion de compatibilidad
          // hacia atras) -- confirmado contra los tipos del paquete instalado
          // (node_modules/pdfjs-dist/types/src/display/api.d.ts).
          await pagina.render({ canvas, viewport }).promise;
          if (cancelado) return;
        }

        if (!cancelado) setEstado("listo");
      } catch (err) {
        console.error("Error renderizando PDF en el visor:", err);
        if (!cancelado) setEstado("error");
      }
    }

    render();

    return () => {
      cancelado = true;
      // PDFDocumentProxy no expone destroy() propio (solo cleanup(), que no
      // libera el worker) -- el metodo real esta en el loadingTask que lo
      // genero, ver PDFDocumentLoadingTask.destroy() en los tipos del
      // paquete instalado.
      pdfDoc?.loadingTask.destroy();
    };
  }, [blob]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Fix (imprimir desde la app): "pdf-viewer-dialog" es el gancho que usa
  // la regla global `body > *:not(.pdf-viewer-dialog) { display: none }`
  // (ver globals.css) para ocultar el resto de la pagina (navbar, tabla,
  // etc.) al imprimir -- el modal es HERMANO directo de esos elementos en
  // el DOM (RoleProvider/PdfViewerProvider en layout.tsx no agregan ningun
  // <div> propio, son puros Context.Provider), asi que basta con excluirlo
  // a el de la regla en vez de tener que ocultar/mostrar cada nodo.
  // print:static/print:overflow-visible neutralizan el "fixed inset-0" y el
  // "overflow-auto" (pensados para pantalla) que si no, recortarian el
  // documento a una sola altura de viewport en vez de dejar que el
  // navegador pagine el PDF completo.
  return (
    <div className="pdf-viewer-dialog fixed inset-0 z-[100] flex flex-col print:static print:h-auto"
      role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm print:hidden" onClick={onClose} />
      <div className="relative z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-background/95 px-4 py-3 print:hidden">
        <p className="truncate text-sm font-medium text-foreground">{nombreArchivo}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            disabled={estado !== "listo"}
            className="btn-premium inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs hover:bg-secondary transition-colors disabled:opacity-60"
          >
            <Printer className="h-3.5 w-3.5" /> Imprimir
          </button>
          <button
            type="button"
            onClick={() => descargarBlob(blob, nombreArchivo)}
            className="btn-premium inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs hover:bg-secondary transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Descargar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-premium inline-flex items-center justify-center rounded-md border border-input p-1.5 hover:bg-secondary transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="relative z-10 flex-1 overflow-auto px-4 py-6 print:overflow-visible print:p-0">
        {estado === "cargando" && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {estado === "error" && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">No se pudo mostrar la vista previa.</p>
            <button
              type="button"
              onClick={() => descargarBlob(blob, nombreArchivo)}
              className="btn-premium inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm hover:bg-secondary transition-colors"
            >
              <Download className="h-4 w-4" /> Descargar de todos modos
            </button>
          </div>
        )}
        <div ref={containerRef} className="mx-auto flex max-w-3xl flex-col items-center gap-4 print:max-w-none print:gap-0" />
      </div>
    </div>
  );
}
