# Notas de implementación — mejoras sistema de pedidos

## Archivos nuevos

- `src/lib/supabase-admin.ts` — cliente de Supabase con service role key, solo para usar en API routes (nunca en componentes de cliente).
- `src/app/api/pedidos/[id]/empacar/route.ts` — valida en el servidor que existan entre 1 y 3 fotos de evidencia antes de cambiar el estado de un pedido a `ready_to_ship`.
- `src/app/api/orders/verify-pdf/route.ts` — proxy a un webhook de n8n que debe verificar en Dropbox si existe el PDF (guía de despacho / etiqueta) de un pedido.
- `src/components/pedidos/estado-badge.tsx` y `src/components/pedidos/filtro-pills.tsx` — componentes compartidos para no duplicar el badge de estado ni las filas de filtros entre la vista de Admin y la de Vendedor.

## Archivos modificados

`src/lib/types.ts`, `src/lib/api.ts`, `src/components/vendedor/tax-docs-table.tsx`, `src/components/vendedor/manual-order-form.tsx`, `src/components/empacador/packing-card.tsx`, `src/components/empacador/packing-history.tsx`, `src/components/pedidos/orders-table.tsx`.

## Corrección de base (prerequisito)

La tabla `public.archivos` en Supabase nunca tuvo columna `storage_path` ni valores de `tipo` como `evidencia` o `documento_tributario` — eso solo existía en el código del frontend, por eso nunca se había guardado ninguna evidencia ni documento tributario en producción. Se corrigió el **frontend** para usar el esquema real (`url`, y los valores de `tipo` que ya acepta la base: `etiqueta, boleta, factura, nota_credito, guia_despacho, evidencia_empaque, otro`). No se tocó la base de datos ni los workflows de n8n que ya escriben en `archivos`, para no romper nada de lo que ya funciona.

## Variables de entorno nuevas que hay que configurar

- `SUPABASE_SERVICE_ROLE_KEY` — para la ruta `/api/pedidos/[id]/empacar`. **Nunca** debe llevar el prefijo `NEXT_PUBLIC_`.
- `N8N_WEBHOOK_VERIFY_PDF_URL` — URL del webhook de n8n que verifica el PDF en Dropbox.

## Pendiente fuera de este repo (n8n)

`/api/orders/verify-pdf` ya está listo para llamar a n8n, pero **el webhook todavía no existe**. Hay que crearlo en n8n: recibe `{ order_number, platform }` y debe responder `200` con `{ url }` si encuentra el PDF en Dropbox, o un error si no existe. Puedo armarlo en una sesión de n8n cuando quieras, igual como ajustamos los workflows de ML/Falabella antes.

## Sistema dual Supabase + Airtable

Este repo (Next.js) **solo escribe en Supabase**. La sincronización con Airtable vive en los workflows de n8n, fuera de este código. Lo que se hizo acá para la tarea de "robustez del sistema dual" fue:

- Manejo defensivo de errores en `registrarArchivo`, `upsertPedido` y en las nuevas rutas (si algo falla, se loguea con detalle y no se deja el formulario en un estado inconsistente ni se duplica información al reintentar).
- El registro del archivo de etiqueta en `manual-order-form.tsx` es no bloqueante: si el pedido ya se guardó bien pero falla solo el registro del archivo asociado, se loguea el error en vez de mostrarle al vendedor un error confuso sobre un pedido que en realidad sí quedó guardado.

Para una consistencia real de punta a punta con Airtable (ej. rollback si Airtable falla después de guardar en Supabase) hay que tocar los workflows de n8n, no este repo.

## Limitación importante: permisos por rol

El selector de rol (Admin / Vendedor / Empacador) en la barra de navegación es **solo un valor en `localStorage`**, no hay sesión real de Supabase Auth todavía. Las políticas RLS de `pedidos` y `archivos` están escritas para depender de `auth.uid()`, que hoy siempre es `null` porque no hay login.

Por eso las validaciones nuevas de esta entrega (fotos de evidencia, duplicados, PDF en Dropbox) se hicieron a nivel de **datos** (contar archivos, buscar por `id_plataforma`, etc.) usando la service role key donde hacía falta, no a nivel de "solo el rol X puede hacer Y". Si más adelante quieres que los permisos por rol sean reales (que un vendedor no pueda, por ejemplo, marcar pedidos como empacados desde la consola del navegador), hay que implementar login con Supabase Auth y ligarlo a la tabla `usuarios_roles` que ya existe — es un proyecto aparte, pero puedo ayudarte con eso cuando quieras.
