// Tarea: "PDF de despacho" -- el usuario pidio una forma de revisar/verificar
// que se despacharon TODOS los pedidos que corresponden a un dia dado, y
// eligio explicitamente "solo PDF descargable" (sin checklist en la app, sin
// persistir marcas digitales) para los 3 roles (admin, vendedor, empacador).
//
// No hay ninguna libreria de generacion de PDF en el proyecto (ver
// package.json) ni un endpoint server-side para esto -- /api/pdf/route.ts es
// solo un proxy de PDFs que YA existen en Storage. En vez de sumar una
// dependencia nueva (jspdf, pdfmake, etc.), se reusa el mismo mecanismo que
// cualquier navegador ya trae: se abre una ventana nueva con un documento
// HTML de solo impresion (columna de casillero para marcar a mano en papel)
// y se dispara window.print(), que en Chrome/Edge/Safari permite guardar
// como PDF directamente desde el dialogo de impresion. Cero dependencias
// nuevas, cero backend nuevo.
//
// La ventana nueva es un documento HTML COMPLETO E INDEPENDIENTE (no un
// overlay con @media print sobre la app) a proposito: si se imprimiera la
// app tal cual, habria que ocultar con CSS el navbar, fondo ambiental,
// tarjetas KPI, etc. de TODA la pagina segun el rol activo. Una ventana en
// blanco con su propio HTML minimo es mucho mas simple y no puede arrastrar
// sin querer nada de la UI normal a la version impresa.

import type { Pedido } from "@/lib/types";

// "Hoy" se define como el dia calendario en America/Santiago (no una ventana
// rolling de 24h como el "vence pronto" del empacador en home-client --
// ese criterio es para urgencia relativa en todo momento; este es para un
// documento fisico de un dia especifico: "los pedidos que se despachan HOY").
// Comparar strings YYYY-MM-DD (locale en-CA) en vez de horas evita todo
// problema de huso horario/DST: dos fechas caen "el mismo dia" si esa
// representacion coincide, sin importar la hora exacta de cada una.
function diaSantiago(fechaISO: string): string {
  return new Date(fechaISO).toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}

/**
 * Pedidos que corresponden despachar en el dia calendario (America/Santiago)
 * de `referencia` (por defecto, ahora mismo): pendientes de empaque (mismo
 * criterio que el resto de la app -- empacado_en es la unica fuente de
 * verdad, no pedidos.estado) y cuyo fecha_limite_despacho cae ese dia.
 * Pedidos sin fecha_limite_despacho no se incluyen (no hay como saber si
 * corresponden a hoy). Orden ascendente por fecha_limite_despacho.
 */
export function pedidosParaDespacharHoy(pedidos: Pedido[], referencia: Date = new Date()): Pedido[] {
  const hoyStr = diaSantiago(referencia.toISOString());

  return pedidos
    .filter((p) => !p.empacado_en && !["cancelled", "returned", "not_paid"].includes(p.estado))
    .filter((p) => p.fecha_limite_despacho && diaSantiago(p.fecha_limite_despacho) === hoyStr)
    .sort((a, b) => {
      const fa = a.fecha_limite_despacho ? new Date(a.fecha_limite_despacho).getTime() : 0;
      const fb = b.fecha_limite_despacho ? new Date(b.fecha_limite_despacho).getTime() : 0;
      return fa - fb;
    });
}

function escapeHTML(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function itemsLabel(p: Pedido): string {
  return (p.items ?? [])
    .map((i) => `${i.quantity}x ${i.title}${i.sku ? ` (SKU: ${i.sku})` : ""}`)
    .join(", ");
}

function horaLimite(fecha: string | null): string {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santiago",
  });
}

