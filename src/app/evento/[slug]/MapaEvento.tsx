"use client";

import dynamic from "next/dynamic";
import type { Evento } from "@/lib/tipos";

const Mapa = dynamic(() => import("@/components/Mapa"), {
  ssr: false,
  loading: () => <div className="h-[260px] animate-pulse rounded-2xl bg-[var(--arena)]" />,
});

export default function MapaEvento({ evento }: { evento: Evento }) {
  return <Mapa eventos={[evento]} alto={260} />;
}
