// Conversión entre un evento y el formulario de revisión de /admin.
// Todo va en campos sueltos (nada de escribir formatos a mano):
//  - sesiones: día, hora (opcional), "hasta el día" (opcional), hora de fin (opcional) y nota
//  - lugares: nombre, dirección (opcional) y coordenadas (opcionales: si faltan, se ponen solas)
import lugaresJSON from "../../../data/lugares.json";
import { finValido } from "../fechas";
import { LISTA_CATEGORIAS, type Categoria, type EventoBorrador, type Lugar, type Sesion } from "../tipos";

export type FilaSesion = { dia: string; hora: string; finDia: string; finHora: string; nota: string };
export type FilaLugar = { nombre: string; direccion: string; lat: string; lng: string; aprox: boolean };

export const FILA_SESION_VACIA: FilaSesion = { dia: "", hora: "", finDia: "", finHora: "", nota: "" };
export const FILA_LUGAR_VACIA: FilaLugar = { nombre: "", direccion: "", lat: "", lng: "", aprox: true };

const partirISO = (iso?: string) => ({ dia: iso?.slice(0, 10) ?? "", hora: iso && iso.length > 10 ? iso.slice(11, 16) : "" });

export function sesionesAFilas(sesiones: EventoBorrador["sesiones"]): FilaSesion[] {
  if (!sesiones?.length) return [{ ...FILA_SESION_VACIA }];
  return sesiones.map((s) => {
    const i = partirISO(s.inicio);
    const f = partirISO(s.fin);
    // Un fin del mismo día sin hora propia no aporta nada
    return { dia: i.dia, hora: i.hora, finDia: f.dia && f.dia !== i.dia ? f.dia : "", finHora: f.hora, nota: s.nota ?? "" };
  });
}

export function lugaresAFilas(lugares: EventoBorrador["lugares"]): FilaLugar[] {
  if (!lugares?.length) return [{ ...FILA_LUGAR_VACIA }];
  return lugares.map((l) => ({ nombre: l.nombre, direccion: l.direccion ?? "", lat: String(l.lat), lng: String(l.lng), aprox: !!l.aprox }));
}

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^\d{2}:\d{2}$/;

export function filasASesiones(filas: FilaSesion[]): { sesiones: Sesion[]; errores: string[] } {
  const sesiones: Sesion[] = [];
  const errores: string[] = [];
  filas.forEach((f, i) => {
    const n = `Sesión ${i + 1}`;
    if (!f.dia && !f.hora && !f.finDia && !f.finHora && !f.nota) return; // fila vacía
    if (!RE_DIA.test(f.dia)) return void errores.push(`${n}: elige el día`);
    if (f.hora && !RE_HORA.test(f.hora)) return void errores.push(`${n}: la hora no es válida`);
    if (f.finDia && !RE_DIA.test(f.finDia)) return void errores.push(`${n}: el día de fin no es válido`);
    if (f.finHora && !f.hora) return void errores.push(`${n}: para poner hora de fin, pon también la hora de inicio`);
    const inicio = f.hora ? `${f.dia}T${f.hora}` : f.dia;
    // Hora de fin: el mismo día salvo que se indique otro. Sin hora de fin, el fin es solo el día.
    const diaFin = f.finDia || (f.finHora ? f.dia : "");
    const fin = diaFin ? (f.finHora ? `${diaFin}T${f.finHora}` : diaFin) : undefined;
    if (fin && !finValido(inicio, fin)) return void errores.push(`${n}: el fin es anterior al inicio`);
    sesiones.push({ inicio, ...(fin && fin !== inicio ? { fin } : {}), ...(f.nota ? { nota: f.nota } : {}) });
  });
  return { sesiones, errores };
}

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

type Tabla = typeof lugaresJSON;

/**
 * Coordenadas de un lugar sin que haya que escribirlas: primero un lugar conocido con ese nombre
 * (data/lugares.json) y, si no, el centro del concello (aproximadas, para revisar en el mapa).
 */
