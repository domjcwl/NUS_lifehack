import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono } from "next/font/google";
import TabBar from "@/components/TabBar";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Floe — keep Nanuq's ice solid",
  description: "A ten-second recycling habit, verified at the bin.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Floe" },
};

export const viewport: Viewport = {
  themeColor: "#030a10",
  viewportFit: "cover",
  /* Never block zoom — pinch-to-zoom is an accessibility feature. */
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {/* Atmosphere sits behind everything and never intercepts a touch. */}
        <div aria-hidden className="aurora aurora-drift" />
        <div aria-hidden className="underglow" />

        <main
          className="relative z-10 mx-auto w-full max-w-lg px-4 pt-6"
          style={{ paddingBottom: "calc(var(--tabbar-h) + var(--safe-b) + 1.5rem)" }}
        >
          {children}
        </main>

        {/*
          Scroll edge effect — a soft fade where content meets the floating
          chrome, rather than a hard divider or an abrupt collision.
        */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 z-20"
          style={{
            bottom: "calc(var(--tabbar-h) + var(--safe-b))",
            height: "5rem",
            background:
              "linear-gradient(to top, var(--night-0) 10%, rgba(3, 10, 16, 0.7) 55%, transparent 100%)",
          }}
        />
        <TabBar />
      </body>
    </html>
  );
}
