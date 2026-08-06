import { ImageResponse } from "next/og";

// Icono 512x512 para el manifest de la PWA (icono de alta resolucion /
// splash screen en Android). Se genera con next/og en vez de subir un PNG
// binario.
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
        <svg width="290" height="290" viewBox="0 0 24 24" fill="none">
          <path d="M13 2 3 14h7l-1 8 11-14h-7z" fill="#12131a" />
        </svg>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
