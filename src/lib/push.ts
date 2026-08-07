import { supabase } from "./supabase";

// Llave publica VAPID (segura de exponer al navegador por diseño del
// protocolo Web Push -- la privada solo vive en la Edge Function
// send-push, nunca en el frontend). Se hardcodea en vez de pedirla como
// variable de entorno de Vercel porque no es un secreto: el navegador la
// necesita a plena vista para poder suscribirse.
const VAPID_PUBLIC_KEY = "BLM9GbYEEC-kler9ih3cLWdSJQmLU_yX9-ATifLEXG9pNImgi0Onqo4j_gADtRRpAi3pkEer64B_2C1OLjzTspQ";

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  // El tipado DOM mas reciente parametriza Uint8Array<ArrayBufferLike> y
  // eso ya no encaja con BufferSource (que exige ArrayBuffer, no
  // SharedArrayBuffer) -- se castea explicito porque en tiempo de
  // ejecucion siempre es un ArrayBuffer normal (viene de `new
  // Uint8Array(length)`), el conflicto es solo de tipos.
  return outputArray.buffer as ArrayBuffer;
}

export function pushSoportado(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export async function obtenerSuscripcionActual(): Promise<PushSubscription | null> {
  if (!pushSoportado()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

interface ResultadoPush {
  ok: boolean;
  error?: string;
}

// Pide permiso de notificaciones, crea (o reutiliza) la suscripcion push
// del navegador y la guarda en Supabase via guardar_push_subscription. Esa
// funcion resuelve el cliente_id del lado del servidor a partir de
// usuarios_roles, asi que aca solo se manda endpoint/keys.
export async function activarNotificaciones(): Promise<ResultadoPush> {
  if (!pushSoportado()) {
    return { ok: false, error: "Este navegador no soporta notificaciones push" };
  }

  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") {
    return { ok: false, error: "Permiso de notificaciones denegado" };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = subscription.toJSON();
    const { error } = await supabase.rpc("guardar_push_subscription", {
      p_endpoint: json.endpoint,
      p_p256dh: json.keys?.p256dh,
      p_auth: json.keys?.auth,
      p_user_agent: navigator.userAgent,
    });
    if (error) throw error;

    return { ok: true };
  } catch (err) {
    console.error("No se pudo activar las notificaciones:", err);
    return { ok: false, error: "No se pudo activar las notificaciones. Intenta nuevamente." };
  }
}

export async function desactivarNotificaciones(): Promise<ResultadoPush> {
  if (!pushSoportado()) {
    return { ok: false, error: "Este navegador no soporta notificaciones push" };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      const { error } = await supabase.rpc("eliminar_push_subscription", { p_endpoint: endpoint });
      if (error) throw error;
    }
    return { ok: true };
  } catch (err) {
    console.error("No se pudo desactivar las notificaciones:", err);
    return { ok: false, error: "No se pudo desactivar las notificaciones." };
  }
}

// Tarea #73: notificaciones acotadas a 2 categorias (pedido nuevo / urgente),
// configurables por suscripcion (dispositivo/navegador). Las columnas
// notif_pedido_nuevo / notif_urgente en push_subscriptions arrancan en
// `true` por default, asi que un dispositivo recien suscrito recibe ambas
// categorias hasta que el usuario las desmarque.
export interface PreferenciasPush {
  pedidoNuevo: boolean;
  urgente: boolean;
}

const PREFERENCIAS_DEFAULT: PreferenciasPush = { pedidoNuevo: true, urgente: true };

export async function obtenerPreferenciasPush(): Promise<PreferenciasPush | null> {
  const sub = await obtenerSuscripcionActual();
  if (!sub) return null;
  const { data, error } = await supabase.rpc("obtener_preferencias_push", { p_endpoint: sub.endpoint });
  if (error) {
    console.error("No se pudieron leer las preferencias de notificaciones:", error);
    return PREFERENCIAS_DEFAULT;
  }
  const fila = Array.isArray(data) ? data[0] : null;
  if (!fila) return PREFERENCIAS_DEFAULT;
  return { pedidoNuevo: fila.notif_pedido_nuevo, urgente: fila.notif_urgente };
}

export async function actualizarPreferenciasPush(prefs: PreferenciasPush): Promise<ResultadoPush> {
  const sub = await obtenerSuscripcionActual();
  if (!sub) return { ok: false, error: "No hay una suscripción activa en este dispositivo" };

  const { error } = await supabase.rpc("actualizar_preferencias_push", {
    p_endpoint: sub.endpoint,
    p_notif_pedido_nuevo: prefs.pedidoNuevo,
    p_notif_urgente: prefs.urgente,
  });
  if (error) {
    console.error("No se pudieron guardar las preferencias de notificaciones:", error);
    return { ok: false, error: "No se pudieron guardar las preferencias." };
  }
  return { ok: true };
}
