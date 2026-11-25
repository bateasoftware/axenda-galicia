import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Panel de revisión",
  robots: { index: false, follow: false },
  // Al añadir el panel a la pantalla de inicio, se instala como su propia app («Axenda Admin») y abre /admin
  manifest: "/admin/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Axenda Admin", statusBarStyle: "default" },
};

export default function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  return <div className="mx-auto w-full max-w-3xl">{children}</div>;
}
