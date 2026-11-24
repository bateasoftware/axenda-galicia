import type { Categoria } from "./tipos";

// Record<Categoria, …> obliga a que estén todas las de LISTA_CATEGORIAS (tipos.ts)

export const CATEGORIAS: Record<Categoria, { nombre: string; color: string; emoji: string }> = {
  navidad: { nombre: "Navidad", color: "#b42318", emoji: "🎄" },
  fiestas: { nombre: "Fiestas", color: "#c4320a", emoji: "🎉" },
  musica: { nombre: "Música", color: "#6941c6", emoji: "🎵" },
  cine: { nombre: "Cine", color: "#344054", emoji: "🎬" },
  teatro: { nombre: "Teatro", color: "#9e165f", emoji: "🎭" },
  infantil: { nombre: "Infantil", color: "#0e9384", emoji: "🧒" },
  deporte: { nombre: "Deporte", color: "#027a48", emoji: "🏅" },
  solidario: { nombre: "Solidario", color: "#c11574", emoji: "🤝" },
  mercadillo: { nombre: "Mercadillo", color: "#b54708", emoji: "🛍️" },
  gastronomia: { nombre: "Gastronomía", color: "#93370d", emoji: "🌰" },
  cultura: { nombre: "Cultura", color: "#175cd3", emoji: "📚" },
  comercial: { nombre: "Comercio local", color: "#475467", emoji: "🏪" },
};