// Exportada (ademas de usarse internamente en descargarManifiestoDespacho)
// para poder generar una vista previa del documento sin pasar por
// window.open/print -- ver script de prueba usado para el mockup enviado al
// usuario antes de publicar este cambio.
export function generarManifiestoHTML(pedidos: Pedido[], referencia: Date): string {
  // toLocaleDateString devuelve todo en minusculas ("domingo, 30 de agosto
  // de 2026") -- se capitaliza solo la primera letra a mano (no con CSS
  // text-transform: capitalize, que tambien pondria en mayuscula "de" y
  // rompe el sentido de una fecha en espanol).
  const fechaTituloRaw = referencia.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Santiago",
  });
  const fechaTitulo = fechaTituloRaw.charAt(0).toUpperCase() + fechaTituloRaw.slice(1);
  const generadoEl = referencia.toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Santiago",
  });

  const filas = pedidos
    .map(
      (p, i) => `
        <tr>
          <td class="check"><span class="box"></span></td>
          <td class="num">${i + 1}</td>
          <td>
            <span class="pedido">${escapeHTML(p.id_plataforma)}</span>
            <span class="plataforma">${p.plataforma === "ML" ? "ML" : "FA"}</span>
          </td>
          <td>${escapeHTML(p.cliente_nombre || "Sin cliente")}</td>
          <td>${escapeHTML(itemsLabel(p)) || "—"}</td>
          <td class="hora">${horaLimite(p.fecha_limite_despacho)}</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es-CL">
<head>
<meta charset="UTF-8" />
<title>Manifiesto de despacho - ${escapeHTML(fechaTitulo)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
    color: #1a1a1a;
    margin: 24px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-bottom: 2px solid #b8860b;
    padding-bottom: 10px;
    margin-bottom: 14px;
  }
  .marca {
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
  }
  .marca-badge {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 7px;
    background: linear-gradient(135deg, #fbbf24, #d97706);
  }
  .marca-badge svg { width: 14px; height: 14px; }
  .marca-nombre {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 19px;
    letter-spacing: -0.01em;
    color: #14151b;
  }
  .marca-nombre .marca-io { color: #b8860b; }
  h1 { font-size: 17px; margin: 0 0 2px; text-align: right; }
  .subtitulo { font-size: 11px; color: #555; margin: 0; text-align: right; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f2f2f2; font-weight: 600; }
  td.check { width: 28px; text-align: center; }
  td.num { width: 26px; text-align: center; color: #777; }
  td.hora { white-space: nowrap; }
  .box {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 1.5px solid #333;
    border-radius: 3px;
  }
  .pedido { font-weight: 600; display: block; }
  .plataforma { font-size: 9px; color: #777; }
  .vacio { padding: 24px 0; text-align: center; color: #777; font-size: 13px; }
  .footer { margin-top: 16px; font-size: 10px; color: #999; }
  @media print {
    body { margin: 10mm; }
    @page { size: A4 landscape; margin: 10mm; }
  }
</style>
</head>
<body>
  <header>
    <div class="marca">
      <span class="marca-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="#14151b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"/></svg>
      </span>
      <span class="marca-nombre">automatik<span class="marca-io">.io</span></span>
    </div>
    <div>
      <h1>Manifiesto de despacho — ${escapeHTML(fechaTitulo)}</h1>
      <p class="subtitulo">${pedidos.length} pedido${pedidos.length === 1 ? "" : "s"} por despachar hoy · generado ${escapeHTML(generadoEl)}</p>
    </div>
  </header>
  ${
    pedidos.length === 0
      ? `<p class="vacio">No hay pedidos pendientes de despacho para hoy.</p>`
      : `<table>
    <thead>
      <tr>
        <th></th>
        <th>#</th>
        <th>Pedido</th>
        <th>Cliente</th>
        <th>Contenido</th>
        <th>Hora límite</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
  </table>`
  }
  <p class="footer">Automatik · marca cada casillero al despachar físicamente el pedido.</p>
</body>
</html>`;
}

/**
 * Abre una ventana nueva con el manifiesto de despacho del dia y dispara el
 * dialogo de impresion del navegador (desde el cual se puede "Guardar como
 * PDF"). Devuelve false si el navegador bloqueo la ventana emergente, para
 * que el boton que lo llama pueda avisarle al usuario.
 */
export function descargarManifiestoDespacho(pedidos: Pedido[], referencia: Date = new Date()): boolean {
  const seleccionados = pedidosParaDespacharHoy(pedidos, referencia);
  const html = generarManifiestoHTML(seleccionados, referencia);

  const ventana = window.open("", "_blank", "width=1000,height=700");
  if (!ventana) return false;

  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();

  // Se espera a que la ventana termine de pintar (fuentes/layout) antes de
  // disparar el dialogo de impresion -- llamar print() de inmediato en
  // algunos navegadores (Safari en particular) puede abrir el dialogo sobre
  // un documento todavia en blanco.
  ventana.onload = () => {
    ventana.focus();
    ventana.print();
  };

  return true;
}
