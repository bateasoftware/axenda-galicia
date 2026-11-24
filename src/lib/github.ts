// Cliente mínimo de la API REST de GitHub (solo lo que necesita la entrada de eventos).

export class ErrorGitHub extends Error {
  constructor(
    public estado: number,
    mensaje: string,
  ) {
    super(`GitHub ${estado}: ${mensaje}`);
  }
}

export type PR = { numero: number; url: string; estado: "open" | "closed"; fusionado: boolean; cuerpo: string };

export type ClienteGitHub = {
  existeFichero(ruta: string, rama: string): Promise<boolean>;
  existeRama(rama: string): Promise<boolean>;
  crearRama(rama: string, desde: string): Promise<void>;
  subirFichero(rama: string, ruta: string, contenido: Buffer, mensaje: string): Promise<void>;
  crearPR(datos: { titulo: string; cuerpo: string; rama: string; base: string }): Promise<PR>;
  etiquetar(numero: number, etiquetas: string[]): Promise<void>;
  comentar(numero: number, texto: string): Promise<void>;
  /** Pull requests recientes (abiertos y cerrados) con una etiqueta */
  prsConEtiqueta(etiqueta: string): Promise<PR[]>;
};

export function clienteGitHub({
  token,
  repo,
  api = "https://api.github.com",
}: {
  token: string;
  repo: string;
  api?: string;
}): ClienteGitHub {
  async function peticion(ruta: string, init: RequestInit = {}, aceptar404 = false) {
    const res = await fetch(`${api}/repos/${repo}${ruta}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "axenda-entrada",
        ...init.headers,
      },
    });
    if (aceptar404 && res.status === 404) return null;
    if (!res.ok) throw new ErrorGitHub(res.status, (await res.text()).slice(0, 300));
    return res.status === 204 ? {} : res.json();
  }

  const aPR = (p: { number: number; html_url: string; state: "open" | "closed"; merged_at: string | null; body: string | null }): PR => ({
    numero: p.number,
    url: p.html_url,
    estado: p.state,
    fusionado: !!p.merged_at,
    cuerpo: p.body ?? "",
  });

  const ruta = (r: string) => r.split("/").map(encodeURIComponent).join("/");

  return {
    async existeFichero(r, rama) {
      return (await peticion(`/contents/${ruta(r)}?ref=${encodeURIComponent(rama)}`, {}, true)) !== null;
    },
    async existeRama(rama) {
      return (await peticion(`/git/ref/heads/${ruta(rama)}`, {}, true)) !== null;
    },
    async crearRama(rama, desde) {
      const base = await peticion(`/git/ref/heads/${ruta(desde)}`);
      await peticion(`/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${rama}`, sha: base.object.sha }) });
    },
    async subirFichero(rama, r, contenido, mensaje) {
      await peticion(`/contents/${ruta(r)}`, {
        method: "PUT",
        body: JSON.stringify({ message: mensaje, content: contenido.toString("base64"), branch: rama }),
      });
    },
    async crearPR({ titulo, cuerpo, rama, base }) {
      return aPR(await peticion(`/pulls`, { method: "POST", body: JSON.stringify({ title: titulo, body: cuerpo, head: rama, base }) }));
    },
    async etiquetar(numero, etiquetas) {
      await peticion(`/issues/${numero}/labels`, { method: "POST", body: JSON.stringify({ labels: etiquetas }) });
    },
    async comentar(numero, texto) {
      await peticion(`/issues/${numero}/comments`, { method: "POST", body: JSON.stringify({ body: texto }) });
    },
    async prsConEtiqueta(etiqueta) {
      // La API de issues filtra por etiqueta; cada issue que es PR trae pull_request.merged_at
      const issues: {
        number: number;
        html_url: string;
        state: "open" | "closed";
        body: string | null;
        pull_request?: { merged_at: string | null };
      }[] = await peticion(`/issues?labels=${encodeURIComponent(etiqueta)}&state=all&per_page=100&sort=created&direction=desc`);
      return issues
        .filter((i) => i.pull_request)
        .map((i) => aPR({ number: i.number, html_url: i.html_url, state: i.state, merged_at: i.pull_request!.merged_at, body: i.body }));
    },
  };
}