export function ubicarLugar(nombre: string, concello: string, tabla: Tabla = lugaresJSON): Lugar | null {
  const n = normalizar(nombre);
  const conocido = tabla.lugares.find((l) => normalizar(l.nombre) === n && (!concello || normalizar(l.concello) === normalizar(concello)));
  if (conocido)
    return { nombre: conocido.nombre, lat: conocido.lat, lng: conocido.lng, ...(conocido.direccion ? { direccion: conocido.direccion } : {}), ...(conocido.aprox ? { aprox: true } : {}) };
  const c = Object.entries(tabla.concellos).find(([k]) => normalizar(k) === normalizar(concello));
  return c ? { nombre, lat: c[1].lat, lng: c[1].lng, aprox: true } : null;
}

export function filasALugares(filas: FilaLugar[], concello: string): { lugares: Lugar[]; errores: string[] } {
  const lugares: Lugar[] = [];
  const errores: string[] = [];
  filas.forEach((f, i) => {
    const n = `Lugar ${i + 1}`;
    if (!f.nombre && !f.direccion && !f.lat && !f.lng) return; // fila vacía
    if (!f.nombre) return void errores.push(`${n}: escribe el nombre del sitio`);
    const direccion = f.direccion ? { direccion: f.direccion } : {};
    if (f.lat || f.lng) {
      const lat = Number(f.lat.replace(",", "."));
      const lng = Number(f.lng.replace(",", "."));
      if (!f.lat || !f.lng || Number.isNaN(lat) || Number.isNaN(lng)) return void errores.push(`${n}: las coordenadas necesitan latitud y longitud (o déjalas vacías)`);
      lugares.push({ nombre: f.nombre, ...direccion, lat, lng, ...(f.aprox ? { aprox: true } : {}) });
      return;
    }
    const u = ubicarLugar(f.nombre, concello);
    if (!u) return void errores.push(`${n}: elige el concello para situarlo en el mapa (o escribe las coordenadas)`);
    lugares.push({ ...u, ...direccion });
  });
  return { lugares, errores };
}

const lista = (v: FormDataEntryValue | null, sep: RegExp) =>
  String(v ?? "")
    .split(sep)
    .map((x) => x.trim())
    .filter(Boolean);

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const columna = (f: FormData, k: string) => f.getAll(k).map((v) => String(v).trim());

/** Filas del formulario: cada campo llega como una lista paralela (ses_dia, ses_hora…) */
export function leerSesiones(f: FormData): FilaSesion[] {
  const [dia, hora, finDia, finHora, nota] = ["ses_dia", "ses_hora", "ses_fin_dia", "ses_fin_hora", "ses_nota"].map((k) => columna(f, k));
  return dia.map((d, i) => ({ dia: d, hora: hora[i] ?? "", finDia: finDia[i] ?? "", finHora: finHora[i] ?? "", nota: nota[i] ?? "" }));
}

export function leerLugares(f: FormData): FilaLugar[] {
  const [nombre, direccion, lat, lng, aprox] = ["lug_nombre", "lug_direccion", "lug_lat", "lug_lng", "lug_aprox"].map((k) => columna(f, k));
  return nombre.map((nom, i) => ({ nombre: nom, direccion: direccion[i] ?? "", lat: lat[i] ?? "", lng: lng[i] ?? "", aprox: aprox[i] !== "0" }));
}

/** Lee el formulario sobre el evento original (que aporta fuente, confianza y lo no editable) */
export function formularioAEvento(f: FormData, original: EventoBorrador): { evento: EventoBorrador; errores: string[] } {
  const concello = texto(f, "concello");
  const s = filasASesiones(leerSesiones(f));
  const l = filasALugares(leerLugares(f), concello);
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
  const { titulo_gl: _a, parroquia: _b, publico: _c, precio: _d, inscripcion: _e, extras: _f, inferido: _g, recurrente: _h, comercial: _i, destacado_hasta: _j, ...base } = original;
  void [_a, _b, _c, _d, _e, _f, _g, _h, _i, _j];

  const evento: EventoBorrador = {
    ...base,
    slug: texto(f, "slug") || original.slug,
    titulo: texto(f, "titulo"),
    resumen: texto(f, "resumen"),
    sesiones: s.sesiones,
    lugares: l.lugares,
    concello,
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
    ...(/^\d{4}-\d{2}-\d{2}$/.test(texto(f, "destacado_hasta")) ? { destacado_hasta: texto(f, "destacado_hasta") } : {}),
  };
  return { evento, errores: [...s.errores, ...l.errores] };
}
