/** "Nigrán" → "nigran". Sin "server-only": se usa también en el cliente (filtros en la URL). */
export function slugConcello(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}
