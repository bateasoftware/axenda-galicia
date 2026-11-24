import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { almacen, almacenDisponible, NOMBRE_ALMACEN, type Pendiente } from "@/lib/almacen";
import { COOKIE_LOTE, type ResultadoLote } from "@/lib/admin/lote";
import { exigirAdmin } from "@/lib/admin/sesion";
import { capitalizar, fechaLarga, hora } from "@/lib/fechas";
import { MARCA_POR_COMPLETAR } from "@/lib/sin-ia";
import { validarEvento } from "@/lib/validacion";
import registroFuentes from "../../../data/fuentes.json";
import { descartarVarios, salir } from "./acciones";
import BarraLote from "./BarraLote";

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
        Falta configurar la base de datos (Turso: <code>TURSO_DATABASE_URL</code>, y <code>TURSO_AUTH_TOKEN</code>): en Vercel no hay otro sitio donde guardar los
        pendientes. Ver <code>docs/pendientes-juan.md</code>.
      </p>
    );
  const a = almacen();
  const q = await searchParams;
  const un = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const [descartado, descartados, emisor, ver] = [un(q.descartado), un(q.descartados), un(q.emisor), un(q.ver)];
  // Resultado de «Publicar» por lotes: se guarda 10 minutos en una cookie y se enseña con ?lote=1
  let lote: ResultadoLote | null = null;
  if (un(q.lote)) {
    try {
      lote = JSON.parse((await cookies()).get(COOKIE_LOTE)?.value ?? "null");
    } catch {
      lote = null;
    }
  }
  // Los más próximos primero: son los que hay que publicar antes
  const todos = (await a.pendientes()).sort((x, y) => (x.evento.sesiones[0]?.inicio ?? "9").localeCompare(y.evento.sesiones[0]?.inicio ?? "9"));

  // Emisores: la fuente automática (cultura-gal, vigo-agenda-cultural…) o, si no la hay, el canal (WhatsApp, formulario…)
  const emisorDe = (p: Pendiente) => p.evento.fuente.id_fuente ?? p.evento.fuente.canal;
  const cuentas = new Map<string, number>();
  for (const p of todos) cuentas.set(emisorDe(p), (cuentas.get(emisorDe(p)) ?? 0) + 1);
  const nombres = new Map(registroFuentes.fuentes.map((f) => [f.id, f.nombre]));
  const esDuplicado = (p: Pendiente) => p.duplicados.length > 0;
  const esPorCompletar = (p: Pendiente) => !!p.evento.inferido?.includes(MARCA_POR_COMPLETAR);

  const pendientes = todos
    .filter((p) => (emisor ? emisorDe(p) === emisor : true))
    .filter((p) => (ver === "duplicados" ? esDuplicado(p) : ver === "completar" ? esPorCompletar(p) : true));
  const enlace = (params: Record<string, string | undefined>) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    return qs.size ? `/admin?${qs}` : "/admin";
  };
  const chip = (activo: boolean) =>
    `rounded-full border px-3 py-1 text-sm whitespace-nowrap ${activo ? "border-[var(--tinta)] bg-[var(--arena)] font-medium" : "border-[var(--linea)] bg-white hover:border-[var(--tinta)]"}`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">
          Pendientes ({pendientes.length}
          {pendientes.length !== todos.length ? ` de ${todos.length}` : ""})
        </h1>
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
      {descartados && <p className="mt-4 rounded-xl bg-[var(--arena)] p-3 text-sm">Descartados {descartados} pendientes.</p>}
      {lote && (
        <div role="status" className="mt-4 space-y-2 rounded-xl border border-[var(--linea)] bg-white p-3 text-sm">
          <p className="font-medium">
            {lote.publicados > 0 ? `✓ Publicados ${lote.publicados} ${lote.publicados === 1 ? "evento" : "eventos"}. La web se actualiza en unos segundos.` : "No se ha publicado ninguno."}
          </p>
          {lote.omitidos.length > 0 && (
            <div className="text-amber-900">
              <p className="font-medium">Se han dejado en pendientes ({lote.omitidos.length}):</p>
              <ul className="mt-1 list-inside list-disc">
                {lote.omitidos.map((o, i) => (
                  <li key={i}>
                    {o.titulo}: {o.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {lote.avisar.length > 0 && (
            <div className="text-red-900">
              <p className="font-medium">Avisa a mano por WhatsApp (no se ha podido enviar; el número no se guarda):</p>
              <ul className="mt-1 list-inside list-disc">
                {lote.avisar.map((x, i) => (
                  <li key={i}>
                    +{x.numero}: «{x.titulo}» {x.url}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {todos.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sin-barra" aria-label="Filtrar por emisor">
            <Link href={enlace({ ver })} className={chip(!emisor)}>
              Todos ({todos.length})
            </Link>
            {[...cuentas.entries()]
              .sort((x, y) => y[1] - x[1])
              .map(([clave, n]) => (
                <Link key={clave} href={enlace({ emisor: clave, ver })} title={nombres.get(clave)} className={chip(emisor === clave)}>
                  {nombres.get(clave) ? clave : (NOMBRE_CANAL[clave] ?? clave)} ({n})
                </Link>
              ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={enlace({ emisor, ver: ver === "duplicados" ? undefined : "duplicados" })} className={chip(ver === "duplicados")}>
              ⚠ Posibles duplicados ({todos.filter(esDuplicado).length})
            </Link>
            <Link href={enlace({ emisor, ver: ver === "completar" ? undefined : "completar" })} className={chip(ver === "completar")}>
              ✍️ Por completar ({todos.filter(esPorCompletar).length})
            </Link>
          </div>
        </div>
      )}

      {!pendientes.length && (
        <p className="mt-10 text-center text-[var(--gris)]">
          {todos.length ? (
            <>
              No hay pendientes con este filtro.{" "}
              <Link href="/admin" className="underline">
                Ver todos
              </Link>
            </>
          ) : (
            "No hay nada pendiente. 🎉"
          )}
        </p>
      )}
      {pendientes.length > 0 && (
        <form id="lote" action={descartarVarios}>
          <input type="hidden" name="emisor" value={emisor ?? ""} />
          <input type="hidden" name="ver" value={ver ?? ""} />
          <ul className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3">
            {pendientes.map((p) => (
              <Tarjeta key={p.id} p={p} />
            ))}
          </ul>
          <BarraLote visibles={pendientes.length} />
        </form>
      )}
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
    <li className="flex items-stretch gap-2">
      <label className="flex shrink-0 cursor-pointer items-center px-1" aria-label={`Seleccionar «${e.titulo || "sin título"}»`}>
        <input type="checkbox" name="ids" value={p.id} className="h-5 w-5 accent-[var(--tinta)]" />
      </label>
      <Link href={`/admin/${p.id}`} className="flex min-w-0 flex-1 gap-3 rounded-2xl border border-[var(--linea)] bg-white p-3 hover:shadow-md">
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
