import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Panel de revisión",
  robots: { index: false, follow: false },
};

export default function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  return <div className="mx-auto w-full max-w-3xl">{children}</div>;
}
