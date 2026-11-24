import Link from "next/link";

/** Enlace a un posible duplicado ("evento:<slug>" o "pendiente:<id>") */
export default function EnlaceDuplicado({ refDup }: { refDup: string }) {
  const [tipo, valor] = refDup.split(":");
  return tipo === "evento" ? (
    <Link href={`/evento/${valor}`} target="_blank" className="underline">
      publicado «{valor}»
    </Link>
  ) : (
    <Link href={`/admin/${valor}`} className="underline">
      pendiente «{valor.slice(0, 24)}»
    </Link>
  );
}
