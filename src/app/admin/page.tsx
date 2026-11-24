import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { almacen, almacenDisponible, NOMBRE_ALMACEN, type Pendiente } from "@/lib/almacen";
import { exigirAdmin } from "@/lib/admin/sesion";
import { capitalizar, fechaLarga, hora } from "@/lib/fechas";
import { MARCA_POR_COMPLETAR } from "@/lib/sin-ia";
import { validarEvento } from "@/lib/validacion";
import { salir } from "./acciones";

export default function Admin({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<p className="py-10 text-[var(--gris)]">Cargando pendientes…</p>}>
      <Lista searchParams={searchParams} />
    </Suspense>
  );
}

const NOMBRE_CANAL: Record<string, string> = {
  whatsapp: "WhatsApp",
  formulario: "Formulario",
  email: "Email",
  ics: "Calendario",
  "programa-pdf": "Programa PDF",
  "datos-abiertos": "Datos abiertos",
  manual: "Manual",
};

async function Lista({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  await exigirAdmin();
  if (!almacenDisponible())
    return (
      <p className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
        Falta configurar la base de datos (Turso: <code>TURSO_DATABASE_URL</code>, <code>TURSO_AUTH_TOKEN</code> y <code>BLOB_READ_WRITE_TOKEN</code>): en Vercel no hay otro sitio donde guardar los
        pendientes. Ver <code>docs/pendientes-juan.md</code>.
      </p>
    );
  const a = almacen();
  const { descartado } = await searchParams;
  // Los más próximos primero: son los que hay que publicar antes
  const pendientes = (await a.pendientes()).sort((x, y) => (x.evento.sesiones[0]?.inicio ?? "9").localeCompare(y.evento.sesiones[0]?.inicio ?? "9"));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Pendientes ({pendientes.length})</h1>
        <div className="flex gap-2 text-sm">
          <Link href="/admin/publicados" className="rounded-full border border-[var(--linea)] bg-white px-3 py-1.5 hover:border-[var(--tinta)]">
            Publicados
          </Link>
          <Link href="/admin/cobertura" className="rounded-full border border-[var(--linea)] bg-white px-3 py-1.5 hover:border-[var(--tinta)]">
            Cobertura
          </Link>
          <form action={salir}>
            <button className="rounded-full px-3 py-1.5 text-[var(--gris)] hover:underline">Salir</button>
          </form>
        </div>
      </div>
      <p className="mt-1 text-sm text-[var(--gris)]">Almacén: {NOMBRE_ALMACEN[a.tipo]}</p>
      {descartado && <p className="mt-4 rounded-xl bg-[var(--arena)] p-3 text-sm">Descartado.</p>}
      {!pendientes.length && <p className="mt-10 text-center text-[var(--gris)]">No hay nada pendiente. 🎉</p>}
      <ul className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-3">
        {pendientes.map((p) => (
          <Tarjeta key={p.id} p={p} />
        ))}
      </ul>
    </>
  );
}

function Tarjeta({ p }: { p: Pendiente }) {
  const e = p.evento;
  const v = validarEvento(e, null);
  const ini = e.sesiones[0]?.inicio;
  const porCompletar = !!e.inferido?.includes(MARCA_POR_COMPLETAR);
  const avisos = [
    !porCompletar && e.confianza < 0.8 && `confianza baja (${Math.round(e.confianza * 100)} %)`,
    !porCompletar && e.inferido?.length && `deducido: ${e.inferido.join(", ")}`,
    !v.ok && `${v.errores.length} ${v.errores.length === 1 ? "error" : "errores"} para publicar`,
  ].filter(Boolean) as string[];
  return (
    <li>
      <Link href={`/admin/${p.id}`} className="flex gap-3 rounded-2xl border border-[var(--linea)] bg-white p-3 hover:shadow-md">
        <div className="relative h-24 w-18 shrink-0 overflow-hidden rounded-lg bg-[var(--arena)]">
          {p.cartel ? (
            <Image src={p.cartel} alt="" fill sizes="72px" unoptimized className="object-cover" />
          ) : (
            <span className="grid h-full place-items-center text-2xl">{e.fuente.canal === "ics" ? "📅" : "📄"}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{e.titulo || "(sin título)"}</p>
          <p className="text-sm text-[var(--gris)]">
            {ini ? `${capitalizar(fechaLarga(ini))}${hora(ini) ? ` · ${hora(ini)}` : ""}` : "sin fecha"} · {e.concello || "sin concello"}
          </p>
          <p className="mt-1 text-xs text-[var(--gris)]">
            {NOMBRE_CANAL[e.fuente.canal] ?? e.fuente.canal}
            {e.fuente.id_fuente ? ` · ${e.fuente.id_fuente}` : ""}
            {p.contacto ? " · con aviso al remitente" : ""}
          </p>
          {porCompletar && <p className="mt-1 text-xs font-medium text-[var(--mar)]">✍️ Por completar a mano</p>}
          {p.duplicados.length > 0 && (
            <p className="mt-1 text-xs font-medium text-red-700">⚠ Posible duplicado ({p.duplicados.length})</p>
          )}
          {avisos.map((x) => (
            <p key={x} className="mt-0.5 truncate text-xs text-amber-800">
              ⚠ {x}
            </p>
          ))}
        </div>
      </Link>
    </li>
  );
}
