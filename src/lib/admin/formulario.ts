// Conversión entre un evento y el formulario de revisión de /admin.
// Las sesiones y los lugares se editan como líneas de texto (cómodo en el móvil):
//   sesiones: "2026-11-22 17:00 | nota"  ·  "2026-11-22 17:00 - 19:30"  ·  "2026-12-05 10:00 - 2026-12-07 20:00"
//   lugares:  "Nombre | 42.1115, -8.7608 | dirección (opcional) | aprox (opcional)"
import { LISTA_CATEGORIAS, type Categoria, type EventoBorrador, type Lugar, type Sesion } from "../tipos";

export function sesionesATexto(sesiones: EventoBorrador["sesiones"]): string {
  return sesiones
    .map((s) => {
      const ini = s.inicio.replace("T", " ");
      const fin = s.fin ? (s.fin.slice(0, 10) === s.inicio.slice(0, 10) ? s.fin.slice(11) : s.fin.replace("T", " ")) : "";
      return `${ini}${fin ? ` - ${fin}` : ""}${s.nota ? ` | ${s.nota}` : ""}`;
    })
    .join("\n");
}

export function textoASesiones(texto: string): { sesiones: Sesion[]; errores: string[] } {
  const sesiones: Sesion[] = [];
  const errores: string[] = [];
  for (const [i, linea] of texto.split("\n").map((l) => l.trim()).filter(Boolean).entries()) {
    const [fechas, ...resto] = linea.split("|");
    const nota = resto.join("|").trim();
    const m = fechas.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})(?:\s*-\s*(?:(\d{4}-\d{2}-\d{2})[ T])?(\d{1,2}):(\d{2}))?$/);
    if (!m) {
      errores.push(`Sesión ${i + 1}: escribe "AAAA-MM-DD HH:MM", opcionalmente "- HH:MM" y "| nota" ("${linea}")`);
      continue;
    }
    const [, dia, h, mi, diaFin, hf, mf] = m;
    const inicio = `${dia}T${h.padStart(2, "0")}:${mi}`;
    const fin = hf ? `${diaFin ?? dia}T${hf.padStart(2, "0")}:${mf}` : undefined;
    sesiones.push({ inicio, ...(fin ? { fin } : {}), ...(nota ? { nota } : {}) });
  }
  return { sesiones, errores };
}

export function lugaresATexto(lugares: EventoBorrador["lugares"]): string {
  return lugares.map((l) => [l.nombre, `${l.lat}, ${l.lng}`, ...(l.direccion ? [l.direccion] : []), ...(l.aprox ? ["aprox"] : [])].join(" | ")).join("\n");
}

export function textoALugares(texto: string): { lugares: Lugar[]; errores: string[] } {
  const lugares: Lugar[] = [];
  const errores: string[] = [];
  for (const [i, linea] of texto.split("\n").map((l) => l.trim()).filter(Boolean).entries()) {
    const partes = linea.split("|").map((p) => p.trim());
    const [nombre, coords = "", ...resto] = partes;
    const m = coords.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (!nombre || !m) {
      errores.push(`Lugar ${i + 1}: escribe "Nombre | lat, lng" ("${linea}")`);
      continue;
    }
    const aprox = resto.some((r) => r.toLowerCase() === "aprox");
    const direccion = resto.filter((r) => r && r.toLowerCase() !== "aprox").join(", ");
    lugares.push({ nombre, lat: Number(m[1]), lng: Number(m[2]), ...(direccion ? { direccion } : {}), ...(aprox ? { aprox: true } : {}) });
  }
  return { lugares, errores };
}

const lista = (v: FormDataEntryValue | null, sep: RegExp) =>
  String(v ?? "")
    .split(sep)
    .map((x) => x.trim())
    .filter(Boolean);

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Lee el formulario sobre el evento original (que aporta fuente, confianza y lo no editable) */
export function formularioAEvento(f: FormData, original: EventoBorrador): { evento: EventoBorrador; errores: string[] } {
  const s = textoASesiones(texto(f, "sesiones"));
  const l = textoALugares(texto(f, "lugares"));
  const opcional = (k: string) => texto(f, k) || undefined;
  const inscripcion = {
    url: opcional("inscripcion_url"),
    telefono: opcional("inscripcion_telefono"),
    email: opcional("inscripcion_email"),
    hasta: opcional("inscripcion_hasta"),
  };
  const hayInscripcion = Object.values(inscripcion).some(Boolean);
  const categorias = f.getAll("categorias").map(String).filter((c): c is Categoria => (LISTA_CATEGORIAS as readonly string[]).includes(c));
  const idioma = texto(f, "idioma");

  // Se parte del original sin los opcionales editables, para que borrar un campo lo quite de verdad
  const { titulo_gl: _a, parroquia: _b, publico: _c, precio: _d, inscripcion: _e, extras: _f, inferido: _g, recurrente: _h, comercial: _i, ...base } = original;
  void [_a, _b, _c, _d, _e, _f, _g, _h, _i];

  const evento: EventoBorrador = {
    ...base,
    slug: texto(f, "slug"),
    titulo: texto(f, "titulo"),
    resumen: texto(f, "resumen"),
    sesiones: s.sesiones,
    lugares: l.lugares,
    concello: texto(f, "concello"),
    organizadores: lista(f.get("organizadores"), /[,\n]/),
    categorias,
    idioma: idioma === "gl" || idioma === "es" || idioma === "mixto" ? idioma : original.idioma,
    ...(opcional("titulo_gl") ? { titulo_gl: opcional("titulo_gl") } : {}),
    ...(opcional("parroquia") ? { parroquia: opcional("parroquia") } : {}),
    ...(opcional("publico") ? { publico: opcional("publico") } : {}),
    ...(opcional("precio") ? { precio: opcional("precio") } : {}),
    ...(hayInscripcion ? { inscripcion: Object.fromEntries(Object.entries(inscripcion).filter(([, v]) => v)) } : {}),
    ...(lista(f.get("extras"), /\n/).length ? { extras: lista(f.get("extras"), /\n/) } : {}),
    ...(lista(f.get("inferido"), /\n/).length ? { inferido: lista(f.get("inferido"), /\n/) } : {}),
    ...(f.get("recurrente") ? { recurrente: true } : {}),
    ...(f.get("comercial") ? { comercial: true } : {}),
  };
  return { evento, errores: [...s.errores, ...l.errores] };
}
