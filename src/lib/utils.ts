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
