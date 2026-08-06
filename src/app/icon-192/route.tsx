import { ImageResponse } from "next/og";

// Icono 192x192 para el manifest de la PWA (pantalla de inicio en Android).
// Se genera con next/og en vez de subir un PNG binario.
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)",
        }}
      >
        <svg width="108" height="108" viewBox="0 0 24 24" fill="none">
          <path d="M13 2 3 14h7l-1 8 11-14h-7z" fill="#12131a" />
        </svg>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
