import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://popforge.jpmassagem.pt"),
  title: { default: "POPForge — Ideias que ganham forma", template: "%s · POPForge" },
  description: "Peças únicas, colecionáveis e impressão 3D personalizada, produzidos em Portugal.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt"><body>{children}</body></html>;
}
