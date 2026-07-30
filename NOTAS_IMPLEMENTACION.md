# Notas de implementación — mejoras sistema de pedidos

## Archivos nuevos

- `src/lib/supabase-admin.ts` — cliente de Supabase con service role key, solo para usar en API routes (nunca en componentes de cliente). Tipado con generics `any` porque sin un tipo `Database<>` generado, `.select()`/`.update()` infieren `never` y rompen el build de TypeScript en Vercel.
- `src/app/api/pedidos/[id]/empacar/route.ts` — valida en el servidor que existan entre 1 y 3 fotos de evidencia antes de cambiar el estado de un pedido a `ready_to_ship`.
- `src/app/api/orders/verify-pdf/route.ts` — proxy a un webhook de n8n que verifica y obtiene la etiqueta/guía de despacho de un pedido.
- `src/components/pedidos/estado-badge.tsx` y `src/components/pedidos/filtro-pills.tsx` — componentes compartidos para no duplicar el badge de estado ni las filas de filtros entre la vista de Admin y la de Vendedor.

## Archivos modificados

`src/lib/types.ts`, `src/lib/api.ts`, `src/components/vendedor/tax-docs-table.tsx`, `src/components/vendedor/manual-order-form.tsx`, `src/components/empacador/packing-card.tsx`, `src/components/empacador/packing-history.tsx`, `src/components/pedidos/orders-table.tsx`.

## Corrección de base (prerequisito)

La tabla `public.archivos` en Supabase nunca tuvo columna `storage_path` ni valores de `tipo` como `evidencia` o `documento_tributario` — eso solo existía en el código del frontend, por eso nunca se había guardado ninguna evidencia ni documento tributario en producción. Se corrigió el **frontend** para usar el esquema real (`url`, y los valores de `tipo` que ya acepta la base: `etiqueta, boleta, factura, nota_credito, guia_despacho, evidencia_empaque, otro`). No se tocó la base de datos ni los workflows de n8n que ya escriben en `archivos`, para no romper nada de lo que ya funciona.

## Variables de entorno (ya configuradas en Vercel)

- `SUPABASE_SERVICE_ROLE_KEY` — para la ruta `/api/pedidos/[id]/empacar`. **Nunca** debe llevar el prefijo `NEXT_PUBLIC_`.
- `N8N_WEBHOOK_VERIFY_PDF_URL` — URL del webhook de n8n "Verificar y Obtener Etiqueta PDF (Pedido Manual)".

## Webhook de n8n `verify-pdf` (ya implementado)

`/api/orders/verify-pdf` llama a un webhook de n8n que **ya existe y está activo** (workflow `Verificar y Obtener Etiqueta PDF (Pedido Manual)`). No usa Dropbox — Dropbox en este proyecto es solo un relay temporal de 90 segundos para el flujo automático de Airtable, no un almacén persistente, así que no servía como fuente de verificación aquí.

Comportamiento real:

- **ML**: renueva el token, resuelve el envío, descarga la guía de despacho desde la API de Mercado Libre y la sube a Supabase Storage (bucket `etiquetas`), devolviendo una URL pública permanente.
- **Falabella (FA)**: el vendedor escribe el "Order Number" visible al abrir el pedido en Falabella Seller Center. Como `GetOrderItems`/`GetDocument` exigen el `OrderId` interno (no el `OrderNumber`) y la API de Falabella no permite filtrar pedidos por `OrderNumber`, el workflow escanea los pedidos de los últimos 180 días (paginado, hasta 500) buscando la coincidencia antes de pedir la etiqueta. Firma HMAC-SHA256 igual que el workflow de producción "Falabella → Airtable Pedidos".
- Otras plataformas: responde 422 pidiendo carga manual (el frontend ya lo soporta).

Respuesta: 200 `{ url, mensaje }` si encuentra la etiqueta, 404 si no encuentra el pedido o aún no hay etiqueta disponible, 500 si falla la subida a Supabase Storage.

## Sistema dual Supabase + Airtable

Este repo (Next.js) **solo escribe en Supabase**. La sincronización con Airtable vive en los workflows de n8n, fuera de este código. Lo que se hizo acá para la tarea de "robustez del sistema dual" fue:

- Manejo defensivo de errores en `registrarArchivo`, `upsertPedido` y en las nuevas rutas (si algo falla, se loguea con detalle y no se deja el formulario en un estado inconsistente ni se duplica información al reintentar).
- El registro del archivo de etiqueta en `manual-order-form.tsx` es no bloqueante: si el pedido ya se guardó bien pero falla solo el registro del archivo asociado, se loguea el error en vez de mostrarle al vendedor un error confuso sobre un pedido que en realidad sí quedó guardado.

Para una consistencia real de punta a punta con Airtable (ej. rollback si Airtable falla después de guardar en Supabase) hay que tocar los workflows de n8n, no este repo.

## Limitación importante: permisos por rol

El selector de rol (Admin / Vendedor / Empacador) en la barra de navegación es **solo un valor en `localStorage`**, no hay sesión real de Supabase Auth todavía. Las políticas RLS de `pedidos` y `archivos` están escritas para depender de `auth.uid()`, que hoy siempre es `null` porque no hay login.

Por eso las validaciones nuevas de esta entrega (fotos de evidencia, duplicados, PDF) se hicieron a nivel de **datos** (contar archivos, buscar por `id_plataforma`, etc.) usando la service role key donde hacía falta, no a nivel de "solo el rol X puede hacer Y". Si más adelante quieres que los permisos por rol sean reales (que un vendedor no pueda, por ejemplo, marcar pedidos como empacados desde la consola del navegador), hay que implementar login con Supabase Auth y ligarlo a la tabla `usuarios_roles` que ya existe — es un proyecto aparte, pero puedo ayudarte con eso cuando quieras.
