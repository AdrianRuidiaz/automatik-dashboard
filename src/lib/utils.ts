import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatFechaCorta(fecha: string | null): string {
  if (!fecha) return "—";
  const d = new Date(fecha);
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

export function formatFechaLarga(fecha: string | null): string {
  if (!fecha) return "—";
  const d = new Date(fecha);
  return d.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Parseo deliberadamente simple del user_agent que guarda auth.sessions.
// No pretende ser exhaustivo (no cubre cada navegador/SO existente) pero
// cubre los casos reales que va a tener el equipo: Windows/Mac/Linux en
// escritorio, Android/iOS en celular, y los navegadores mas comunes. El
// orden de los checks de navegador importa: Edge y Opera traen "Chrome" en
// su UA tambien, y Chrome trae "Safari", asi que hay que descartar los mas
// especificos primero.
export function parseUserAgent(ua: string | null): { dispositivo: string; navegador: string } {
  if (!ua) return { dispositivo: "Dispositivo desconocido", navegador: "" };

  const esMovil = /Mobi|Android|iPhone|iPad/i.test(ua);

  let so = "Desconocido";
  if (/iPhone|iPad/i.test(ua)) so = "iOS";
  else if (/Android/i.test(ua)) so = "Android";
  else if (/Mac OS X/i.test(ua)) so = "Mac";
  else if (/Windows/i.test(ua)) so = "Windows";
  else if (/Linux/i.test(ua)) so = "Linux";

  let navegador = "Navegador";
  if (/Edg\//i.test(ua)) navegador = "Edge";
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) navegador = "Opera";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) navegador = "Chrome";
  else if (/Firefox\//i.test(ua)) navegador = "Firefox";
  else if (/Safari\//i.test(ua)) navegador = "Safari";

  return {
    dispositivo: esMovil ? `Celular (${so})` : `Computador (${so})`,
    navegador,
  };
}
