import type { Evento } from "../src/lib/tipos";

/** Evento mínimo válido; cada test cambia solo lo que le interesa */
export function evento(cambios: Partial<Evento> = {}): Evento {
  return {
    slug: "prueba-2026",
    titulo: "Evento de prueba",
    resumen: "Un evento para los tests.",
    sesiones: [{ inicio: "2026-11-22T17:00" }],
    lugares: [{ nombre: "Praza Paradela", lat: 42.1115, lng: -8.7608 }],
    concello: "Gondomar",
    organizadores: ["Concello de Gondomar"],
    categorias: ["fiestas"],
    idioma: "es",
    fuente: { canal: "manual", recibido: "2026-11-19T09:52" },
    confianza: 0.95,
    ...cambios,
  };
}
