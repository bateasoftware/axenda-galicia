import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { exigirAdmin } from "@/lib/admin/sesion";
import { SITIO } from "@/lib/sitio";
import { COOKIE_PUBLICADO, type ResultadoPublicacion } from "@/lib/admin/publicacion";
import Publicado from "./Publicado";

export default function PaginaPublicado({ params }: PageProps<"/admin/publicado/[slug]">) {
  return (
    <Suspense fallback={<p className="py-10 text-[var(--gris)]">Cargando…</p>}>
      <Resultado params={params} />
    </Suspense>
  );
}

async function Resultado({ params }: Pick<PageProps<"/admin/publicado/[slug]">, "params">) {
  await exigirAdmin();
  const { slug } = await params;
  let r: ResultadoPublicacion | null = null;
  try {
    const x = JSON.parse((await cookies()).get(COOKIE_PUBLICADO)?.value ?? "null") as ResultadoPublicacion | null;
    if (x?.slug === slug) r = x;
  } catch {
    // cookie caducada o rota: se muestra lo básico
  }
  if (!r) {
    const url = `${SITIO.url}/evento/${slug}`;
    return (
      <div className="space-y-4">
        <p className="font-display text-xl">✓ Publicado</p>
        <a href={url} className="break-all underline">
          {url}
        </a>
        <p>
          <Link href="/admin" className="underline">
            ← Pendientes
          </Link>
        </p>
      </div>
    );
  }
  return <Publicado estado={r} />;
}
