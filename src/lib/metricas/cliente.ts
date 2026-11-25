// Envío de métricas desde el navegador: se agrupan y se mandan con sendBeacon (no retrasa nada).
// Sin cookies ni almacenamiento: solo se evita contar dos veces lo mismo mientras la página sigue abierta.
import type { TipoMetrica } from "./modelo";

const cola: [TipoMetrica, string][] = [];
const yaContado = new Set<string>();
let temporizador: ReturnType<typeof setTimeout> | null = null;

function enviar() {
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
  if (!cola.length) return;
  const cuerpo = JSON.stringify({ e: cola.splice(0, 80) });
  const ok = typeof navigator !== "undefined" && navigator.sendBeacon?.("/api/m", new Blob([cuerpo], { type: "text/plain" }));
  if (!ok) fetch("/api/m", { method: "POST", body: cuerpo, keepalive: true }).catch(() => {});
  if (cola.length) enviar();
}

let escuchando = false;
function alSalir() {
  if (escuchando || typeof window === "undefined") return;
  escuchando = true;
  // Al cerrar o cambiar de pestaña se manda lo que quede
  addEventListener("pagehide", enviar);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && enviar());
}

/**
 * Registra una métrica. Las vistas e impresiones se cuentan una vez por página abierta;
 * las acciones (cómo llegar, calendario…), cada vez.
 */
export function medir(tipo: TipoMetrica, slug: string) {
  if (typeof window === "undefined" || navigator.webdriver) return;
  if (tipo === "vista" || tipo === "impresion") {
    const k = `${tipo}:${slug}:${location.pathname}`;
    if (yaContado.has(k)) return;
    yaContado.add(k);
  }
  alSalir();
  cola.push([tipo, slug]);
  // Las acciones salen enseguida (suelen llevar a otra página); las impresiones, en grupo
  if (tipo !== "impresion" || cola.length >= 40) enviar();
  else temporizador ??= setTimeout(enviar, 4000);
}
