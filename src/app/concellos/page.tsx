import type { Metadata } from "next";
import Link from "next/link";
import { concellos } from "@/lib/eventos";

export const metadata: Metadata = { title: "Concellos", description: "Agenda de eventos por concello." };

export default async function Concellos() {
  return (
    <>
      <h1 className="mb-6 font-display text-3xl">Eventos por concello</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {(await concellos()).map((c) => (
          <Link key={c.slug} href={`/concello/${c.slug}`} className="flex items-center justify-between rounded-2xl border border-[var(--linea)] bg-white p-5 hover:shadow-md">
            <span className="font-display text-xl">{c.nombre}</span>
            <span className="text-sm text-[var(--gris)]">{c.total} eventos →</span>
          </Link>
        ))}
      </div>
    </>
  );
}
