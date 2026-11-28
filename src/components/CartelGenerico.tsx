import type { ReactNode } from "react";
import { categoriaIlustracion } from "@/lib/categorias";
import type { Categoria } from "@/lib/tipos";

// Ilustración genérica para los eventos sin cartel, según su categoría. Es solo presentación: no se guarda
// en ningún sitio y, si el evento tiene cartel, no se usa. Sin texto, personas ni marcas, y con un estilo
// ilustrado que no se confunde con un cartel real. Lienzo 300×400 (3:4), como los carteles.
const AZUL = "#16181d"; // tinta de marca
const MAR = "#c4381f"; // rojo de marca, algo más oscuro
const SALVIA = "#9dbfb0";
const NARANJA = "#f27d52";
const CREMA = "#fbf3e6";
const AMARILLO = "#f6c453";

type Ilustracion = { fondo: string; dibujo: ReactNode };

const ILUSTRACIONES: Record<Categoria, Ilustracion> = {
  navidad: {
    fondo: "#0f2f4a",
    dibujo: (
      <>
        {[[40, 60], [90, 110], [220, 70], [260, 140], [60, 200], [250, 230], [30, 300], [270, 320]].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r={4} fill={CREMA} opacity={0.8} />
        ))}
        <rect x={138} y={286} width={24} height={34} fill="#8a5a3c" />
        <polygon points="150,70 205,150 95,150" fill="#2f8f6b" />
        <polygon points="150,110 225,210 75,210" fill="#2a7d5e" />
        <polygon points="150,160 245,285 55,285" fill="#236b50" />
        <polygon points="150,40 157,60 178,60 161,72 168,92 150,80 132,92 139,72 122,60 143,60" fill={AMARILLO} />
        <circle cx={120} cy={190} r={9} fill={NARANJA} />
        <circle cx={178} cy={236} r={9} fill="#e8505b" />
        <circle cx={112} cy={254} r={9} fill={AMARILLO} />
        <circle cx={186} cy={176} r={8} fill="#e8505b" />
        <path d="M0 360 C 60 335, 120 345, 170 350 S 260 340, 300 350 V400 H0Z" fill={CREMA} />
      </>
    ),
  },
  infantil: {
    fondo: "#bfe3ee",
    dibujo: (
      <>
        <circle cx={240} cy={70} r={32} fill={AMARILLO} />
        <path d="M150 220 L130 340 M205 215 L170 340 M100 230 L150 340" stroke={AZUL} strokeWidth={2} fill="none" />
        <ellipse cx={100} cy={180} rx={42} ry={52} fill={NARANJA} />
        <ellipse cx={205} cy={165} rx={42} ry={52} fill="#2a9d8f" />
        <ellipse cx={150} cy={120} rx={42} ry={52} fill="#e8505b" />
        <ellipse cx={138} cy={102} rx={9} ry={14} fill="#fff" opacity={0.45} />
        <path d="M0 340 C 60 300, 120 330, 170 320 S 260 300, 300 320 V400 H0Z" fill={SALVIA} />
        <path d="M0 375 C 70 350, 150 380, 220 360 S 280 355, 300 365 V400 H0Z" fill="#7fae9d" />
        <ellipse cx={70} cy={300} rx={40} ry={14} fill="#fff" opacity={0.9} />
        <ellipse cx={95} cy={290} rx={26} ry={14} fill="#fff" opacity={0.9} />
      </>
    ),
  },
  musica: {
    fondo: "#3b2a73",
    dibujo: (
      <>
        {[60, 100, 140].map((r) => (
          <circle key={r} cx={150} cy={200} r={r + 40} fill="none" stroke="#6b55b8" strokeWidth={3} opacity={0.5} />
        ))}
        <path d="M118 270 V120 L218 100 V250" stroke={CREMA} strokeWidth={12} fill="none" strokeLinejoin="round" />
        <path d="M118 150 L218 130" stroke={CREMA} strokeWidth={22} />
        <ellipse cx={98} cy={274} rx={32} ry={24} fill={NARANJA} transform="rotate(-20 98 274)" />
        <ellipse cx={198} cy={254} rx={32} ry={24} fill={NARANJA} transform="rotate(-20 198 254)" />
        <circle cx={60} cy={90} r={7} fill={AMARILLO} />
        <circle cx={250} cy={320} r={9} fill={SALVIA} />
        <circle cx={70} cy={340} r={5} fill={CREMA} />
      </>
    ),
  },
  mercadillo: {
    fondo: "#f6e2c6",
    dibujo: (
      <>
        <path d="M30 70 Q150 20 270 70" stroke={AZUL} strokeWidth={2} fill="none" />
        {[60, 105, 150, 195, 240].map((x, i) => (
          <circle key={x} cx={x} cy={i % 2 ? 62 : 52} r={6} fill={AMARILLO} />
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M${50 + i * 40} 120 h40 v50 a20 20 0 0 1 -40 0z`} fill={i % 2 ? CREMA : "#e8505b"} />
        ))}
        <rect x={50} y={110} width={200} height={14} fill="#c43d4b" />
        <rect x={64} y={190} width={8} height={130} fill="#8a5a3c" />
        <rect x={228} y={190} width={8} height={130} fill="#8a5a3c" />
        <rect x={50} y={250} width={200} height={70} rx={6} fill="#b27a4c" />
        <circle cx={95} cy={236} r={16} fill={NARANJA} />
        <circle cx={135} cy={238} r={14} fill="#2a9d8f" />
        <circle cx={178} cy={234} r={17} fill={AMARILLO} />
        <rect x={205} y={216} width={26} height={34} rx={4} fill={SALVIA} />
        <rect x={20} y={320} width={260} height={10} fill="#8a5a3c" opacity={0.35} />
      </>
    ),
  },
  deporte: {
    fondo: "#cfe9d6",
    dibujo: (
      <>
        <rect x={0} y={270} width={300} height={130} fill="#6fb184" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={0} y={270 + i * 34} width={300} height={17} fill="#5ea474" opacity={0.7} />
        ))}
        <ellipse cx={150} cy={300} rx={70} ry={12} fill={AZUL} opacity={0.2} />
        <circle cx={150} cy={190} r={78} fill="#fff" stroke={AZUL} strokeWidth={5} />
        <polygon points="150,150 180,172 168,208 132,208 120,172" fill={AZUL} />
        <path d="M150 150 V118 M180 172 L208 160 M168 208 L190 234 M132 208 L110 234 M120 172 L92 160" stroke={AZUL} strokeWidth={5} fill="none" />
        <circle cx={60} cy={80} r={26} fill={AMARILLO} />
      </>
    ),
  },
  cultura: {
    fondo: "#dbe7f7",
    dibujo: (
      <>
        <polygon points="40,170 150,95 260,170" fill={AZUL} />
        <circle cx={150} cy={148} r={10} fill={CREMA} />
        <rect x={40} y={176} width={220} height={14} fill={MAR} />
        {[62, 108, 154, 200].map((x) => (
          <g key={x}>
            <rect x={x} y={198} width={30} height={100} fill={CREMA} stroke={AZUL} strokeWidth={3} />
            <rect x={x - 4} y={194} width={38} height={10} fill={AZUL} />
          </g>
        ))}
        <rect x={34} y={298} width={232} height={14} fill={AZUL} />
        <rect x={22} y={312} width={256} height={14} fill={MAR} />
        <circle cx={240} cy={60} r={22} fill={NARANJA} />
      </>
    ),
  },
  cine: {
    fondo: "#1f2937",
    dibujo: (
      <>
        {[0, 1].map((k) => (
          <g key={k}>
            <rect x={0} y={k ? 330 : 30} width={300} height={40} fill="#0b0f17" />
            {Array.from({ length: 9 }).map((_, i) => (
              <rect key={i} x={12 + i * 33} y={(k ? 330 : 30) + 12} width={16} height={16} rx={3} fill="#3b4658" />
            ))}
          </g>
        ))}
        <circle cx={150} cy={200} r={92} fill={CREMA} />
        <circle cx={150} cy={200} r={74} fill="none" stroke={AZUL} strokeWidth={4} />
        <polygon points="128,160 128,240 198,200" fill={NARANJA} />
        <circle cx={250} cy={110} r={5} fill={AMARILLO} />
        <circle cx={44} cy={300} r={5} fill={AMARILLO} />
      </>
    ),
  },
  teatro: {
    fondo: "#5a1a3a",
    dibujo: (
      <>
        <path d="M0 0 H300 V60 Q150 110 0 60Z" fill="#8f2a56" />
        <path d="M0 0 H60 V200 Q30 120 0 80Z M300 0 H240 V200 Q270 120 300 80Z" fill="#7a2249" />
        <g transform="rotate(-12 110 230)">
          <path d="M60 170 Q110 150 160 170 V250 Q110 320 60 250Z" fill={CREMA} />
          <path d="M80 205 q16 -12 32 0 M120 205 q16 -12 32 0" stroke={AZUL} strokeWidth={5} fill="none" strokeLinecap="round" />
          <path d="M82 248 q28 28 56 0" stroke={AZUL} strokeWidth={6} fill="none" strokeLinecap="round" />
        </g>
        <g transform="rotate(14 200 260)">
          <path d="M150 200 Q200 180 250 200 V280 Q200 350 150 280Z" fill={NARANJA} />
          <path d="M170 235 q16 12 32 0 M210 235 q16 12 32 0" stroke={AZUL} strokeWidth={5} fill="none" strokeLinecap="round" />
          <path d="M172 296 q28 -26 56 0" stroke={AZUL} strokeWidth={6} fill="none" strokeLinecap="round" />
        </g>
        <circle cx={150} cy={355} r={6} fill={AMARILLO} />
      </>
    ),
  },
  fiestas: {
    fondo: "#fde4d0",
    dibujo: (
      <>
        <path d="M0 60 Q150 140 300 60" stroke={AZUL} strokeWidth={2.5} fill="none" />
        {[
          [30, 74, "#e8505b"], [70, 92, AMARILLO], [112, 106, "#2a9d8f"], [155, 110, NARANJA], [198, 106, "#6b55b8"], [240, 92, "#e8505b"], [272, 76, AMARILLO],
        ].map(([x, y, c]) => (
          <polygon key={`${x}`} points={`${Number(x) - 16},${Number(y) - 8} ${Number(x) + 16},${Number(y) - 8} ${x},${Number(y) + 30}`} fill={String(c)} />
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <rect key={i} x={150} y={250} width={6} height={52} rx={3} fill={i % 2 ? NARANJA : "#e8505b"} transform={`rotate(${i * 30} 153 276) translate(0 -20)`} />
        ))}
        <circle cx={153} cy={276} r={14} fill={AMARILLO} />
        {[[60, 230, 12], [240, 200, 20], [70, 330, 40], [250, 330, 8], [200, 160, 33]].map(([x, y, r]) => (
          <rect key={`${x}${y}`} x={x} y={y} width={12} height={6} rx={2} fill={[MAR, NARANJA, AMARILLO, "#e8505b", SALVIA][Number(r) % 5]} transform={`rotate(${r} ${x} ${y})`} />
        ))}
      </>
    ),
  },
  gastronomia: {
    fondo: "#f3d9b1",
    dibujo: (
      <>
        <path d="M100 100 q-14 -22 0 -44 q14 -22 0 -44 M150 110 q-14 -22 0 -44 q14 -22 0 -44 M200 100 q-14 -22 0 -44 q14 -22 0 -44" stroke="#c98f55" strokeWidth={6} fill="none" strokeLinecap="round" transform="translate(0 70)" />
        {[[118, 232, -12], [160, 226, 6], [200, 234, 18], [140, 246, -4], [182, 248, 10]].map(([x, y, a]) => (
          <ellipse key={`${x}`} cx={x} cy={y} rx={22} ry={17} fill="#7a4a2b" transform={`rotate(${a} ${x} ${y})`} />
        ))}
        <path d="M50 250 H250 A100 100 0 0 1 50 250Z" fill={NARANJA} />
        <rect x={44} y={242} width={212} height={14} rx={7} fill="#c43d4b" />
        <rect x={100} y={350} width={100} height={14} rx={7} fill="#8a5a3c" opacity={0.4} />
        <circle cx={240} cy={70} r={20} fill={AMARILLO} />
      </>
    ),
  },
  solidario: {
    fondo: "#fbd5e3",
    dibujo: (
      <>
        <circle cx={150} cy={200} r={120} fill="#f7b6cf" />
        <path d="M150 310 C 40 230, 50 110, 150 165 C 250 110, 260 230, 150 310 Z" fill="#e8505b" />
        <path d="M150 262 C 100 222, 106 170, 150 196 C 194 170, 200 222, 150 262 Z" fill="#fbd5e3" />
        <circle cx={62} cy={92} r={8} fill={CREMA} />
        <circle cx={246} cy={328} r={10} fill={CREMA} />
        <circle cx={250} cy={86} r={6} fill="#e8505b" />
        <circle cx={52} cy={310} r={6} fill="#e8505b" />
      </>
    ),
  },
  comercial: {
    fondo: "#e4e8ee",
    dibujo: (
      <>
        <path d="M110 150 C 110 80, 190 80, 190 150" stroke={AZUL} strokeWidth={10} fill="none" strokeLinecap="round" />
        <path d="M80 150 H220 L240 330 H60Z" fill={NARANJA} />
        <path d="M80 150 H220 L224 190 H76Z" fill="#e0693c" />
        <circle cx={122} cy={158} r={8} fill={CREMA} />
        <circle cx={178} cy={158} r={8} fill={CREMA} />
        <g transform="rotate(14 245 100)">
          <path d="M215 70 H265 L282 100 L265 130 H215Z" fill={AMARILLO} />
          <circle cx={226} cy={100} r={5} fill={AZUL} />
          <path d="M240 100 H266" stroke={AZUL} strokeWidth={4} strokeLinecap="round" />
        </g>
        <rect x={50} y={340} width={200} height={10} rx={5} fill={AZUL} opacity={0.15} />
      </>
    ),
  },
};

/** Ilustración (3:4) de la categoría del evento. Decorativa: no lleva texto alternativo. */
export default function CartelGenerico({ categorias, className = "" }: { categorias: readonly Categoria[]; className?: string }) {
  const { fondo, dibujo } = ILUSTRACIONES[categoriaIlustracion(categorias)];
  return (
    <svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={className}>
      <rect width={300} height={400} fill={fondo} />
      {dibujo}
    </svg>
  );
}
