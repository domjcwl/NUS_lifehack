import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Floe — keep Nanuq's ice solid",
  description: "A ten-second recycling habit, verified at the bin.",
};

const NAV = [
  { href: "/", label: "Nanuq" },
  { href: "/bins", label: "Bins" },
  { href: "/chat", label: "Ask" },
  { href: "/news", label: "News" },
  { href: "/impact", label: "Impact" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-20 border-b border-[var(--edge)] bg-white/70 backdrop-blur">
          <nav className="mx-auto flex max-w-lg items-center gap-1 px-4 py-3 text-[11px] mono">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-full px-3 py-1.5 text-[var(--ink-soft)] transition hover:bg-[var(--ice-1)] hover:text-[var(--deep)]"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">{children}</main>
        <footer className="mx-auto w-full max-w-lg px-4 pb-8 pt-2 text-[10px] mono text-[var(--ink-soft)]">
          Floe · LifeHack 2026 · prototype
        </footer>
      </body>
    </html>
  );
}
