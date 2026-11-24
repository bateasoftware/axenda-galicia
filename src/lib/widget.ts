// HTML autónomo del widget "Agenda de la zona" (se sirve en /widget/agenda y se inserta con un iframe).
import { CATEGORIAS } from "./categorias";
import { capitalizar, fechaCorta, hora, primerInicio, ultimoFin } from "./fechas";
import { slugConcello } from "./slug";
import type { Evento } from "./tipos";

export type OpcionesWidget = { concellos: string[]; n: number; tema: "claro" | "oscuro"; id: string };

export function leerOpciones(q: URLSearchParams): OpcionesWidget {
  const n = Math.min(20, Math.max(1, Number(q.get("n")) || 6));
  return {
    concellos: (q.get("concello") ?? "").split(",").map((x) => x.trim()).filter(Boolean),
    n,
    tema: q.get("tema") === "oscuro" ? "oscuro" : "claro",
    id: (q.get("id") ?? "").replace(/[^\w-]/g, "").slice(0, 40),
  };
}

/** Próximos eventos (que no han terminado a la hora actual de Galicia) de los concellos pedidos */
export function proximos(eventos: Evento[], ahora: string, o: OpcionesWidget): Evento[] {
  return eventos
    .filter((e) => ultimoFin(e) >= ahora && (!o.concellos.length || o.concellos.includes(slugConcello(e.concello))))
    .sort((a, b) => primerInicio(a).localeCompare(primerInicio(b)))
    .slice(0, o.n);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function htmlWidget(eventos: Evento[], o: OpcionesWidget, sitio: { nombre: string; url: string }, ahora: string): string {
  const lista = proximos(eventos, ahora, o);
  const ref = "utm_source=widget&utm_medium=iframe";
  const mas = o.concellos.length === 1 ? `${sitio.url}/concello/${o.concellos[0]}?${ref}` : `${sitio.url}/?${ref}`;
  const oscuro = o.tema === "oscuro";
  const items = lista
    .map((e) => {
      const ini = primerInicio(e);
      const h = hora(ini);
      const cat = CATEGORIAS[e.categorias[0]];
      return `<li><a href="${esc(`${sitio.url}/evento/${e.slug}?${ref}`)}" target="_blank" rel="noopener">
<span class="f">${esc(capitalizar(fechaCorta(ini)))}${h && h !== "00:00" ? ` · ${h}` : ""}</span>
<span class="t">${cat ? `${cat.emoji} ` : ""}${esc(e.titulo)}</span>
<span class="l">${esc(e.lugares[0]?.nombre ?? "")} · ${esc(e.concello)}</span></a></li>`;
    })
    .join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Agenda · ${esc(sitio.nombre)}</title><style>
*{box-sizing:border-box}body{margin:0;font:14px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;color:${oscuro ? "#f1f3f5" : "#0b2545"};background:${oscuro ? "#111827" : "#fff"}}
ul{list-style:none;margin:0;padding:0}li+li{border-top:1px solid ${oscuro ? "#2b3443" : "#ece6da"}}
a{display:block;padding:10px 12px;color:inherit;text-decoration:none}a:hover{background:${oscuro ? "#1b2433" : "#f8f4ec"}}
.f{display:block;font-size:12px;font-weight:600;color:${oscuro ? "#7cc4d8" : "#0b6e8a"}}.t{display:block;font-weight:600}.l{display:block;font-size:12px;opacity:.7}
.p{display:flex;justify-content:space-between;gap:8px;padding:8px 12px;font-size:12px;border-top:1px solid ${oscuro ? "#2b3443" : "#ece6da"}}.p a{display:inline;padding:0;text-decoration:underline}
.v{padding:16px 12px;opacity:.7}</style></head><body>
${items ? `<ul>${items}</ul>` : `<p class="v">No hay eventos próximos en la agenda.</p>`}
<div class="p"><a href="${esc(mas)}" target="_blank" rel="noopener">Ver toda la agenda →</a><a href="${esc(`${sitio.url}/enviar?${ref}`)}" target="_blank" rel="noopener">Publica tu evento</a></div>
<script>(function(){function a(){parent.postMessage({axenda:"altura",id:${JSON.stringify(o.id)},altura:document.documentElement.scrollHeight},"*")}a();addEventListener("load",a);addEventListener("resize",a)})()</script>
</body></html>`;
}
