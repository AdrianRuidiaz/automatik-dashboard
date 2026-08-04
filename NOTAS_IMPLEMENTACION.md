# Notas de implementación — mejoras sistema de pedidos

## Archivos nuevos

- `src/lib/supabase-admin.ts` — cliente de Supabase con service role key, solo para usar en API routes (nunca en componentes de cliente). Tipado con generics `any` porque sin un tipo `Database<>` generado, `.select()`/`.update()` infieren `never` y rompen el build de TypeScript en Vercel.
- `src/app/api/pedidos/[id]/empacar/route.ts` — valida en el servidor que existan entre 1 y 3 fotos de evidencia antes de cambiar el estado de un pedido a `ready_to_ship`.
- `src/app/api/orders/verify-pdf/route.ts` — proxy a un webhook de n8n que verifica y obtiene la etiqueta/guía de despacho de un pedido.
- `src/app/api/orders/lookup/route.ts` — proxy a un webhook de n8n que busca un pedido por número de orden (ML o Falabella) y devuelve cliente, fecha, total e items para autocompletar el formulario de pedido manual.
- `src/components/pedidos/estado-badge.tsx` y `src/components/pedidos/filtro-pills.tsx` — componentes compartidos para no duplicar el badge de estado ni las filas de filtros entre la vista de Admin y la de Vendedor.

## Archivos modificados

`src/lib/types.ts`, `src/lib/api.ts`, `src/components/vendedor/tax-docs-table.tsx`, `src/components/vendedor/manual-order-form.tsx`, `src/components/empacador/packing-card.tsx`, `src/components/empacador/packing-history.tsx`, `src/components/pedidos/orders-table.tsx`.

## Corrección de base (prerequisito)

La tabla `public.archivos` en Supabase nunca tuvo columna `storage_path` ni valores de `tipo` como `evidencia` o `documento_tributario` — eso solo existía en el código del frontend, por eso nunca se había guardado ninguna evidencia ni documento tributario en producción. Se corrigió el **frontend** para usar el esquema real (`url`, y los valores de `tipo` que ya acepta la base: `etiqueta, boleta, factura, nota_credito, guia_despacho, evidencia_empaque, otro`). No se tocó la base de datos ni los workflows de n8n que ya escriben en `archivos`, para no romper nada de lo que ya funciona.

## Variables de entorno

