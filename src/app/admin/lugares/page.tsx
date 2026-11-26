import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { almacen, almacenDisponible } from "@/lib/almacen";
import { exigirAdmin } from "@/lib/admin/sesion";
import { todosLosEventos } from "@/lib/eventos";
import { claveLugar, SEMILLA } from "@/lib/lugares";
import { lugaresHabituales } from "@/lib/lugares-datos";
import { sugerirLugares } from "@/lib/lugares-sugeridos";
import GestorLugares from "./GestorLugares";

export default function Lugares() {
  return (
    <Suspense fallback={<p className="py-10 text-[var(--gris)]">Cargando lugares…</p>}>
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  await exigirAdmin();
  await connection();
  if (!almacenDisponible()) return <p className="mt-6">Falta configurar la base de datos (ver docs/pendientes-juan.md).</p>;
  const a = almacen();
  const [lugares, eventos] = await Promise.all([lugaresHabituales(a), todosLosEventos()]);
  // Cuántos eventos publicados usan cada lugar (por nombre y concello)
  const usos: Record<string, number> = {};
  for (const e of eventos) for (const l of e.lugares) usos[claveLugar(l.nombre, e.concello)] = (usos[claveLugar(l.nombre, e.concello)] ?? 0) + 1;
  // Sitios que salen en eventos publicados y aún no son lugares habituales
  const sugerencias = sugerirLugares(eventos, { concellos: SEMILLA.concellos, lugares }).filter((s) => s.tipo === "nuevo");

  return (
    <div className="lg:relative lg:left-1/2 lg:w-[min(calc(100vw-3rem),80rem)] lg:-translate-x-1/2">
      <Link href="/admin" className="text-sm text-[var(--gris)] hover:underline">
        ← Pendientes
      </Link>
      <h1 className="mt-2 font-display text-3xl">Lugares habituales ({lugares.length})</h1>
      <p className="mt-1 text-sm text-[var(--gris)]">
        Los sitios donde suele haber eventos. Al revisar un evento, escribe su nombre y las coordenadas se ponen solas. Para situarlos: clic en el mapa, o
        pega las coordenadas de Google Maps (clic derecho sobre el sitio → se copian).
      </p>
      <GestorLugares
        lugares={lugares}
        usos={usos}
        concellos={Object.keys(SEMILLA.concellos)}
        parroquias={Object.fromEntries(Object.entries(SEMILLA.concellos).map(([k, v]) => [k, v.parroquias]))}
        centros={Object.fromEntries(Object.entries(SEMILLA.concellos).map(([k, v]) => [k, [v.lat, v.lng] as [number, number]]))}
        sugerencias={sugerencias}
      />
    </div>
  );
}
