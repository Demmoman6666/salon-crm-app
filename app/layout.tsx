// app/layout.tsx
import "./globals.css";
import AppChrome from "@/components/AppChrome";
import type { Metadata } from "next";

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
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
