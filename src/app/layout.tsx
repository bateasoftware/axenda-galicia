import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "./globals.css";
import { SITIO } from "@/lib/sitio";
import RegistroSW from "@/components/RegistroSW";
import Analitica from "@/components/Analitica";

export const metadata: Metadata = {
  metadataBase: new URL(SITIO.url),
  title: { default: `${SITIO.nombre} · ${SITIO.lema}`, template: `%s · ${SITIO.nombre}` },
  description: SITIO.descripcion,
  appleWebApp: { capable: true, title: SITIO.nombre, statusBarStyle: "default" },
  openGraph: { siteName: SITIO.nombre, locale: "es_ES", type: "website" },
  twitter: { card: "summary_large_image" },
  // Google Search Console: GOOGLE_SITE_VERIFICATION es el valor de la meta que da Google (ver docs/pendientes-juan.md)
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
};

export const viewport: Viewport = { themeColor: "#0b2545" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <header className="print:hidden sticky top-0 z-[1000] border-b border-[var(--linea)] bg-[var(--fondo)]/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
            <Link href="/" aria-label={`${SITIO.nombre}: inicio`} className="flex items-center">
              {/* Logo completo; en pantallas muy estrechas, solo el icono */}
              <Image src="/marca/logo.png" alt={SITIO.nombre} width={1476} height={347} sizes="160px" className="hidden h-9 w-auto min-[420px]:block" />
              <Image src="/marca/icono.png" alt={SITIO.nombre} width={380} height={347} sizes="40px" className="h-9 w-auto min-[420px]:hidden" />
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/concellos" className="rounded-lg px-2 py-1.5 hover:bg-[var(--arena)] sm:px-3">Concellos</Link>
              <Link href="/enviar" className="rounded-full bg-[var(--mar)] px-3 py-1.5 font-medium whitespace-nowrap text-white hover:opacity-90">
                + Enviar<span className="hidden sm:inline"> evento</span>
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 py-6">{children}</main>
        <footer className="print:hidden border-t border-[var(--linea)] py-8 text-center text-sm text-[var(--gris)]">
          <p>{SITIO.nombre} · Agenda de Val Miñor y Vigo · Versión beta</p>
          <p className="mt-1">
            ¿Organizas algo? <Link href="/enviar" className="underline">Mándanos el cartel</Link> ·{" "}
            <Link href="/widget" className="underline">La agenda en tu web</Link> ·{" "}
            <Link href="/anunciate" className="underline">Anúnciate</Link>
          </p>
          <p className="mt-1">
            {/* Sin esto, en la app instalada (sin barra de direcciones) no hay forma de llegar al panel */}
            <Link href="/admin" prefetch={false} className="underline">Administración</Link>
          </p>
        </footer>
        <RegistroSW />
        <Analitica />
      </body>
    </html>
  );
}
