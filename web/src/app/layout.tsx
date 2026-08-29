import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import TabBar from "@/components/TabBar";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Floe — keep Nanuq's ice solid",
  description: "A ten-second recycling habit, verified at the bin.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Floe" },
};

export const viewport: Viewport = {
  themeColor: "#f2f5f7",
  /* Cover the notch so translucent chrome reaches the screen edges. */
  viewportFit: "cover",
  /* Never block zoom — pinch-to-zoom is an accessibility feature. */
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        {/* Content scrolls under the tab bar rather than being boxed above it. */}
        <main
          className="mx-auto w-full max-w-lg px-4 pt-5"
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
          className="pointer-events-none fixed inset-x-0 z-10"
          style={{
            bottom: "calc(var(--tabbar-h) + var(--safe-b))",
            height: "5.5rem",
            background:
              "linear-gradient(to top, var(--ice-2) 0%, rgba(211, 227, 234, 0.72) 45%, transparent 100%)",
          }}
        />
        <TabBar />
      </body>
    </html>
  );
}