- `SUPABASE_SERVICE_ROLE_KEY` — usada por `supabase-admin.ts` (rutas `/api/pedidos/[id]/empacar`, `/api/admin/bootstrap-status`, `/api/admin/bootstrap`, `/api/admin/invitar-usuario`). **Nunca** debe llevar el prefijo `NEXT_PUBLIC_`. Si falta en el entorno de Vercel, `/login` no puede saber si falta crear el primer admin (falla cerrado a "no hace falta bootstrap" y el login normal no funciona porque no hay usuarios).
- `N8N_WEBHOOK_VERIFY_PDF_URL` — URL del webhook de n8n "Verificar y Obtener Etiqueta PDF (Pedido Manual)".
- `N8N_WEBHOOK_LOOKUP_URL` — URL del webhook de n8n "Order Lookup API" (`.../webhook/280e1cc7-7340-477a-ac63-46f7b9fd80d7/order-lookup`). Sin esta variable, el botón "Buscar en API" del pedido manual siempre falla, aunque el workflow de n8n esté activo y funcionando.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_CLIENTE_ID` — ya configuradas, usadas tanto en cliente como servidor.

## Webhook de n8n `verify-pdf` (ya implementado)

`/api/orders/verify-pdf` llama a un webhook de n8n que **ya existe y está activo** (workflow `Verificar y Obtener Etiqueta PDF (Pedido Manual)`). No usa Dropbox — Dropbox en este proyecto es solo un relay temporal de 90 segundos para el flujo automático de Airtable, no un almacén persistente, así que no servía como fuente de verificación aquí.

Comportamiento real:

- **ML**: renueva el token, resuelve el envío, descarga la guía de despacho desde la API de Mercado Libre y la sube a Supabase Storage (bucket `etiquetas`), devolviendo una URL pública permanente.
- **Falabella (FA)**: el vendedor escribe el "Order Number" visible al abrir el pedido en Falabella Seller Center. Como `GetOrderItems`/`GetDocument` exigen el `OrderId` interno (no el `OrderNumber`) y la API de Falabella no permite filtrar pedidos por `OrderNumber`, el workflow escanea los pedidos de los últimos 180 días (paginado, hasta 500) buscando la coincidencia antes de pedir la etiqueta. Firma HMAC-SHA256 igual que el workflow de producción "Falabella → Airtable Pedidos".
- Otras plataformas: responde 422 pidiendo carga manual (el frontend ya lo soporta).

Respuesta: 200 `{ url, mensaje }` si encuentra la etiqueta, 404 si no encuentra el pedido o aún no hay etiqueta disponible, 500 si falla la subida a Supabase Storage.

## Webhook de n8n `order-lookup` (ya implementado)

`/api/orders/lookup` llama al workflow de n8n "Order Lookup API" (activo), que recibe `{order_number, platform}` y devuelve `{order_id, id_plataforma, cliente_nombre, total_pagado, fecha_pedido, fecha_limite_despacho, estado, items}`. Soporta ML (via token de ML_Tokens, prueba `/orders/{id}` y luego `/packs/{id}`) y Falabella (resuelve `OrderNumber` → `OrderId` escaneando `GetOrders`, igual que `verify-pdf`). El formulario de pedido manual usa esto para autocompletar todos los datos con solo el número de orden.

## Sistema dual Supabase + Airtable

Este repo (Next.js) **solo escribe en Supabase**. La sincronización con Airtable vive en los workflows de n8n, fuera de este código. Lo que se hizo acá para la tarea de "robustez del sistema dual" fue:

- Manejo defensivo de errores en `registrarArchivo`, `upsertPedido` y en las nuevas rutas (si algo falla, se loguea con detalle y no se deja el formulario en un estado inconsistente ni se duplica información al reintentar).
- El registro del archivo de etiqueta en `manual-order-form.tsx` es no bloqueante: si el pedido ya se guardó bien pero falla solo el registro del archivo asociado, se loguea el error en vez de mostrarle al vendedor un error confuso sobre un pedido que en realidad sí quedó guardado.

**Reintentos automáticos (n8n, no este repo):** los workflows `MercadoLibre → Airtable Pedidos` y `Falabella → Airtable Pedidos` ahora encolan en la tabla `public.sync_pendientes` (Supabase) cualquier upsert a Supabase que falle, y el workflow programado `Reintentar Sync Supabase (ML/FA)` (cada 15 min) los reintenta vía las funciones `encolar_sync_pendiente` / `tomar_sync_pendientes` / `resolver_sync_pendiente`. Además, `MercadoLibre → Airtable Pedidos` ahora cae al mismo `pending_orders` que ya usaba Falabella si falla la creación en Airtable (antes abortaba todo el workflow sin dejar rastro).

## Autenticación real (Supabase Auth + `usuarios_roles`)

Implementado: login con correo+contraseña o Google, sesión real (cookies vía `@supabase/ssr`), rutas protegidas por `middleware.ts`, rol derivado de la tabla `usuarios_roles` (ya no es un valor libre en `localStorage`).

- **Primer acceso**: `/login` detecta si `usuarios_roles` está vacía (`/api/admin/bootstrap-status`) y muestra un formulario para crear la primera cuenta, que queda como `super_admin` (`/api/admin/bootstrap`).
- **Invitar equipo**: pantalla `/admin/usuarios`, solo visible/usable por `admin`/`super_admin`. Llama a `/api/admin/invitar-usuario`, que verifica el rol del que invita contra la base (no confía en lo que mande el cliente) y usa `supabaseAdmin.auth.admin.inviteUserByEmail`.
- **super_admin**: puede alternar libremente entre las vistas admin/vendedor/empacador (selector en la navbar) para seguir probando el producto. El resto de roles solo ve su vista real.
- **Google OAuth**: requiere que el usuario configure un Client ID/Secret de Google Cloud y lo active en Supabase Auth → Providers → Google, además de agregar `/auth/callback` a las Redirect URLs permitidas. Sin eso, el botón de Google no funciona (el login con correo+contraseña sí).
- **Pendiente, a propósito, hasta confirmación del usuario**: las políticas RLS `"anon lee pedidos"`, `"anon lee archivos"` y `"anon inserta archivos"` siguen activas y le dan a cualquiera (sin sesión) acceso de lectura/escritura vía la `anon key`. Mientras existan, el sistema de roles es cosmético a nivel de base de datos. Hay que eliminarlas una vez que se confirme que el login funciona bien en producción.
