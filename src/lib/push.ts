import { supabase } from "./supabase";

// Llave publica VAPID (segura de exponer al navegador por diseño del
// protocolo Web Push -- la privada solo vive en la Edge Function
// send-push). Sin esta variable en Vercel, pushSoportado() devuelve false
// y el boton de notificaciones ni siquiera se muestra.
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function pushSoportado(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    Boolean(VAPID_PUBLIC_KEY)
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
