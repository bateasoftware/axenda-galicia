import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "./globals.css";
import { SITIO } from "@/lib/sitio";
import RegistroSW from "@/components/RegistroSW";

export const metadata: Metadata = {
  metadataBase: new URL(SITIO.url),
  title: { default: `${SITIO.nombre} · ${SITIO.lema}`, template: `%s · ${SITIO.nombre}` },
  description: SITIO.descripcion,
  appleWebApp: { capable: true, title: SITIO.nombre, statusBarStyle: "default" },
  openGraph: { siteName: SITIO.nombre, locale: "es_ES", type: "website" },
};

export const viewport: Viewport = { themeColor: "#0b2545" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <header className="sticky top-0 z-[1000] border-b border-[var(--linea)] bg-[var(--fondo)]/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--tinta)] text-sm font-bold text-white">A</span>
              <span className="font-display text-xl">{SITIO.nombre}</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/concellos" className="rounded-lg px-3 py-1.5 hover:bg-[var(--arena)]">Concellos</Link>
              <Link href="/enviar" className="rounded-full bg-[var(--mar)] px-3 py-1.5 font-medium text-white hover:opacity-90">
                + Enviar evento
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-[var(--linea)] py-8 text-center text-sm text-[var(--gris)]">
          <p>{SITIO.nombre} · Agenda de Val Miñor y Vigo · Versión beta</p>
          <p className="mt-1">
            ¿Organizas algo? <Link href="/enviar" className="underline">Mándanos el cartel</Link>
          </p>
        </footer>
        <RegistroSW />
      </body>
    </html>
  );
}
