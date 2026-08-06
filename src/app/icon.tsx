import { ImageResponse } from "next/og";

// Favicon generado con next/og en vez de un .ico estatico: usa el mismo
// gradiente ambar y el rayo del logo del navbar, asi que la pestaña del
// navegador deja de mostrar el icono generico de Next.js.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 7,
          background: "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M13 2 3 14h7l-1 8 11-14h-7z" fill="#12131a" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
