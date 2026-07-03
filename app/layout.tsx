// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import SettingsMenu from "@/components/SettingsMenu";
import ThemeToggle from "@/components/ThemeToggle";
import BackButton from "@/components/BackButton";

export const metadata: Metadata = {
  title: "FieldCRM",
  description: "Field-sales CRM for B2B distributors on Shopify.",
  // PWA / homescreen
  manifest: "/site.webmanifest",
  themeColor: "#ffffff",
  formatDetection: { telephone: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FieldCRM",
  },
  icons: {
    // Favicon & PWA icons
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    // iOS home screen
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* 📱 Make pages fit the device width and disable pinch-zoom */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        {/* Safari pinned tab (monochrome mask icon) */}
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#f7a8d8" />
        {/* Ensure manifest is fetched even if Metadata changes are cached */}
        <link rel="manifest" href="/site.webmanifest" />
        {/* iOS hints (duplicates are fine; Metadata also sets these) */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="FieldCRM" />
        <meta name="theme-color" content="#ffffff" />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('fieldcrm-theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}`,
          }}
        />
      </head>

      <body>
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: "#ffffff",
            borderBottom: "1px solid #eee",
          }}
        >
          {/* 3-column grid: [left/back] [centered logo] [settings] */}
          <div
            className="container header-wrap"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              padding: "12px 16px",
              maxWidth: 1100,
              margin: "0 auto",
            }}
          >
            {/* Left: Back button (falls back to /customers if no history) */}
            <div style={{ justifySelf: "start" }}>
              <BackButton className="btn" label="Back" fallback="/customers" />
            </div>

            {/* Center: Logo */}
            <Link
              href="/"
              className="header-logo"
              style={{
                justifySelf: "center",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <span
                className="brand-wordmark"
                style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)" }}
              >
                Field<span style={{ color: "var(--pink, #e6007e)" }}>CRM</span>
              </span>
            </Link>

            {/* Right: Theme toggle + Settings */}
            <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 8 }}>
              <ThemeToggle />
              <SettingsMenu />
            </div>
          </div>
        </header>

        <main
          className="container"
          style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}
        >
          {children}
        </main>

        <footer style={{ borderTop: "1px solid #eee", padding: "16px 0" }}>
          <div
            className="container"
            style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px" }}
          >
            <small>© FieldCRM</small>
          </div>
        </footer>
      </body>
    </html>
  );
}
