import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Planificador de visitas",
  description: "Planificación de visitas de técnicos a obras",
};

const NAV = [
  { href: "/visitas", label: "Visitas" },
  { href: "/visitas/nueva", label: "Programar visita" },
  { href: "/recursos", label: "Técnicos y obras" },
] as const;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 font-sans text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/visitas" className="font-semibold tracking-tight">
              Planificador de visitas
            </Link>
            <nav className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-slate-900">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
