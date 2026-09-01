"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { fetchPdfBlob } from "@/lib/pdf";
import { PdfViewerModal } from "@/components/pedidos/pdf-viewer-modal";

// Provider global (montado una sola vez en layout.tsx) que le da a toda la
// app un unico punto para "abrir" una etiqueta: descarga el PDF (fetchPdfBlob,
// con los mismos chequeos de sesion/content-type de siempre) y lo muestra en
// un modal que lo renderiza con pdf.js -- ver el comentario "novena vuelta"
// en pdf.ts para el porque de este cambio. PdfLink sigue exponiendo la misma
// forma (Promise<{ok:true}|{ok:false,motivo}>) que ya usaba, asi que solo
// necesita cambiar de donde importa abrirPdf.
interface PdfViewerContextValue {
  abrirPdf: (url: string) => Promise<{ ok: true } | { ok: false; motivo: string }>;
}

const PdfViewerContext = createContext<PdfViewerContextValue | null>(null);

export function usePdfViewer(): PdfViewerContextValue {
  const ctx = useContext(PdfViewerContext);
  if (!ctx) throw new Error("usePdfViewer debe usarse dentro de <PdfViewerProvider>");
  return ctx;
}

interface DocumentoAbierto {
  blob: Blob;
  nombreArchivo: string;
}

export function PdfViewerProvider({ children }: { children: React.ReactNode }) {
  const [documento, setDocumento] = useState<DocumentoAbierto | null>(null);

  const abrirPdf = useCallback(async (url: string) => {
    const resultado = await fetchPdfBlob(url);
    if (!resultado.ok) return resultado;
    setDocumento({ blob: resultado.blob, nombreArchivo: resultado.nombreArchivo });
    return { ok: true as const };
  }, []);

  return (
    <PdfViewerContext.Provider value={{ abrirPdf }}>
      {children}
      {documento && (
        <PdfViewerModal
          blob={documento.blob}
          nombreArchivo={documento.nombreArchivo}
          onClose={() => setDocumento(null)}
        />
      )}
    </PdfViewerContext.Provider>
  );
}
