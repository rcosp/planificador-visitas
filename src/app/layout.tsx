import type { Metadata } from "next";
import { Maven_Pro } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

const mavenPro = Maven_Pro({
  variable: "--font-maven-pro",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Planificador de visitas",
  description: "Planificación de visitas de técnicos a obras",
};

const NAV = [
  { href: "/visitas", label: "Visitas" },
  { href: "/agenda", label: "Agenda" },
  { href: "/visitas/nueva", label: "Programar visita" },
  { href: "/recursos", label: "Técnicos y obras" },
] as const;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${mavenPro.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-brand-surface font-sans text-brand-slate">
        <header className="border-b-4 border-brand-mint bg-brand-navy text-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4">
            <Link href="/visitas" className="flex items-center gap-3">
              <Image
                src="/labocat-logo-negativo.png"
                alt="Labocat"
                width={128}
                height={36}
                preload
              />
              <span className="border-l border-white/30 pl-3 text-lg font-semibold tracking-tight">
                Planificador de visitas
              </span>
            </Link>
            <nav className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/80">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-brand-mint">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
          Prueba técnica para Labocat · Aplicación no oficial con datos ficticios
        </footer>
      </body>
    </html>
  );
}
