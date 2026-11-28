import { COLORES } from "@/lib/marca";

/** El símbolo: anillo, hueco y punto. `tono` claro = sobre fondo oscuro (anillo blanco y hueco oscuro). */
export function Simbolo({ className, tono = "normal", titulo }: { className?: string; tono?: "normal" | "claro"; titulo?: string }) {
  const anillo = tono === "claro" ? COLORES.blanco : COLORES.tinta;
  const hueco = tono === "claro" ? COLORES.tinta : COLORES.blanco;
  return (
    <svg viewBox="0 0 100 100" className={className} role={titulo ? "img" : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true}>
      <circle cx="50" cy="50" r="50" fill={anillo} />
      <circle cx="50" cy="50" r="33" fill={hueco} />
      <circle cx="50" cy="50" r="14" fill={COLORES.rojo} />
    </svg>
  );
}

/**
 * El logotipo «altofalante» en Space Grotesk: la «o» es el símbolo (anillo del color del texto y punto rojo).
 * Hereda el tamaño y el color del texto; `sobreRojo` pone el punto en tinta (para fondos del color de marca).
 */
export function Logotipo({ className, sobreRojo = false }: { className?: string; sobreRojo?: boolean }) {
  return (
    <span className={`font-marca inline-flex items-baseline whitespace-nowrap ${className ?? ""}`} aria-label="altofalante" role="img">
      <span aria-hidden>alt</span>
      <svg viewBox="0 0 100 100" aria-hidden className="mx-[0.02em] h-[0.54em] w-[0.54em] self-baseline" style={{ transform: "translateY(0.02em)" }}>
        <circle cx="50" cy="50" r="41" fill="none" stroke="currentColor" strokeWidth="18" />
        <circle cx="50" cy="50" r="17" fill={sobreRojo ? COLORES.tinta : COLORES.rojo} />
      </svg>
      <span aria-hidden>falante</span>
    </span>
  );
}
